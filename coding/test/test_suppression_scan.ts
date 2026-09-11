import { test } from "node:test";
import assert from "node:assert/strict";
import { suppressionScan } from "../packages/scoria/src/probes/suppression-scan.ts";
import { contextOf, loadFixture } from "./helpers.ts";

const metricOf = (metrics: readonly { id: string; value: number }[], id: string): number => metrics.find((m) => m.id === id)?.value ?? -1;

test("誤検知しやすい正常なコードから 1 件も出さない", async () => {
  const file = await loadFixture("suppression-scan/valid/decoys.ts");
  const result = await suppressionScan.run(contextOf([file]));
  assert.deepEqual(result.findings, []);
  assert.equal(metricOf(result.metrics, "suppression-scan.source_count"), 0);
});

test("理由の書かれた抑制は数えるが、findings にはしない", async () => {
  const file = await loadFixture("suppression-scan/valid/reasoned.ts");
  const result = await suppressionScan.run(contextOf([file]));
  assert.equal(metricOf(result.metrics, "suppression-scan.source_count"), 2);
  assert.equal(metricOf(result.metrics, "suppression-scan.unreasoned_source_count"), 0);
  assert.deepEqual(result.findings, []);
});

test("理由の無い抑制は error の finding になる", async () => {
  const file = await loadFixture("suppression-scan/invalid/unreasoned.ts");
  const result = await suppressionScan.run(contextOf([file]));
  assert.equal(metricOf(result.metrics, "suppression-scan.unreasoned_source_count"), 3);
  assert.equal(result.findings.length, 3);
  assert.ok(result.findings.every((f) => f.severity === "error"));
  assert.ok(result.findings.every((f) => f.dimension === "integrity"));
});

test("test 配下の抑制は source と分けて数える", async () => {
  const source = await loadFixture("suppression-scan/invalid/unreasoned.ts", "source");
  const spec = await loadFixture("suppression-scan/invalid/unreasoned.ts", "test");
  const result = await suppressionScan.run(contextOf([source, spec]));
  assert.equal(metricOf(result.metrics, "suppression-scan.source_count"), 3);
  assert.equal(metricOf(result.metrics, "suppression-scan.test_count"), 3);
});

test("source が無ければ absent。skipped ではない", async () => {
  const spec = await loadFixture("suppression-scan/invalid/unreasoned.ts", "test");
  const status = await suppressionScan.detect(contextOf([spec]));
  assert.equal(status.kind, "absent");
});
