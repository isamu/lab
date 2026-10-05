// `yarn rules:measure`: for every rule, on how many human documents of each genre group it reports, and how its
// findings fared in the bench. Every rule runs at its genre's level (normal where the genre turns it off, so an off
// rule is still measured), experimental ones included, on the corpus (corpus/docs, corpus/laws and the fetched
// corpus/.cache) with each document's genre. A document runs with the others of its set (its publisher, or the statutes;
// scripts/rules-measure-sets.ts), so the rules that compare documents are measured too. The bench columns come from the
// committed bench expectations.
//   --json                print the measurement as JSON instead of the table
//   --write                write the corpus part to corpus/rules-measure.json, which test/test_rule_policy.ts holds the rules to,
//                          and the AI-likeness score's human shares (scripts/ai-score-shares.ts)
//   --apply                measure, write corpus/rules-measure.json, and set each rule's status and severity, and the groups each
//                          is measured off for (off_for), from it: the one step that places a rule that just landed (--from <json> skips the run)
//   --baseline <dir>       also run every .md in <dir> (never committed) and add a baseline column
//   --baseline-genre <id>  the genre the baseline is read as (blog/tech when left out)
//   --from <json>          read a measurement --json printed before instead of running chaff again
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { corpusLanguages, runSetAtLevels } from "./corpus-findings.ts";
import { documentSets, setOf } from "./rules-measure-sets.ts";
import { docEntries, docPath, parsedAs } from "./corpus-docs.ts";
import {
  aiBenchRows,
  benchRowOf,
  groupShares,
  overallShares,
  withoutBaseline,
  type DocumentRun,
  type GroupShare,
  type Measurement,
  type RuleMeasure,
} from "./rules-measure-score.ts";
import { formatMeasureTable } from "./rules-measure-table.ts";
import { allRules, applyMeasurement, genreDataOf, MEASURE_FILE, readGenresText, readMeasurement, standingsOf } from "./rules-measure-files.ts";
import { japaneseRatio } from "../packages/chaff/src/detect-language.ts";
import { presetLevels } from "../packages/chaff/src/genre-load.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { measuredLevelsOf } from "../packages/chaff/src/ai-score/signals.ts";
import { writeAiScoreShares } from "./ai-score-shares.ts";
import type { Level, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import type { RunResult } from "../packages/chaff/src/run.ts";

const ROOT = join(import.meta.dirname, "..");
const CORPUS = join(ROOT, "corpus");
const LAWS = join(CORPUS, "laws");
const BENCH_EXPECTED = join(ROOT, "test", "fixtures", "bench", "expected");
const AI_EXPECTED = join(ROOT, "test", "fixtures", "ai-samples", "paired", "expected.txt");
const STATUTE_GENRE = "legal/statute";
const DEFAULT_BASELINE_GENRE = "blog/tech";
/** A baseline document with at least this share of Japanese characters is read as Japanese. */
const JAPANESE_MIN_RATIO = 0.1;

const argValue = (name: string): string | undefined => {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
};

/** Each rule at its genre's level, and at normal where the genre turns it off: the share is measured either way. */
const measuredLevels =
  (genre: string) =>
  (rules: readonly RuleDefinition[]): Record<string, Level> =>
    measuredLevelsOf(rules, presetLevels(genre));

/** A document to measure. set: the documents it runs with (scripts/rules-measure-sets.ts), all of one language. */
type Input = { readonly file: string; readonly readAs: string; readonly language: string; readonly genre: string; readonly set: string };

const ruleIds = new Map(["ja", "en"].map((language) => [language, loadRules(language).map((rule) => rule.id)]));

const documentRunOf = (input: Input, result: RunResult): DocumentRun => {
  const skipped = new Set(result.skipped.map((skip) => skip.rule));
  const ran = new Set((ruleIds.get(input.language) ?? []).filter((rule) => !skipped.has(rule)));
  return { group: input.genre.split("/")[0] ?? input.genre, ran, fired: new Set(result.findings.map((finding) => finding.rule)) };
};

const runSet = async (set: readonly Input[]): Promise<DocumentRun[]> => {
  const [first] = set;
  if (first === undefined) return [];
  const files = set.map((input) => ({ path: input.readAs, source: readFileSync(input.file, "utf8"), genre: input.genre, levels: measuredLevels(input.genre) }));
  const results = await runSetAtLevels(files, first.language);
  return set.flatMap((input, index) => {
    const result = results[index];
    return result === undefined ? [] : [documentRunOf(input, result)];
  });
};

const runAll = async (inputs: readonly Input[]): Promise<DocumentRun[]> =>
  documentSets(inputs).reduce<Promise<DocumentRun[]>>(async (previous, set) => [...(await previous), ...(await runSet(set))], Promise.resolve([]));

const manifest: unknown = JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"));

const corpusInputs = (): Input[] => {
  const languages = corpusLanguages(manifest);
  const laws = readdirSync(LAWS)
    .filter((file) => file.endsWith(".txt"))
    .map((file) => {
      const language = languages.get(file) ?? "ja";
      return { file: join(LAWS, file), readAs: file, language, genre: STATUTE_GENRE, set: setOf(language, undefined, "laws") };
    });
  const docs = docEntries(manifest).map((entry) => ({
    file: docPath(CORPUS, entry),
    readAs: parsedAs(entry),
    language: entry.language,
    genre: entry.genre,
    set: setOf(entry.language, entry.url, "docs"),
  }));
  return [...laws, ...docs].filter((input) => existsSync(input.file));
};

/** The baseline folder is one set per language, as a team's folder is one run. */
const baselineInputs = (dir: string, genre: string): Input[] =>
  readdirSync(dir)
    .filter((file) => file.endsWith(".md"))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((file) => {
      const path = join(dir, file);
      const language = japaneseRatio(readFileSync(path, "utf8")) >= JAPANESE_MIN_RATIO ? "ja" : "en";
      return { file: path, readAs: file, language, genre, set: setOf(language, undefined, "baseline") };
    });

const benchOf = (rule: string): RuleMeasure["bench"] => {
  const path = join(BENCH_EXPECTED, `${rule}.txt`);
  return existsSync(path) ? benchRowOf(readFileSync(path, "utf8")) : undefined;
};

const measurementOf = (shares: Record<string, Record<string, GroupShare>>, baseline: Record<string, GroupShare> | undefined): Measurement => {
  const ai = aiBenchRows(readFileSync(AI_EXPECTED, "utf8"));
  const ids = [...new Set([...ruleIds.values()].flat())].toSorted((left, right) => left.localeCompare(right, "en"));
  const rules = ids.map((rule): [string, RuleMeasure] => {
    const bench = benchOf(rule);
    const measure: RuleMeasure = {
      groups: shares[rule] ?? {},
      ...(bench === undefined ? {} : { bench }),
      ...(ai[rule] === undefined ? {} : { aiBench: ai[rule] }),
      ...(baseline?.[rule] === undefined ? {} : { baseline: baseline[rule] }),
    };
    return [rule, measure];
  });
  return { rules: Object.fromEntries(rules) };
};

const measure = async (): Promise<Measurement> => {
  const from = argValue("--from");
  if (from !== undefined) return readMeasurement(from);
  const baselineDir = argValue("--baseline");
  const corpus = groupShares(await runAll(corpusInputs()));
  const baseline =
    baselineDir === undefined ? undefined : overallShares(await runAll(baselineInputs(baselineDir, argValue("--baseline-genre") ?? DEFAULT_BASELINE_GENRE)));
  return measurementOf(corpus, baseline);
};

const tableOf = (measurement: Measurement): string[] => {
  const rules = allRules();
  const standings = standingsOf(measurement, rules, genreDataOf(readGenresText()));
  return formatMeasureTable(measurement, standings, new Map(rules.map((rule) => [rule.id, rule.status])));
};

const measurement = await measure();
const apply = process.argv.includes("--apply");
// Applied first: a measurement that leaves a rule out throws before any file is written.
const applied = apply ? applyMeasurement(withoutBaseline(measurement)) : [];
if (apply || process.argv.includes("--write")) {
  writeFileSync(MEASURE_FILE, `${JSON.stringify(withoutBaseline(measurement), null, 2)}\n`);
  await writeAiScoreShares(withoutBaseline(measurement));
}
if (apply) applied.forEach((line) => console.log(line));
else console.log(process.argv.includes("--json") ? JSON.stringify(measurement, null, 2) : tableOf(measurement).join("\n"));
