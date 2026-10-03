// yarn test: every test file under node --test. yarn test --part 2/5 runs the second of five parts (scripts/test-parts.ts),
// which CI runs side by side. Other options go to node before the files, where node --test reads them.
import { spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { parsePart, partFiles } from "./test-parts.ts";
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

const { part, parts, rest } = parsePart(process.argv.slice(2));
const files = partFiles(FILES, part, parts);
// Given no files, node --test would look for test files itself and run them all.
if (files.length === 0) throw new Error(`test: part ${part} of ${parts} has no test files`);
const run = spawnSync(process.execPath, ["--test", `--test-concurrency=${CONCURRENCY}`, ...rest, ...files], { stdio: "inherit", cwd: ROOT });
if (run.error !== undefined) throw new Error(`test: could not start ${process.execPath}`, { cause: run.error });
process.exitCode = run.status ?? 1;
