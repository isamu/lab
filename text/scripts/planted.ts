// `yarn planted [set...]`: the planted sets (test/fixtures/planted/<set>/), every set when none is named. Each document of
// a set has a clean version and a planted one, and the set's manifest.json lists every planted mistake with its kind, line
// and the rule expected to report it. Every document is run as `chaff --genre <genre>` would run it (the genre's levels, no
// other experimental rule), under a chaff.yaml naming the document's style when the manifest gives one, and the script prints how many planted mistakes of each kind were reported on their line, per
// language, and the findings the clean versions get from those rules. The score is compared with the set's expected.json.
// The run fails on a regression: a recall that dropped, a clean document that gained a finding, a kind or set that is no
// longer scored, or a changed number of planted mistakes (a manifest edit, recorded on purpose). A recall that rose or a
// clean finding that went away is printed as an improvement and passes, so rules and sets can land in any order.
// --update rewrites the expected.json of the sets it ran. `yarn contracts` is `yarn planted contracts`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { genreFindings, type CorpusFinding } from "./corpus-findings.ts";
import {
  cleanFindingLines,
  compareToExpected,
  expectationOf,
  formatRecall,
  misalignedPlants,
  parseExpectation,
  parseManifest,
  pickSets,
  recallByKind,
  setsWithoutManifest,
  type Expectation,
  type ExpectationComparison,
  type PlantedDocument,
} from "./planted-score.ts";

const ROOT = join(import.meta.dirname, "..", "test", "fixtures", "planted");
const update = process.argv.includes("--update");
const requested = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));

const setsWith = (file: string): string[] => readdirSync(ROOT).filter((name) => existsSync(join(ROOT, name, file)));

const readText = (set: string, file: string): string => {
  try {
    return readFileSync(join(ROOT, set, file), "utf8");
  } catch (error) {
    throw new Error(`planted: cannot read ${join(ROOT, set, file)}`, { cause: error });
  }
};

const readJson = (set: string, file: string): unknown => {
  const text = readText(set, file);
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new Error(`planted: ${join(ROOT, set, file)} is not JSON`, { cause: error });
  }
};

const findingsOf = async (set: string, document: PlantedDocument, file: string): Promise<CorpusFinding[]> =>
  genreFindings(join(ROOT, set, file), readText(set, file), document.language, document.genre, document.style);

const runAll = async (set: string, documents: readonly PlantedDocument[], pick: (document: PlantedDocument) => string): Promise<Map<string, CorpusFinding[]>> =>
  new Map(
    await documents.reduce<Promise<[string, CorpusFinding[]][]>>(
      async (previous, document) => [...(await previous), [document.id, await findingsOf(set, document, pick(document))]],
      Promise.resolve([]),
    ),
  );

const checkAlignment = (set: string, documents: readonly PlantedDocument[]): void => {
  const misaligned = documents.flatMap((document) =>
    misalignedPlants(document, readText(set, document.clean).split("\n"), readText(set, document.planted).split("\n")),
  );
  if (misaligned.length === 0) return;
  misaligned.forEach((problem) => console.log(problem));
  throw new Error(`planted: ${set}/manifest.json does not match the documents`);
};

const readExpectation = (set: string): Expectation => {
  const path = join(ROOT, set, "expected.json");
  if (!existsSync(path)) throw new Error(`planted: ${path} is missing (yarn planted ${set} --update to record it)`);
  return parseExpectation(readJson(set, "expected.json"), `planted: ${path}`);
};

const printLines = (heading: string, lines: readonly string[]): void => {
  if (lines.length === 0) return;
  console.log(`\n${heading}`);
  lines.forEach((line) => console.log(line));
};

/** Scores one set and prints it with how it compares to expected.json (nothing to compare after --update). */
const runSet = async (set: string): Promise<ExpectationComparison> => {
  const documents = parseManifest(readJson(set, "manifest.json"));
  checkAlignment(set, documents);
  const recalls = recallByKind(documents, await runAll(set, documents, (document) => document.planted));
  const cleanLines = cleanFindingLines(documents, await runAll(set, documents, (document) => document.clean));

  console.log(`[${set}] Planted mistakes reported on their line, by kind (chaff --genre <genre>):`);
  formatRecall(recalls).forEach((line) => console.log(`  ${line}`));
  console.log(`\n[${set}] Findings of those rules on the clean documents: ${cleanLines.length === 0 ? "none" : ""}`);
  cleanLines.forEach((line) => console.log(`  ${line}`));

  const actual = expectationOf(recalls, cleanLines);
  if (update) {
    writeFileSync(join(ROOT, set, "expected.json"), `${JSON.stringify(actual, null, 2)}\n`);
    return { regressions: [], improvements: [] };
  }
  const comparison = compareToExpected(readExpectation(set), actual);
  const file = `test/fixtures/planted/${set}/expected.json`;
  printLines(`Worse than ${file} (fails; fix the rule, or yarn planted ${set} --update if it is intended):`, comparison.regressions);
  printLines(`Better than ${file} (passes; yarn planted ${set} --update to record):`, comparison.improvements);
  return comparison;
};

const orphans = requested.length === 0 && !update ? setsWithoutManifest(setsWith("expected.json"), setsWith("manifest.json")) : [];
const results = await pickSets(setsWith("manifest.json"), requested).reduce<Promise<[string, ExpectationComparison][]>>(async (previous, set) => {
  const done = await previous;
  if (done.length > 0) console.log("");
  return [...done, [set, await runSet(set)]];
}, Promise.resolve([]));

const setsWhere = (has: (comparison: ExpectationComparison) => readonly string[]): string[] =>
  results.filter(([, comparison]) => has(comparison).length > 0).map(([set]) => set);
const worse = setsWhere((comparison) => comparison.regressions);
const better = setsWhere((comparison) => comparison.improvements);
console.log("");
if (better.length > 0) console.log(`Better than expected.json (yarn planted <set> --update to record): ${better.join(", ")}`);
if (worse.length > 0) console.log(`Worse than expected.json: ${worse.join(", ")}`);
if (orphans.length > 0) console.log(`expected.json without manifest.json (a set disappeared): ${orphans.join(", ")}`);
if (worse.length > 0 || orphans.length > 0) process.exitCode = 1;
