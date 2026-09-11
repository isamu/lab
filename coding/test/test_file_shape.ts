import { test } from "node:test";
import assert from "node:assert/strict";
import { fileShape } from "../packages/scoria/src/probes/file-shape.ts";
import { contextOf, loadFixture } from "./helpers.ts";

const metricOf = (metrics: readonly { id: string; value: number }[], id: string): number => metrics.find((m) => m.id === id)?.value ?? -1;

test("大きなファイルを god file として報告する", async () => {
  const big = await loadFixture("file-shape/big.ts");
  const result = await fileShape.run(contextOf([big]));
  assert.equal(metricOf(result.metrics, "file-shape.god_file_count"), 1);
  assert.equal(metricOf(result.metrics, "file-shape.max_file_sloc"), 600);
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.dimension, "readability");
});

test("小さいファイルは god file にならない", async () => {
  const small = await loadFixture("file-shape/small.ts");
  const result = await fileShape.run(contextOf([small]));
  assert.equal(metricOf(result.metrics, "file-shape.god_file_count"), 0);
  assert.deepEqual(result.findings, []);
});

test("test ファイルは分母にも分子にも入らない", async () => {
  const big = await loadFixture("file-shape/big.ts", "test");
  const result = await fileShape.run(contextOf([big]));
  assert.equal(metricOf(result.metrics, "file-shape.source_file_count"), 0);
  assert.equal(metricOf(result.metrics, "file-shape.source_sloc"), 0);
});

test("p95 は最大値に引きずられない", async () => {
  const big = await loadFixture("file-shape/big.ts");
  const small = await loadFixture("file-shape/small.ts");
  const many = [small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, small, big];
  const result = await fileShape.run(contextOf(many));
  assert.equal(metricOf(result.metrics, "file-shape.max_file_sloc"), 600);
  assert.equal(metricOf(result.metrics, "file-shape.sloc_p95"), 1);
});
