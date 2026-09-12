import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { expandTargets, nestedWithin, NoTargetsMatched, resolveTargets } from "../packages/scoria/src/targets.ts";

const repoWith = async (dirs: readonly string[], files: readonly string[] = []): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-targets-"));
  await Promise.all(dirs.map((dir) => mkdir(join(root, dir), { recursive: true })));
  await Promise.all(files.map((file) => writeFile(join(root, file), "", "utf8")));
  return root;
};

const namesOf = (paths: readonly string[]): readonly string[] => paths.map((path) => basename(path));

const kindsOf = (problems: readonly { readonly kind: string }[]): readonly string[] => problems.map((problem) => problem.kind);

/** Every config written before targets existed means "measure the directory I was pointed at". */
test("no patterns measures the directory itself", async () => {
  const root = await repoWith(["packages/a"]);
  assert.deepEqual(await expandTargets(root, []), [root]);
});

/**
 * `repo.json` §9.2: the repository root is a valid project path. `[".", "functions"]` is the
 * specification's own worked example, and expanding it to `functions` alone — silently, because
 * one of the two patterns matched — loses half the repository.
 */
test("`.` names the repository root", async () => {
  const root = await repoWith(["functions"]);
  const { paths, problems } = await resolveTargets(root, [".", "functions"]);
  assert.deepEqual(paths, [root, join(root, "functions")]);
  assert.deepEqual(problems, []);
});

test("a wildcard expands to each matching directory", async () => {
  const root = await repoWith(["packages/a", "packages/b", "packages/c"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*"])), ["a", "b", "c"]);
});

/** §9.3: declaration order is the author's order, and a wildcard expands in place. */
test("declaration order is kept, not sorted across patterns", async () => {
  const root = await repoWith(["packages/a", "agents/x", "docs"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*", "agents/*"])), ["a", "x"]);
});

/** §9.3: matches sort by UTF-16 code unit, which `localeCompare` does not agree with on case. */
test("wildcard matches sort by code unit, so `Z` precedes `a`", async () => {
  const root = await repoWith(["packages/a", "packages/Z", "packages/B"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*"])), ["B", "Z", "a"]);
});

test("a plain directory needs no wildcard", async () => {
  const root = await repoWith(["functions"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["functions"])), ["functions"]);
});

/** §9.3: one directory is one project, and the first entry naming it wins its position. */
test("a directory named twice keeps its first position and is reported", async () => {
  const root = await repoWith(["packages/a", "packages/b"]);
  const { paths, problems } = await resolveTargets(root, ["packages/b", "packages/*"]);
  assert.deepEqual(namesOf(paths), ["b", "a"]);
  assert.deepEqual(kindsOf(problems), ["duplicate"]);
});

test("files matching the pattern are not targets", async () => {
  const root = await repoWith(["packages/a"], ["packages/readme.md"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["packages/*"])), ["a"]);
});

/** §9.2: `**` and a `*` inside a longer segment are not defined by this version of repo.json. */
test("a glob dialect repo.json does not define is refused, not guessed at", async () => {
  const root = await repoWith(["packages/web", "packages/api/src"]);
  const deep = await resolveTargets(root, ["**/src"]);
  assert.deepEqual(deep.paths, []);
  assert.deepEqual(kindsOf(deep.problems), ["unsupported-pattern"]);
  const partial = await resolveTargets(root, ["packages/we*"]);
  assert.deepEqual(partial.paths, []);
  assert.deepEqual(kindsOf(partial.problems), ["unsupported-pattern"]);
});

test("a wildcard never matches a dot directory or a vendored one", async () => {
  const root = await repoWith(["node_modules/left-pad", "vendor/thing", ".github/workflows", "packages/a"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["*"])), ["packages"]);
  assert.deepEqual(namesOf(await expandTargets(root, ["*/*"])), ["a"]);
});

/** §6: a path that leaves the repository is rejected rather than clamped. */
test("a path escaping the repository is refused", async () => {
  const root = await repoWith(["packages/a"]);
  const { paths, problems } = await resolveTargets(root, ["../elsewhere"]);
  assert.deepEqual(paths, []);
  assert.deepEqual(kindsOf(problems), ["unsupported-pattern"]);
});

test("an absolute path is refused", async () => {
  const root = await repoWith(["packages/a"]);
  assert.deepEqual(kindsOf((await resolveTargets(root, ["/etc"])).problems), ["unsupported-pattern"]);
});

/** §9.3: measuring zero units and declaring success is the one outcome nobody notices is wrong. */
test("a wildcard matching nothing is reported", async () => {
  const root = await repoWith(["packages/a"]);
  const { paths, problems } = await resolveTargets(root, ["apps/*"]);
  assert.deepEqual(paths, []);
  assert.deepEqual(kindsOf(problems), ["no-match"]);
});

test("a named directory that does not exist is reported separately from an empty wildcard", async () => {
  const root = await repoWith(["packages/a"]);
  assert.deepEqual(kindsOf((await resolveTargets(root, ["functions"])).problems), ["missing"]);
});

test("nothing resolving at all is fatal for a run that has to measure something", async () => {
  const root = await repoWith(["packages/a"]);
  await assert.rejects(() => expandTargets(root, ["apps/*"]), NoTargetsMatched);
});

test("one bad pattern does not discard the good ones", async () => {
  const root = await repoWith(["packages/a"]);
  const { paths, problems } = await resolveTargets(root, ["apps/*", "packages/*"]);
  assert.deepEqual(namesOf(paths), ["a"]);
  assert.deepEqual(kindsOf(problems), ["no-match"]);
});

/** §9.4: a project's extent is its directory minus the directories of any nested projects. */
test("a nested target is named as nested within its parent", () => {
  const all = ["/repo", "/repo/functions", "/repo/packages/a"];
  assert.deepEqual(nestedWithin("/repo", all), ["/repo/functions", "/repo/packages/a"]);
  assert.deepEqual(nestedWithin("/repo/functions", all), []);
});

test("siblings are not nested in one another", () => {
  const all = ["/repo/packages/a", "/repo/packages/b"];
  assert.deepEqual(nestedWithin("/repo/packages/a", all), []);
});

/** A directory whose name merely starts with the parent's is not inside it. */
test("a name sharing a prefix is not a nested project", () => {
  const all = ["/repo/app", "/repo/app-server"];
  assert.deepEqual(nestedWithin("/repo/app", all), []);
});
