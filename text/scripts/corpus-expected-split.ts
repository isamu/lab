// Moves an expectation written as one file (the old corpus/expected.txt, one line per document) into corpus/expected/.
// For a branch that still changes corpus/expected.txt: take its version of the file, run this, and delete the file.
//   node scripts/corpus-expected-split.ts <expected.txt>
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { splitSummary } from "./corpus-expected.ts";
import { writeExpectedDir } from "./expected-dir.ts";

const EXPECTED = join(dirname(fileURLToPath(import.meta.url)), "..", "corpus", "expected");

const [source] = process.argv.slice(2);
if (source === undefined) {
  console.error("usage: node scripts/corpus-expected-split.ts <expected.txt>");
  process.exitCode = 2;
} else {
  const lines = readFileSync(source, "utf8")
    .split("\n")
    .filter((line) => line !== "");
  writeExpectedDir(EXPECTED, splitSummary(lines));
  console.log(`corpus/expected/: ${String(lines.length)} documents from ${source}`);
}
