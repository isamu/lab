import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PROBES } from "../packages/scoria/src/run.ts";
import { assertMetricsAreDeclared, loadRubrics } from "../packages/scoria/src/rubric-load.ts";

const here = dirname(fileURLToPath(import.meta.url));
const probeDirectory = join(here, "..", "packages", "scoria", "src", "probes");
const rubricDirectory = join(here, "..", "packages", "scoria", "rubrics");

const probeSources = async (): Promise<readonly { name: string; text: string }[]> => {
  const names = (await readdir(probeDirectory)).filter((n) => n.endsWith(".ts"));
  return Promise.all(names.map(async (name) => ({ name, text: await readFile(join(probeDirectory, name), "utf8") })));
};

/**
 * probe が直接プロセスを起動すると、版数の記録もタイムアウトも core を通らなくなる (spec §8, §26.2)。
 * fs を直接読むと、classify を迂回したファイル種別の判定が書けてしまう。
 */
test("probe は child_process と fs を直接使わない", async () => {
  const offenders = (await probeSources()).filter((s) => /from\s+"node:(child_process|fs)/.test(s.text)).map((s) => s.name);
  assert.deepEqual(offenders, []);
});

test("probe は 0-100 の点を返さない。正規化は rubric の仕事", async () => {
  const offenders = (await probeSources()).filter((s) => /unit:\s*"(score|points)"/.test(s.text)).map((s) => s.name);
  assert.deepEqual(offenders, []);
});

test("probe id は declares の接頭辞に一致する", () => {
  PROBES.forEach((probe) => {
    probe.declares.forEach((id) => assert.ok(id.startsWith(`${probe.id}.`), `${id} does not belong to ${probe.id}`));
  });
});

/**
 * 存在しない metric を参照する rubric は静かに 0 点になる。最も見つけにくい壊れ方（spec §26.2）。
 */
test("同梱の rubric が参照する metric は必ずどれかの probe が宣言している", async () => {
  const rubrics = await loadRubrics(rubricDirectory);
  const declared = new Set(PROBES.flatMap((p) => p.declares));
  assert.doesNotThrow(() => assertMetricsAreDeclared(rubrics, declared));
});

test("宣言されていない metric を参照する rubric は起動時に落ちる", () => {
  const broken = [
    { id: "x", status: "experimental" as const, metrics: [{ metric: "nope.missing", scale: { good: 0, bad: 1 }, weight: 1 }], confidenceFrom: [] },
  ];
  assert.throws(() => assertMetricsAreDeclared(broken, new Set(["real.metric"])), /nope\.missing/);
});

test("weight の合計が 1 でない rubric は読み込み時に落ちる", async () => {
  await assert.rejects(loadRubrics(join(here, "fixtures", "rubrics-broken")), /weights must sum to 1/);
});
