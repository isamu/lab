import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expandTargets, NoTargetsMatched } from "../packages/scoria/src/targets.ts";

const repoWith = async (dirs: readonly string[], files: readonly string[] = []): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-targets-"));
  await Promise.all(dirs.map((dir) => mkdir(join(root, dir), { recursive: true })));
  await Promise.all(files.map((file) => writeFile(join(root, file), "", "utf8")));
  return root;
};

const namesOf = (paths: readonly string[]): readonly string[] => paths.map((path) => basename(path));

/** Every config written before targets existed means "measure the directory I was pointed at". */
test("no patterns measures the directory itself", async () => {
  const root = await repoWith(["packages/a"]);
  assert.deepEqual(await expandTargets(root, []), [root]);
});

test("a wildcard expands to each matching directory", async () => {
  const root = await repoWith(["packages/a", "packages/b", "packages/c"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*"])), ["a", "b", "c"]);
});

/** Ordering is by full path, so a run reports its targets the same way every time. */
test("several patterns combine, ordered by path", async () => {
  const root = await repoWith(["packages/a", "agents/x", "docs"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*", "agents/*"])), ["x", "a"]);
});

test("a plain directory needs no wildcard", async () => {
  const root = await repoWith(["functions"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["functions"])), ["functions"]);
});

/** Two patterns reaching the same directory is a config that reads fine and must not measure twice. */
test("overlapping patterns yield each directory once", async () => {
  const root = await repoWith(["packages/a"]);
  assert.equal((await expandTargets(root, ["packages/*", "packages/a"])).length, 1);
});

test("files matching the pattern are not targets", async () => {
  const root = await repoWith(["packages/a"], ["packages/readme.md"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*"])), ["a"]);
});

/** Measuring zero directories and reporting success is the one wrong outcome nobody would notice. */
test("a pattern that matches nothing is an error, not an empty run", async () => {
  const root = await repoWith(["packages/a"]);
  await assert.rejects(() => expandTargets(root, ["apps/*"]), NoTargetsMatched);
});

test("the error names the patterns, so the typo is visible", async () => {
  const root = await repoWith(["packages/a"]);
  await assert.rejects(
    () => expandTargets(root, ["apps/*", "srv"]),
    (error: unknown) => error instanceof NoTargetsMatched && error.patterns.join(",") === "apps/*,srv",
  );
});

test("node_modules is never a target", async () => {
  const root = await repoWith(["node_modules/left-pad", "packages/a"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["*/*"])), ["a"]);
});
