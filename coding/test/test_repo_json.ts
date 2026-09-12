import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { nameFor, readRepoJson } from "../packages/scoria/src/repo-json.ts";

const repoWith = async (contents: string): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-repo-json-"));
  await writeFile(join(root, "repo.json"), contents, "utf8");
  return root;
};

const pathsOf = (projects: readonly { readonly path: string }[]): readonly string[] => projects.map((entry) => entry.path);

/** §3.1: a directory without its own `repo.json` has none — a consumer MUST NOT look upward. */
test("a directory with no repo.json declares nothing", async () => {
  const root = await mkdtemp(join(tmpdir(), "scoria-repo-json-"));
  assert.deepEqual(await readRepoJson(root), { name: undefined, projects: [], extensions: {} });
});

test("malformed JSON declares nothing rather than failing the run", async () => {
  const root = await repoWith("{ this is not json");
  assert.deepEqual((await readRepoJson(root)).projects, []);
});

/** §5 and §9.1: a string is shorthand for a one-entry array; a string entry for `{ path }`. */
test("the shorthand forms expand", async () => {
  const one = await repoWith(JSON.stringify({ projects: "packages/*" }));
  assert.deepEqual(pathsOf((await readRepoJson(one)).projects), ["packages/*"]);
  const many = await repoWith(JSON.stringify({ projects: [".", "functions"] }));
  assert.deepEqual(pathsOf((await readRepoJson(many)).projects), [".", "functions"]);
});

test("an entry without a usable path is ignored", async () => {
  const root = await repoWith(JSON.stringify({ projects: [{ name: "nameless" }, { path: "" }, 7, { path: "apps" }] }));
  assert.deepEqual(pathsOf((await readRepoJson(root)).projects), ["apps"]);
});

/** §9.2: one entry standing for many directories cannot name them. */
test("a wildcard entry keeps its path and loses its name", async () => {
  const root = await repoWith(
    JSON.stringify({
      projects: [
        { path: "packages/*", name: "everything" },
        { path: "api", name: "API" },
      ],
    }),
  );
  const { projects } = await readRepoJson(root);
  assert.deepEqual(projects, [
    { path: "packages/*", name: undefined },
    { path: "api", name: "API" },
  ]);
});

/** §4.7: each value under `extensions` MUST be an object; one that is not is ignored. */
test("extensions keeps only the object entries", async () => {
  const root = await repoWith(JSON.stringify({ extensions: { scoria: { mode: "ratchet" }, broken: "not an object" } }));
  const { extensions } = await readRepoJson(root);
  assert.deepEqual(Object.keys(extensions), ["scoria"]);
  assert.deepEqual(extensions["scoria"], { mode: "ratchet" });
});

test("name is read, and an empty one is no name at all", async () => {
  assert.equal((await readRepoJson(await repoWith(JSON.stringify({ name: "ownplate" })))).name, "ownplate");
  assert.equal((await readRepoJson(await repoWith(JSON.stringify({ name: "" })))).name, undefined);
});

/** §10.1: a project's own file wins, then the parent's inline entry. */
test("a project's own name beats the parent's entry for it", () => {
  const own = { name: "web app", projects: [], extensions: {} };
  const parent = { name: "acme", projects: [{ path: "apps/web", name: "from parent" }], extensions: {} };
  assert.equal(nameFor(own, parent, "apps/web"), "web app");
});

test("the parent's entry names a project that does not name itself", () => {
  const own = { name: undefined, projects: [], extensions: {} };
  const parent = { name: "acme", projects: [{ path: "apps/web", name: "from parent" }], extensions: {} };
  assert.equal(nameFor(own, parent, "apps/web"), "from parent");
});

/** §10.1: five packages all called "acme platform" is worse than five called by their directories. */
test("a project never inherits the repository's name", () => {
  const own = { name: undefined, projects: [], extensions: {} };
  const parent = { name: "acme platform", projects: [{ path: "apps/web", name: undefined }], extensions: {} };
  assert.equal(nameFor(own, parent, "apps/web"), undefined);
});
