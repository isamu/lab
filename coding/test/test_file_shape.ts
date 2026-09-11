import { test } from "node:test";
import assert from "node:assert/strict";
import { fileShape } from "../packages/scoria/src/probes/file-shape.ts";
import { contextOf, loadFixture } from "./helpers.ts";

const metricOf = (metrics: readonly { id: string; value: number }[], id: string): number => metrics.find((m) => m.id === id)?.value ?? -1;

test("reports a large file as a god file", async () => {
  const big = await loadFixture("file-shape/big.ts");
  const result = await fileShape.run(contextOf([big]));
  assert.equal(metricOf(result.metrics, "file-shape.god_file_count"), 1);
  assert.equal(metricOf(result.metrics, "file-shape.max_file_sloc"), 600);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.dimension, "readability");
});

test("a small file is not a god file", async () => {
  const small = await loadFixture("file-shape/small.ts");
  const result = await fileShape.run(contextOf([small]));
  assert.equal(metricOf(result.metrics, "file-shape.god_file_count"), 0);
  assert.deepEqual(result.findings, []);
});

test("test files count toward neither numerator nor denominator", async () => {
  const big = await loadFixture("file-shape/big.ts", "test");
  const result = await fileShape.run(contextOf([big]));
  assert.equal(metricOf(result.metrics, "file-shape.source_file_count"), 0);
  assert.equal(metricOf(result.metrics, "file-shape.source_sloc"), 0);
});

test("p95 is not dragged by the maximum", async () => {
  const big = await loadFixture("file-shape/big.ts");
  const small = await loadFixture("file-shape/small.ts");
  const many = [small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, big];
  const result = await fileShape.run(contextOf(many));
  assert.equal(metricOf(result.metrics, "file-shape.max_file_sloc"), 600);
  assert.equal(metricOf(result.metrics, "file-shape.sloc_p95"), 1);
});
