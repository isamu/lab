import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { BASELINE_PATH, changedTools, readBaseline, writeBaseline } from "../packages/scoria/src/baseline.ts";
import { buildReport } from "../packages/scoria/src/report.ts";
import type { ProbeResult } from "../packages/scoria/src/plugin.ts";
import type { Rubric } from "../packages/scoria/src/rubric.ts";

const rubrics: readonly Rubric[] = [
  {
    id: "readability",
    status: "experimental",
    metrics: [{ metric: "file-shape.sloc_p95", scale: { good: 150, bad: 800 }, weight: 1 }],
    confidenceFrom: [],
  },
];

const resultWith = (p95: number, toolVersions: Record<string, string> = {}): ProbeResult => ({
  probe: "file-shape",
  status: { kind: "ok" },
  metrics: [{ id: "file-shape.sloc_p95", value: p95, unit: "lines" }],
  findings: [],
  toolVersions,
  durationMs: 0,
});

const reportWith = (p95: number, toolVersions: Record<string, string> = {}) => buildReport("demo", [], [resultWith(p95, toolVersions)], rubrics);

const emptyDir = (): Promise<string> => mkdtemp(join(tmpdir(), "scoria-baseline-"));

test("a written baseline is read back", async () => {
  const root = await emptyDir();
  await writeBaseline(root, reportWith(200));
  const baseline = await readBaseline(root);
  assert.equal(baseline?.report.dimensions[0]?.score, 92.3077);
  assert.ok((baseline?.createdAt ?? "").length > 0);
});

test("the baseline lands at a committable path", async () => {
  const root = await emptyDir();
  const path = await writeBaseline(root, reportWith(200));
  assert.ok(path.endsWith(BASELINE_PATH));
  assert.match(await readFile(path, "utf8"), /"report"/);
});

test("no baseline is not an error", async () => {
  assert.equal(await readBaseline(await emptyDir()), undefined);
});

/** A tool that makes every dependency bump look like decay is one nobody upgrades (spec §17.3). */
test("a tool version change is reported so its movement is not read as regression", () => {
  const before = reportWith(200, { oxlint: "1.82.0" });
  const after = reportWith(400, { oxlint: "1.83.0" });
  assert.deepEqual(changedTools(before, after), ["oxlint"]);
});

test("an unchanged toolchain reports nothing to rebaseline", () => {
  const before = reportWith(200, { oxlint: "1.82.0" });
  const after = reportWith(400, { oxlint: "1.82.0" });
  assert.deepEqual(changedTools(before, after), []);
});

test("a corrupt baseline is ignored rather than crashing the run", async () => {
  const root = await emptyDir();
  await writeBaseline(root, reportWith(200));
  const { writeFile } = await import("node:fs/promises");
  await writeFile(join(root, BASELINE_PATH), "{ not json", "utf8");
  assert.equal(await readBaseline(root), undefined);
});
