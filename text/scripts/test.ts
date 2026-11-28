// yarn test: every test file under node --test. yarn test --part 2/5 runs the second of five parts (scripts/test-parts.ts,
// balanced by the times in scripts/test-times.json),
// which CI runs side by side. --run pr leaves out the files scripts/test-skips.json lists for this platform. Other options go to node before the files, where node --test reads them.
import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePart } from "./test-parts.ts";
import { parseRun, parseSkipTable, runFiles, skippedFiles } from "./test-skips.ts";
import { parseTimesTable } from "./test-times.ts";
import { testWidth } from "./test-width.ts";

const ROOT = join(import.meta.dirname, "..");

/** The files of `test/test_*.<extension>` in a folder, as node --test's pattern would match them. */
const testFilesIn = (folder: string, extension: string): string[] =>
  readdirSync(join(ROOT, folder))
    .filter((name) => name.startsWith("test_") && name.endsWith(extension))
    .toSorted((left, right) => left.localeCompare(right, "en"))
    .map((name) => `${folder}/${name}`);

const FILES = [...testFilesIn("test", ".ts"), ...testFilesIn("examples/chaff-plugin-example/test", ".mjs")];

// node's default leaves one core idle; a test file spends part of its time starting up and reading files.
const CONCURRENCY = testWidth();

const { run: testRun, rest: afterRun } = parseRun(process.argv.slice(2));
const { part, parts, rest } = parsePart(afterRun);
const skipped = skippedFiles(parseSkipTable(readFileSync(join(import.meta.dirname, "test-skips.json"), "utf8")), process.platform, testRun);
if (skipped.length > 0) console.log(`test: left out on this ${process.platform} pull-request run (scripts/test-skips.json): ${skipped.join(", ")}`);
const times = parseTimesTable(readFileSync(join(import.meta.dirname, "test-times.json"), "utf8"));
const files = runFiles(FILES, part, parts, times, skipped);
// Given no files, node --test would look for test files itself and run them all.
if (files.length === 0) throw new Error(`test: part ${part} of ${parts} has no test files`);
const run = spawnSync(process.execPath, ["--test", `--test-concurrency=${CONCURRENCY}`, ...rest, ...files], { stdio: "inherit", cwd: ROOT });
if (run.error !== undefined) throw new Error(`test: could not start ${process.execPath}`, { cause: run.error });
process.exitCode = run.status ?? 1;
