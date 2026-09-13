import { test } from "node:test";
import assert from "node:assert/strict";
import { readmeContract } from "../packages/scoria/src/probes/readme-contract.ts";
import { commentQuality } from "../packages/scoria/src/probes/comment-quality.ts";
import { contextWith, sourceFile } from "./helpers.ts";
import type { Metric } from "../packages/scoria/src/plugin.ts";

const valueOf = (metrics: readonly Metric[], id: string): number | undefined => metrics.find((metric) => metric.id === id)?.value;

const readmeOf = (text: string | undefined) => (): Promise<string | undefined> => Promise.resolve(text);

const cli = (...flags: readonly string[]): ReturnType<typeof sourceFile> =>
  sourceFile("src/cli.ts", ["const parse = (argv: readonly string[]) => ({", ...flags.map((flag) => `  ${flag.slice(2)}: argv.includes("${flag}"),`), "});"]);

test("a missing README is measured, not skipped", async () => {
  const result = await readmeContract.run(contextWith([], { readText: readmeOf(undefined) }));
  assert.equal(valueOf(result.metrics, "readme-contract.has_readme"), 0);
  assert.equal(valueOf(result.metrics, "readme-contract.readme_words"), 0);
});

test("a README is counted in words, not bytes", async () => {
  const result = await readmeContract.run(contextWith([], { readText: readmeOf("# Thing\n\nIt does a thing you wanted done.\n") }));
  assert.equal(valueOf(result.metrics, "readme-contract.has_readme"), 1);
  assert.equal(valueOf(result.metrics, "readme-contract.readme_words"), 9);
});

/** The half that rots: adding a flag and documenting it are separate acts, and only one ships. */
test("flags in the source are checked against the README", async () => {
  const files = [cli("--verbose", "--dry-run")];
  const documented = await readmeContract.run(contextWith(files, { readText: readmeOf("Run it with --verbose or --dry-run.") }));
  assert.equal(valueOf(documented.metrics, "readme-contract.documented_flag_ratio"), 1);

  const half = await readmeContract.run(contextWith(files, { readText: readmeOf("Run it with --verbose.") }));
  assert.equal(valueOf(half.metrics, "readme-contract.documented_flag_ratio"), 0.5);
  assert.deepEqual(
    half.findings.map((finding) => finding.rule),
    ["undocumented-flags"],
  );
});

/** A project with no flags is not a project with undocumented flags. */
test("a project accepting no flags skips the ratio rather than scoring zero", async () => {
  const result = await readmeContract.run(contextWith([sourceFile("src/lib.ts", ["export const a = 1;"])], { readText: readmeOf("# Library") }));
  assert.equal(valueOf(result.metrics, "readme-contract.documented_flag_ratio"), undefined);
});

/**
 * Most flag strings in a program are arguments it passes to something else. scoria's own source
 * mentions 24 and only 8 are its own; demanding a README document jscpd's `--min-tokens` is the
 * kind of false positive that teaches people to ignore the finding.
 */
test("flags a program passes to another program are not its own", async () => {
  const files = [cli("--verbose"), sourceFile("src/run.ts", ['const args = ["--min-tokens", "50", "--reporters", "json"];'])];
  const result = await readmeContract.run(contextWith(files, { readText: readmeOf("Run it with --verbose.") }));
  assert.equal(valueOf(result.metrics, "readme-contract.documented_flag_ratio"), 1);
});

/**
 * A file that both parses its own arguments and launches another program contributes that
 * program's options too, which is the false positive the whole search has been narrowing away from.
 */
test("a file that reads argv and also spawns a tool contributes no flags", async () => {
  const files = [sourceFile("src/cli.ts", ['const flag = argv.includes("--verbose");', 'execFile("jscpd", ["--min-tokens", "50"]);'])];
  const result = await readmeContract.run(contextWith(files, { readText: readmeOf("# Thing") }));
  assert.equal(valueOf(result.metrics, "readme-contract.documented_flag_ratio"), undefined);
});

test("a flag named only in a comment is not a flag the program accepts", async () => {
  const files = [sourceFile("src/cli.ts", ["// pass --verbose to argv one day", "const n = process.argv.length;"])];
  const result = await readmeContract.run(contextWith(files, { readText: readmeOf("# Thing") }));
  assert.equal(valueOf(result.metrics, "readme-contract.documented_flag_ratio"), undefined);
});

test("unfinished markers are counted per thousand lines of code", async () => {
  const files = [sourceFile("src/a.ts", ["// TODO: handle the empty case", "export const a = 1;", "// FIXME: this is wrong", "export const b = 2;"])];
  const result = await commentQuality.run(contextWith(files));
  assert.equal(valueOf(result.metrics, "comment-quality.marker_count"), 2);
  assert.deepEqual(
    result.findings.map((finding) => finding.line),
    [1, 3],
  );
});

/** A marker is a note in a comment. The same word in code or a string is not one. */
test("a marker in code or in a string is not a marker", async () => {
  const files = [sourceFile("src/a.ts", ['const TODO_LIST = ["TODO"];', "export const todo = TODO_LIST;"])];
  const result = await commentQuality.run(contextWith(files));
  assert.equal(valueOf(result.metrics, "comment-quality.marker_count"), 0);
});

test("comment density is reported, for reading rather than scoring", async () => {
  const files = [sourceFile("src/a.ts", ["// one", "// two", "export const a = 1;", "export const b = 2;"])];
  const result = await commentQuality.run(contextWith(files));
  assert.equal(valueOf(result.metrics, "comment-quality.comment_density"), 1);
});
