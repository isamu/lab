// `yarn planted [set...]`: the planted sets (test/fixtures/planted/<set>/), every set when none is named. Each document of
// a set has a clean version and a planted one, and the set's manifest.json lists every planted mistake with its kind, line
// and the rule expected to report it. Every document is run as `chaff --genre <genre>` would run it (the genre's levels, no
// other experimental rule), under a chaff.yaml naming the document's style when the manifest gives one, and the script prints how many planted mistakes of each kind were reported on their line, per
// language, and the findings the clean versions get from those rules. The score is compared with the set's expected.json,
// and the run fails when it differs: a recall that dropped or rose, or a clean document that gained or lost a finding.
// --update rewrites the expected.json of the sets it ran. `yarn contracts` is `yarn planted contracts`.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { genreFindings, type CorpusFinding } from "./corpus-findings.ts";
import {
  cleanFindingLines,
  expectationChanges,
  expectationOf,
  formatRecall,
  misalignedPlants,
  parseExpectation,
  parseManifest,
  pickSets,
  recallByKind,
  type PlantedDocument,
} from "./planted-score.ts";

const ROOT = join(import.meta.dirname, "..", "test", "fixtures", "planted");
const update = process.argv.includes("--update");
const requested = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));

const availableSets = (): string[] => readdirSync(ROOT).filter((name) => existsSync(join(ROOT, name, "manifest.json")));

const readText = (set: string, file: string): string => {
  try {
    return readFileSync(join(ROOT, set, file), "utf8");
  } catch (error) {
    throw new Error(`planted: cannot read ${join(ROOT, set, file)}`, { cause: error });
  }
};

const readJson = (set: string, file: string): unknown => JSON.parse(readText(set, file));

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

/** Scores one set and prints it; true when the score is the committed one (or was just written). */
const runSet = async (set: string): Promise<boolean> => {
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
    return true;
  }
  const changes = expectationChanges(parseExpectation(readJson(set, "expected.json")), actual);
  if (changes.length === 0) return true;
  console.log(`\nChanged from test/fixtures/planted/${set}/expected.json (yarn planted ${set} --update to accept):`);
  changes.forEach((change) => console.log(change));
  return false;
};

const results = await pickSets(availableSets(), requested).reduce<Promise<boolean[]>>(async (previous, set) => {
  const done = await previous;
  if (done.length > 0) console.log("");
  return [...done, await runSet(set)];
}, Promise.resolve([]));
if (results.includes(false)) process.exitCode = 1;
