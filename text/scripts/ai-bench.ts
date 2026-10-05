// How precise are the AI-shape rules (group ai-tells)? Runs every rule, as with --experimental, on
//   (b) test/fixtures/ai-samples/paired/<lang>/<kind>/ai.md   generated style: a rule should fire here;
//   (a) human.md and (c) rewritten.md beside it               the same content written as a person would: it should not;
//   the human corpus (corpus/docs; --all adds the fetched .cache)  real documents: it should not.
// It prints, per language and rule, the hits on (b) and the false alarms on the rest. The table (committed corpus only)
// is compared with test/fixtures/ai-samples/paired/expected.txt; --update rewrites it. --verbose lists what fired where.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allFindings } from "./corpus-findings.ts";
import { docEntries, docPath, parsedAs } from "./corpus-docs.ts";
import { firedOn, formatRows, PILES, ruleRows, type BenchRun, type Pile } from "./ai-bench-score.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { aiShapeRuleIds } from "../packages/chaff/src/ai-score/signals.ts";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PAIRED = join(ROOT, "test", "fixtures", "ai-samples", "paired");
const EXPECTED = join(PAIRED, "expected.txt");
const CORPUS = join(ROOT, "corpus");
const LANGUAGES: readonly string[] = ["ja", "en"];
/** The genre each kind of paired sample is read as. */
const KIND_GENRES: Readonly<Record<string, string>> = { tech: "blog/tech", business: "business/report", essay: "blog/essay" };
const VARIANT_PILES: Readonly<Record<string, Pile>> = { "ai.md": "ai", "human.md": "human", "rewritten.md": "rewritten" };
const update = process.argv.includes("--update");
const verbose = process.argv.includes("--verbose");
const withCache = process.argv.includes("--all");

/** A document to run: where it is on disk, the name chaff reads it under (that picks Markdown or text), and its genre. */
type Input = { readonly pile: Pile; readonly id: string; readonly file: string; readonly readAs: string; readonly genre: string };

const sampleInputs = (language: string): Input[] =>
  Object.entries(KIND_GENRES).flatMap(([kind, genre]) =>
    Object.entries(VARIANT_PILES).map(([name, pile]) => {
      const file = join(PAIRED, language, kind, name);
      return { pile, id: `${kind}/${name}`, file, readAs: file, genre };
    }),
  );

const manifest: unknown = JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"));

const corpusInputs = (language: string): Input[] =>
  docEntries(manifest)
    .filter((entry) => entry.language === language && (entry.redistribute || withCache))
    .map((entry) => ({ pile: "corpus" as const, id: entry.id, file: docPath(CORPUS, entry), readAs: parsedAs(entry), genre: entry.genre }))
    .filter((input) => existsSync(input.file));

const aiShapeRules = (language: string): string[] => aiShapeRuleIds(loadRules(language));

const runOf = async (input: Input, language: string, rules: readonly string[]): Promise<BenchRun> => {
  const findings = await allFindings(input.readAs, readFileSync(input.file, "utf8"), language, input.genre);
  return { pile: input.pile, id: input.id, fired: new Set(findings.map((finding) => finding.rule).filter((rule) => rules.includes(rule))) };
};

const languageSection = async (language: string): Promise<string[]> => {
  const rules = aiShapeRules(language);
  const inputs = [...sampleInputs(language), ...corpusInputs(language)];
  const runs = await inputs.reduce<Promise<BenchRun[]>>(
    async (previous, input) => [...(await previous), await runOf(input, language, rules)],
    Promise.resolve([]),
  );
  if (verbose) PILES.forEach((pile) => firedOn(runs, pile).forEach((line) => console.log(`  ${language} ${pile}  ${line}`)));
  return [`## ${language}`, ...formatRows(ruleRows(runs, rules)), ""];
};

const sections = await LANGUAGES.reduce<Promise<string[]>>(
  async (previous, language) => [...(await previous), ...(await languageSection(language))],
  Promise.resolve([]),
);
const table = `${sections.join("\n").trimEnd()}\n`;
console.log(table);
if (withCache) {
  console.log("(--all includes the fetched documents, so the table is not compared with expected.txt)");
} else if (update) {
  writeFileSync(EXPECTED, table);
} else if (!existsSync(EXPECTED) || readFileSync(EXPECTED, "utf8") !== table) {
  console.log(`Changed from ${EXPECTED} (yarn bench:ai --update to accept)`);
  process.exitCode = 1;
}
