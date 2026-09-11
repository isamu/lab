import { test } from "node:test";
import assert from "node:assert/strict";
import { sourceMix } from "../packages/scoria/src/probes/source-mix.ts";
import { contextOf, sourceFile } from "./helpers.ts";

const files = [
  sourceFile("src/a.ts", ["export const a = 1;"]),
  sourceFile("src/b.ts", ["export const b = 2;"]),
  sourceFile("src/legacy.js", ["module.exports = 3;"]),
];

const metricOf = (metrics: readonly { id: string; value: number }[], id: string): number => metrics.find((m) => m.id === id)?.value ?? -1;

test(".js を warning として報告し、.ts は報告しない", async () => {
  const result = await sourceMix.run(contextOf(files));
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.file, "src/legacy.js");
  assert.equal(result.findings[0]?.severity, "warning");
  assert.equal(result.findings[0]?.dimension, "type-safety");
});

test("型付きと型無しの比を出す", async () => {
  const result = await sourceMix.run(contextOf(files));
  assert.equal(metricOf(result.metrics, "source-mix.untyped_file_count"), 1);
  assert.equal(metricOf(result.metrics, "source-mix.typed_file_count"), 2);
  assert.ok(Math.abs(metricOf(result.metrics, "source-mix.untyped_file_ratio") - 1 / 3) < 1e-3);
});

/** JavaScript のプロジェクトに「TypeScript にしろ」と言うのはこの probe の仕事ではない。 */
test("typescript を持たない repo では skipped になる", async () => {
  const status = await sourceMix.detect(contextOf(files, { typescript: false, stacks: ["ts"] }));
  assert.equal(status.kind, "skipped");
});

test(".tsx は型付きとして数える", async () => {
  const withTsx = [sourceFile("src/App.tsx", ["export const App = () => null;"])];
  const result = await sourceMix.run(contextOf(withTsx));
  assert.equal(metricOf(result.metrics, "source-mix.untyped_file_count"), 0);
  assert.equal(metricOf(result.metrics, "source-mix.typed_file_count"), 1);
});
