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

test("reports .js as a warning and leaves .ts alone", async () => {
  const result = await sourceMix.run(contextOf(files));
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0]?.file, "src/legacy.js");
  assert.equal(result.findings[0]?.severity, "warning");
  assert.equal(result.findings[0]?.dimension, "type-safety");
});

test("reports the typed to untyped ratio", async () => {
  const result = await sourceMix.run(contextOf(files));
  assert.equal(metricOf(result.metrics, "source-mix.untyped_file_count"), 1);
  assert.equal(metricOf(result.metrics, "source-mix.typed_file_count"), 2);
  assert.ok(Math.abs(metricOf(result.metrics, "source-mix.untyped_file_ratio") - 1 / 3) < 1e-3);
});

/** Telling a JavaScript project to adopt TypeScript is not this probe's job. */
test("a repository without typescript is skipped", async () => {
  const status = await sourceMix.detect(contextOf(files, { typescript: false, installed: true, packageManager: "yarn", stacks: ["ts"] }));
  assert.equal(status.kind, "skipped");
});

test("counts .tsx as typed", async () => {
  const withTsx = [sourceFile("src/App.tsx", ["export const App = () => null;"])];
  const result = await sourceMix.run(contextOf(withTsx));
  assert.equal(metricOf(result.metrics, "source-mix.untyped_file_count"), 0);
  assert.equal(metricOf(result.metrics, "source-mix.typed_file_count"), 1);
});
