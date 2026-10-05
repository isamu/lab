// `yarn contracts`: the planted contract set (test/fixtures/contracts/). Each contract has a clean version and a planted
// one, and manifest.json lists every planted mistake with its kind, line and the rule expected to report it. Every
// document is run as `chaff --genre <genre>` would run it (the genre's levels, no other experimental rule), and the
// script prints how many planted mistakes of each kind were reported on their line, per language, and the findings the
// clean versions get from those rules. The score is compared with expected.json, and the run fails when it differs:
// a recall that dropped or rose, or a clean document that gained or lost a finding. --update rewrites expected.json.
import { readFileSync, writeFileSync } from "node:fs";
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
  recallByKind,
  type ContractDocument,
} from "./contracts-score.ts";

const DIR = join(import.meta.dirname, "..", "test", "fixtures", "contracts");
const EXPECTED = join(DIR, "expected.json");
const update = process.argv.includes("--update");

const readText = (file: string): string => {
  try {
    return readFileSync(join(DIR, file), "utf8");
  } catch (error) {
    throw new Error(`contracts: cannot read ${join(DIR, file)}`, { cause: error });
  }
};

const readJson = (file: string): unknown => JSON.parse(readText(file));

const findingsOf = async (document: ContractDocument, file: string): Promise<CorpusFinding[]> =>
  genreFindings(join(DIR, file), readText(file), document.language, document.genre);

const documents = parseManifest(readJson("manifest.json"));
const misaligned = documents.flatMap((document) => misalignedPlants(document, readText(document.clean).split("\n"), readText(document.planted).split("\n")));
if (misaligned.length > 0) {
  misaligned.forEach((problem) => console.log(problem));
  throw new Error("contracts: manifest.json does not match the documents");
}

const runAll = async (pick: (document: ContractDocument) => string): Promise<Map<string, CorpusFinding[]>> =>
  new Map(
    await documents.reduce<Promise<[string, CorpusFinding[]][]>>(
      async (previous, document) => [...(await previous), [document.id, await findingsOf(document, pick(document))]],
      Promise.resolve([]),
    ),
  );

const planted = await runAll((document) => document.planted);
const clean = await runAll((document) => document.clean);
const recalls = recallByKind(documents, planted);
const cleanLines = cleanFindingLines(documents, clean);

console.log("Planted mistakes reported on their line, by kind (chaff --genre <genre>):");
formatRecall(recalls).forEach((line) => console.log(`  ${line}`));
console.log(`\nFindings of those rules on the clean documents: ${cleanLines.length === 0 ? "none" : ""}`);
cleanLines.forEach((line) => console.log(`  ${line}`));

const actual = expectationOf(recalls, cleanLines);
if (update) writeFileSync(EXPECTED, `${JSON.stringify(actual, null, 2)}\n`);
const changes = update ? [] : expectationChanges(parseExpectation(readJson("expected.json")), actual);
if (changes.length > 0) {
  console.log("\nChanged from test/fixtures/contracts/expected.json (yarn contracts --update to accept):");
  changes.forEach((change) => console.log(change));
  process.exitCode = 1;
}
