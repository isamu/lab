// Moves an expectation written as one file (the old test/fixtures/bench/expected.txt) into test/fixtures/bench/expected/.
// For a branch that still changes that file: take its version of the file, run this, and delete the file.
//   node scripts/bench-expected-split.ts <expected.txt>
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitBenchSummary } from "./bench-expected.ts";
import { MUTATIONS } from "./bench-mutations.ts";
import { BENCH } from "./bench-samples.ts";
import { writeExpectedDir } from "./expected-dir.ts";

const [source] = process.argv.slice(2);
if (source === undefined) {
  console.error("usage: node scripts/bench-expected-split.ts <expected.txt>");
  process.exitCode = 2;
} else {
  const lines = readFileSync(source, "utf8")
    .split("\n")
    .filter((line) => line !== "");
  writeExpectedDir(join(BENCH, "expected"), splitBenchSummary(lines, new Map(MUTATIONS.map((mutation) => [mutation.id, mutation.rule]))));
  console.log(`test/fixtures/bench/expected/: ${String(lines.length)} lines from ${source}`);
}
