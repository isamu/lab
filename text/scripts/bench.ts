// Seeded-mistake benchmark. Plants one mistake at a time in the self-written samples of test/fixtures/bench/<lang>/,
// runs every rule (as with --experimental) for the sample's genre, and counts which planted mistakes chaff finds.
// The corpus measures false positives; this measures misses. The summary is compared with
// test/fixtures/bench/expected.txt, and --update rewrites that file.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allFindings, type CorpusFinding } from "./corpus-findings.ts";
import { MUTATIONS, type Mutation, type PlantContext } from "./bench-mutations.ts";
import { cleanLine, falseAlarms, formatTable, outcomeLine, outcomeOf, ruleTable, summaryChanges, type Outcome } from "./bench-score.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { resolve } from "../packages/chaff/src/levels.ts";

const BENCH = join(dirname(fileURLToPath(import.meta.url)), "..", "test", "fixtures", "bench");
const EXPECTED = join(BENCH, "expected.txt");
const LANGUAGES: readonly string[] = ["ja", "en"];
const verbose = process.argv.includes("--verbose");
const update = process.argv.includes("--update");

/** The genre each kind of sample is checked as. */
const GENRES: Readonly<Record<string, string>> = {
  itinerary: "business/report",
  quote: "business/report",
  minutes: "business/meeting-notes",
  design: "technical/spec",
  requirements: "technical/spec",
  policy: "business/policy",
  note: "business/note",
};

type Sample = { readonly name: string; readonly language: string; readonly genre: string; readonly path: string; readonly source: string };

const samplesOf = (language: string): Sample[] =>
  readdirSync(join(BENCH, language))
    .filter((file) => file.endsWith(".md"))
    .sort((left, right) => left.localeCompare(right, "en"))
    .map((file) => {
      const kind = file.replace(/\.md$/u, "");
      return {
        name: `${language}/${kind}`,
        language,
        genre: GENRES[kind] ?? "business",
        path: `bench/${language}/${file}`,
        source: readFileSync(join(BENCH, language, file), "utf8"),
      };
    });

const contextOf = (sample: Sample): PlantContext => {
  const rule = loadRules(sample.language).find((definition) => definition.id === "max-sentence-length");
  if (rule === undefined) throw new Error("max-sentence-length is not a rule any more");
  return { sentenceLimit: resolve(rule, "normal", sample.genre).limit };
};

const findingsOf = async (sample: Sample, source: string): Promise<CorpusFinding[]> => allFindings(sample.path, source, sample.language, sample.genre);

const plantedOutcome = async (sample: Sample, mutation: Mutation): Promise<Outcome | undefined> => {
  const plant = mutation.plant(sample.source, contextOf(sample));
  if (plant === undefined) return undefined;
  const findings = await findingsOf(sample, plant.source);
  if (verbose)
    findings.filter((finding) => finding.rule === mutation.rule).forEach((finding) => console.log(`    ${String(finding.line)}  ${finding.message}`));
  return outcomeOf(sample.name, mutation.id, { rule: mutation.rule, line: plant.line }, findings);
};

const outcomesOf = async (sample: Sample): Promise<Outcome[]> =>
  MUTATIONS.filter((mutation) => mutation.languages.includes(sample.language)).reduce<Promise<Outcome[]>>(async (previous, mutation) => {
    const outcomes = await previous;
    const outcome = await plantedOutcome(sample, mutation);
    if (outcome !== undefined && verbose) console.log(outcomeLine(outcome));
    return outcome === undefined ? outcomes : [...outcomes, outcome];
  }, Promise.resolve([]));

type Measured = { readonly outcomes: readonly Outcome[]; readonly clean: readonly CorpusFinding[]; readonly cleanLine: string };

const measured: ReadonlySet<string> = new Set(MUTATIONS.map((mutation) => mutation.rule));

const measure = async (sample: Sample): Promise<Measured> => {
  const clean = await findingsOf(sample, sample.source);
  return { outcomes: await outcomesOf(sample), clean, cleanLine: cleanLine(sample.name, clean, measured) };
};

const samples = LANGUAGES.flatMap(samplesOf);
const results = await samples.reduce<Promise<Measured[]>>(async (previous, sample) => [...(await previous), await measure(sample)], Promise.resolve([]));
const outcomes = results.flatMap((result) => result.outcomes);
const alarms = falseAlarms(
  results.flatMap((result) => result.clean),
  measured,
);
const table = formatTable(ruleTable(measured, outcomes, alarms));
table.forEach((line) => console.log(line));

const misses = outcomes.filter((outcome) => !outcome.found);
if (misses.length > 0) console.log("\nMissed:");
misses.forEach((outcome) => console.log(`  ${outcomeLine(outcome)}`));

const actual = [...table, ...results.map((result) => result.cleanLine), ...outcomes.map(outcomeLine)];
const expected = existsSync(EXPECTED)
  ? readFileSync(EXPECTED, "utf8")
      .split("\n")
      .filter((line) => line !== "")
  : [];
if (update) writeFileSync(EXPECTED, `${actual.join("\n")}\n`);
const changes = update ? [] : summaryChanges(expected, actual);
if (changes.length > 0) {
  console.log("\nChanged from test/fixtures/bench/expected.txt (yarn bench --update to accept):");
  changes.forEach((change) => console.log(change));
  process.exitCode = 1;
}
