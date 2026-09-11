import { test } from "node:test";
import assert from "node:assert/strict";
import { suppressionScan } from "../packages/scoria/src/probes/suppression-scan.ts";
import { contextOf, loadFixture } from "./helpers.ts";

const metricOf = (metrics: readonly { id: string; value: number }[], id: string): number => metrics.find((m) => m.id === id)?.value ?? -1;

test("reports nothing for correct code that is easy to false-positive on", async () => {
  const file = await loadFixture("suppression-scan/valid/decoys.ts");
  const result = await suppressionScan.run(contextOf([file]));
  assert.deepEqual(result.findings, []);
  assert.equal(metricOf(result.metrics, "suppression-scan.source_count"), 0);
});

test("a reasoned suppression is counted but is not a finding", async () => {
  const file = await loadFixture("suppression-scan/valid/reasoned.ts");
  const result = await suppressionScan.run(contextOf([file]));
  assert.equal(metricOf(result.metrics, "suppression-scan.source_count"), 2);
  assert.equal(metricOf(result.metrics, "suppression-scan.unreasoned_source_count"), 0);
  assert.deepEqual(result.findings, []);
});

test("an unreasoned suppression becomes an error finding", async () => {
  const file = await loadFixture("suppression-scan/invalid/unreasoned.ts");
  const result = await suppressionScan.run(contextOf([file]));
  assert.equal(metricOf(result.metrics, "suppression-scan.unreasoned_source_count"), 3);
  assert.equal(result.findings.length, 3);
  assert.ok(result.findings.every((f) => f.severity === "error"));
  assert.ok(result.findings.every((f) => f.dimension === "integrity"));
});

test("suppressions under test are counted apart from source", async () => {
  const source = await loadFixture("suppression-scan/invalid/unreasoned.ts", "source");
  const spec = await loadFixture("suppression-scan/invalid/unreasoned.ts", "test");
  const result = await suppressionScan.run(contextOf([source, spec]));
  assert.equal(metricOf(result.metrics, "suppression-scan.source_count"), 3);
  assert.equal(metricOf(result.metrics, "suppression-scan.test_count"), 3);
});

test("no source means absent, not skipped", async () => {
  const spec = await loadFixture("suppression-scan/invalid/unreasoned.ts", "test");
  const status = await suppressionScan.detect(contextOf([spec]));
  assert.equal(status.kind, "absent");
});
