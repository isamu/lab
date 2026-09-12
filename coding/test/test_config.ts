import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { detectConfig, loadConfig, writeConfig, CONFIG_FILENAME } from "../packages/scoria/src/config.ts";

const projectWith = async (pkg: Record<string, unknown>): Promise<string> => {
  const root = await mkdtemp(join(tmpdir(), "scoria-config-"));
  await writeFile(join(root, "package.json"), JSON.stringify(pkg), "utf8");
  return root;
};

test("detects the vue stack from a vue dependency", async () => {
  const root = await projectWith({ private: true, dependencies: { vue: "^3" }, devDependencies: { typescript: "^6" } });
  const config = await detectConfig(root);
  assert.ok(config.stacks.includes("vue"));
  assert.ok(config.stacks.includes("ts"));
  assert.equal(config.profile, "app");
});

test("detects the react stack from a react dependency", async () => {
  const root = await projectWith({ private: true, dependencies: { react: "^19" } });
  const config = await detectConfig(root);
  assert.ok(config.stacks.includes("react"));
});

test("bin means cli, published exports mean library", async () => {
  const cli = await projectWith({ bin: { tool: "./x.js" } });
  assert.equal((await detectConfig(cli)).profile, "cli");
  const library = await projectWith({ exports: "./index.js" });
  assert.equal((await detectConfig(library)).profile, "library");
});

test("without a config the run is not frozen", async () => {
  const root = await projectWith({ private: true });
  const loaded = await loadConfig(root);
  assert.equal(loaded.frozen, false);
  assert.equal(loaded.source, "detected");
});

test("a written config is read back and the run becomes frozen", async () => {
  const root = await projectWith({ private: true, dependencies: { vue: "^3" } });
  await writeConfig(root, { profile: "app", stacks: ["ts"], mode: "report", targets: [], lang: "en" });
  const loaded = await loadConfig(root);
  assert.equal(loaded.frozen, true);
  assert.equal(loaded.source, "config-file");
  assert.deepEqual(loaded.config.stacks, ["ts"]);
  const written: unknown = JSON.parse(await readFile(join(root, CONFIG_FILENAME), "utf8"));
  assert.ok(typeof written === "object");
});

/** Following detection silently means one added dependency moves the score (spec §9.2). */
test("disagreement is reported as drift and never followed", async () => {
  const root = await projectWith({ private: true, dependencies: { vue: "^3" } });
  await writeConfig(root, { profile: "app", stacks: ["ts"], mode: "report", targets: [], lang: "en" });
  const loaded = await loadConfig(root);
  assert.deepEqual(loaded.config.stacks, ["ts"]);
  assert.deepEqual(loaded.drift.added, ["vue"]);
  assert.deepEqual(loaded.drift.missing, []);
});

test("reads the scoria key in package.json too", async () => {
  const root = await projectWith({ private: true, scoria: { profile: "cli", stacks: ["ts"], mode: "report", lang: "en" } });
  const loaded = await loadConfig(root);
  assert.equal(loaded.source, "package-json");
  assert.equal(loaded.config.profile, "cli");
});

test("detection reads package.json only, whatever the tree contains", async () => {
  const root = await projectWith({ private: true });
  await mkdir(join(root, "src"), { recursive: true });
  assert.deepEqual((await detectConfig(root)).stacks, ["ts"]);
});
