// Runs chaff over the corpus. Statutes: the structure rules; a statute in force is internally consistent, so every
// finding there is a candidate false positive to explain. Documents of other kinds: every rule (as with --experimental)
// for the document's genre. Both are summarised per rule and compared with corpus/expected/ (scripts/corpus-expected.ts).
// --update rewrites those files; documents not fetched yet (yarn corpus:fetch) are skipped and keep their counts.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allFindings, corpusLanguages, structureFindings, type CorpusFinding } from "./corpus-findings.ts";
import { docEntries, docPath, parsedAs, summaryChanges, summaryLine, updatedSummary } from "./corpus-docs.ts";
import { joinSummary, splitSummary } from "./corpus-expected.ts";
import { readExpectedDir, writeExpectedDir } from "./expected-dir.ts";

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");
const LAWS = join(CORPUS, "laws");
const EXPECTED = join(CORPUS, "expected");
const manifest: unknown = JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"));
const languages = corpusLanguages(manifest);
const verbose = process.argv.includes("--verbose");
const update = process.argv.includes("--update");

const printFindings = (findings: readonly CorpusFinding[]): void => {
  if (verbose) findings.forEach((finding) => console.log(`  ${String(finding.line)}  ${finding.rule}  ${finding.message}`));
};

// 法令も、ほかの文書と同じく corpus/expected/ と比べる。施行中の法令に構造の指摘が出れば、それは chaff の後退。
const files = readdirSync(LAWS).filter((file) => file.endsWith(".txt"));
const lawLines = await files.reduce<Promise<string[]>>(async (previous, file) => {
  const lines = await previous;
  const findings = await structureFindings(file, readFileSync(join(LAWS, file), "utf8"), languages.get(file) ?? "ja");
  const line = summaryLine(
    file,
    findings.map((finding) => finding.rule),
  );
  console.log(line);
  printFindings(findings);
  return [...lines, line];
}, Promise.resolve([]));

const docLines = await docEntries(manifest).reduce<Promise<string[]>>(async (previous, doc) => {
  const lines = await previous;
  const path = docPath(CORPUS, doc);
  if (!existsSync(path)) {
    console.log(`${doc.id}  not fetched (yarn corpus:fetch ${doc.id})`);
    return lines;
  }
  const findings = await allFindings(parsedAs(doc), readFileSync(path, "utf8"), doc.language, doc.genre);
  const line = summaryLine(
    doc.id,
    findings.map((finding) => finding.rule),
  );
  console.log(line);
  printFindings(findings);
  return [...lines, line];
}, Promise.resolve([]));

const actual = [...lawLines, ...docLines];
const known = new Set([...files, ...docEntries(manifest).map((doc) => doc.id)]);
const expected = joinSummary(readExpectedDir(EXPECTED));
if (update) writeExpectedDir(EXPECTED, splitSummary(updatedSummary(expected, actual, known)));
const changes = update ? [] : summaryChanges(expected, actual, known);
if (changes.length > 0) {
  console.log("\nChanged from corpus/expected.txt (yarn corpus --update to accept):");
  changes.forEach((change) => console.log(change));
  process.exitCode = 1;
}
