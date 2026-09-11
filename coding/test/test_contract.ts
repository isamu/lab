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
 * A probe that spawns directly takes version recording and timeouts out of the core's hands
 * (spec §8, §26.2). Reading fs directly would let it decide file kinds behind classify's back.
 */
test("probes do not use child_process or fs directly", async () => {
  const offenders = (await probeSources()).filter((s) => /from\s+"node:(child_process|fs)/.test(s.text)).map((s) => s.name);
  assert.deepEqual(offenders, []);
});

test("probes do not return scores; normalising is the rubric's job", async () => {
  const offenders = (await probeSources()).filter((s) => /unit:\s*"(score|points)"/.test(s.text)).map((s) => s.name);
  assert.deepEqual(offenders, []);
});

test("every declared metric id is prefixed with its probe id", () => {
  PROBES.forEach((probe) => {
    probe.declares.forEach((id) => assert.ok(id.startsWith(`${probe.id}.`), `${id} does not belong to ${probe.id}`));
  });
});

/** A rubric referencing a missing metric scores a silent zero — the hardest failure to spot (spec §26.2). */
test("every metric the bundled rubrics reference is declared by some probe", async () => {
  const rubrics = await loadRubrics(rubricDirectory);
  const declared = new Set(PROBES.flatMap((p) => p.declares));
  assert.doesNotThrow(() => assertMetricsAreDeclared(rubrics, declared));
});

test("a rubric referencing an undeclared metric fails at startup", () => {
  const broken = [
    { id: "x", status: "experimental" as const, metrics: [{ metric: "nope.missing", scale: { good: 0, bad: 1 }, weight: 1 }], confidenceFrom: [] },
  ];
  assert.throws(() => assertMetricsAreDeclared(broken, new Set(["real.metric"])), /nope\.missing/);
});

test("a rubric whose weights do not sum to 1 fails to load", async () => {
  await assert.rejects(loadRubrics(join(here, "fixtures", "rubrics-broken")), /weights must sum to 1/);
});
