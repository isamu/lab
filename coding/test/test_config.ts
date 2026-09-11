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

test("vue の依存から vue stack を検出する", async () => {
  const root = await projectWith({ private: true, dependencies: { vue: "^3" }, devDependencies: { typescript: "^6" } });
  const config = await detectConfig(root);
  assert.ok(config.stacks.includes("vue"));
  assert.ok(config.stacks.includes("ts"));
  assert.equal(config.profile, "app");
});

test("react の依存から react stack を検出する", async () => {
  const root = await projectWith({ private: true, dependencies: { react: "^19" } });
  const config = await detectConfig(root);
  assert.ok(config.stacks.includes("react"));
});

test("bin を持つなら cli、公開される exports を持つなら library", async () => {
  const cli = await projectWith({ bin: { tool: "./x.js" } });
  assert.equal((await detectConfig(cli)).profile, "cli");
  const library = await projectWith({ exports: "./index.js" });
  assert.equal((await detectConfig(library)).profile, "library");
});

test("設定が無ければ frozen ではない", async () => {
  const root = await projectWith({ private: true });
  const loaded = await loadConfig(root);
  assert.equal(loaded.frozen, false);
  assert.equal(loaded.source, "detected");
});

test("書き出した設定は読み戻され、frozen になる", async () => {
  const root = await projectWith({ private: true, dependencies: { vue: "^3" } });
  await writeConfig(root, { profile: "app", stacks: ["ts"], mode: "report" });
  const loaded = await loadConfig(root);
  assert.equal(loaded.frozen, true);
  assert.equal(loaded.source, "config-file");
  assert.deepEqual(loaded.config.stacks, ["ts"]);
  const written: unknown = JSON.parse(await readFile(join(root, CONFIG_FILENAME), "utf8"));
  assert.ok(typeof written === "object");
});

/** 検出に勝手に追随すると、依存を 1 つ足しただけでスコアが飛ぶ（spec §9.2）。 */
test("設定と検出がずれたら drift として報告し、追随しない", async () => {
  const root = await projectWith({ private: true, dependencies: { vue: "^3" } });
  await writeConfig(root, { profile: "app", stacks: ["ts"], mode: "report" });
  const loaded = await loadConfig(root);
  assert.deepEqual(loaded.config.stacks, ["ts"]);
  assert.equal(loaded.drift.length, 1);
  assert.match(loaded.drift[0] ?? "", /vue/);
});

test("package.json の scoria キーからも読む", async () => {
  const root = await projectWith({ private: true, scoria: { profile: "cli", stacks: ["ts"], mode: "report" } });
  const loaded = await loadConfig(root);
  assert.equal(loaded.source, "package-json");
  assert.equal(loaded.config.profile, "cli");
});

test("サブディレクトリがあっても検出は package.json だけを見る", async () => {
  const root = await projectWith({ private: true });
  await mkdir(join(root, "src"), { recursive: true });
  assert.deepEqual((await detectConfig(root)).stacks, ["ts"]);
});
