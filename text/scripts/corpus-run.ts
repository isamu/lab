// Runs chaff over the corpus. Statutes: the structure rules, grouped by rule; a statute in force is internally
// consistent, so every finding there is a candidate false positive to explain. Documents of other kinds: every rule
// (as with --experimental) for the document's genre, summarised per rule and compared with corpus/expected.txt.
// --update rewrites that file; documents not fetched yet (yarn corpus:fetch) are skipped and keep their line.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { allFindings, corpusLanguages, structureFindings, type CorpusFinding } from "./corpus-findings.ts";
import { docEntries, docPath, parsedAs, summaryChanges, summaryLine, updatedSummary } from "./corpus-docs.ts";

const CORPUS = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus");
const LAWS = join(CORPUS, "laws");
const EXPECTED = join(CORPUS, "expected.txt");
const manifest: unknown = JSON.parse(readFileSync(join(CORPUS, "manifest.json"), "utf8"));
const languages = corpusLanguages(manifest);
const verbose = process.argv.includes("--verbose");
const update = process.argv.includes("--update");

const summaryOf = (findings: readonly CorpusFinding[]): string => {
  const counts = findings.reduce<Record<string, number>>((acc, finding) => ({ ...acc, [finding.rule]: (acc[finding.rule] ?? 0) + 1 }), {});
  const parts = Object.entries(counts).map(([rule, count]) => `${rule} ${String(count)}`);
  return parts.length === 0 ? "clean" : parts.join(", ");
};

const printFindings = (findings: readonly CorpusFinding[]): void => {
  if (verbose) findings.forEach((finding) => console.log(`  ${String(finding.line)}  ${finding.rule}  ${finding.message}`));
};

const files = readdirSync(LAWS).filter((file) => file.endsWith(".txt"));
await files.reduce<Promise<void>>(async (previous, file) => {
  await previous;
  const findings = await structureFindings(file, readFileSync(join(LAWS, file), "utf8"), languages.get(file) ?? "ja");
  console.log(`${file}  ${summaryOf(findings)}`);
  printFindings(findings);
}, Promise.resolve());

const actual = await docEntries(manifest).reduce<Promise<string[]>>(async (previous, doc) => {
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

const known = new Set(docEntries(manifest).map((doc) => doc.id));
const expected = existsSync(EXPECTED)
  ? readFileSync(EXPECTED, "utf8")
      .split("\n")
      .filter((line) => line !== "")
  : [];
if (update) writeFileSync(EXPECTED, `${updatedSummary(expected, actual, known).join("\n")}\n`);
const changes = update ? [] : summaryChanges(expected, actual, known);
if (changes.length > 0) {
  console.log("\nChanged from corpus/expected.txt (yarn corpus --update to accept):");
  changes.forEach((change) => console.log(change));
  process.exitCode = 1;
}
