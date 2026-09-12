import { test } from "node:test";
import assert from "node:assert/strict";
import { diffReports } from "../packages/scoria/src/diff.ts";
import { buildReport } from "../packages/scoria/src/report.ts";
import type { Rubric } from "../packages/scoria/src/rubric.ts";
import type { ProbeResult, SourceFile } from "../packages/scoria/src/plugin.ts";
import { sourceFile } from "./helpers.ts";

const rubricOf = (metrics: Rubric["metrics"]): readonly Rubric[] => [{ id: "readability", status: "experimental", metrics, confidenceFrom: [] }];

const BOTH_METRICS: Rubric["metrics"] = [
  { metric: "file-shape.sloc_p95", scale: { good: 150, bad: 800 }, weight: 0.7 },
  { metric: "file-shape.god_file_count", scale: { good: 0, bad: 20 }, weight: 0.3 },
];

const ONE_METRIC: Rubric["metrics"] = [{ metric: "file-shape.sloc_p95", scale: { good: 150, bad: 800 }, weight: 1 }];

const files: readonly SourceFile[] = [sourceFile("a.ts", ["const a = 1;"])];

const resultWith = (p95: number, godFiles: number): ProbeResult => ({
  probe: "file-shape",
  status: { kind: "ok" },
  metrics: [
    { id: "file-shape.sloc_p95", value: p95, unit: "lines" },
    { id: "file-shape.god_file_count", value: godFiles, unit: "count" },
  ],
  findings: [],
  toolVersions: {},
  durationMs: 0,
});

const probeFor = (p95: number, godFiles: number) => ({
  kind: "probe" as const,
  id: "file-shape",
  apiVersion: 1 as const,
  tier: 0 as const,
  declares: ["file-shape.sloc_p95", "file-shape.god_file_count"],
  detect: () => Promise.resolve({ kind: "ok" as const }),
  run: () => Promise.resolve(resultWith(p95, godFiles)),
});

const reportUnder = (metrics: Rubric["metrics"], p95: number, godFiles: number) =>
  buildReport(".", files, [resultWith(p95, godFiles)], rubricOf(metrics), undefined, [probeFor(p95, godFiles)]);

const reportWith = (p95: number, godFiles: number) => reportUnder(BOTH_METRICS, p95, godFiles);

/**
 * The whole reason the scale is kept linear (spec §16.2, §26.3).
 * Introducing a non-linear curve fails this test immediately; it exists to defend that decision.
 */
test("mover points sum to the dimension delta", () => {
  const diff = diffReports(reportWith(200, 2), reportWith(400, 5));
  const delta = diff.dimensions.find((d) => d.dimension === "readability")?.delta ?? 0;
  const sum = diff.movers.filter((m) => m.dimension === "readability").reduce((acc, m) => acc + m.points, 0);
  assert.ok(Math.abs(delta - sum) < 1e-6, `delta ${delta} != Σ movers ${sum}`);
  assert.ok(delta < 0);
});

test("additivity holds for improvements too", () => {
  const diff = diffReports(reportWith(600, 9), reportWith(180, 1));
  const delta = diff.dimensions.find((d) => d.dimension === "readability")?.delta ?? 0;
  const sum = diff.movers.reduce((acc, m) => acc + m.points, 0);
  assert.ok(Math.abs(delta - sum) < 1e-6);
  assert.ok(delta > 0);
});

test("a metric that did not move is absent from movers", () => {
  const diff = diffReports(reportWith(200, 3), reportWith(400, 3));
  assert.deepEqual(
    diff.movers.map((m) => m.metric),
    ["file-shape.sloc_p95"],
  );
});

test("no change means no movers", () => {
  const diff = diffReports(reportWith(200, 3), reportWith(200, 3));
  assert.deepEqual(diff.movers, []);
});

/**
 * Adding a metric moves the dimension without the target changing, so the two numbers are not
 * measurements of the same thing. scoria's own `security` dimension read `+100` the first time it
 * existed, with `audit.critical` reported as the largest gain at `0 → 0`.
 */
test("a dimension the rubric changed under reports no delta and no movers", () => {
  const diff = diffReports(reportUnder(ONE_METRIC, 200, 3), reportUnder(BOTH_METRICS, 200, 3));
  assert.equal(diff.dimensions.find((d) => d.dimension === "readability")?.delta, undefined);
  assert.deepEqual(diff.movers, []);
  assert.deepEqual(diff.notComparable, ["readability"]);
});

test("dropping a metric is just as incomparable as adding one", () => {
  const diff = diffReports(reportUnder(BOTH_METRICS, 200, 3), reportUnder(ONE_METRIC, 200, 3));
  assert.deepEqual(diff.notComparable, ["readability"]);
});

test("an unchanged rubric still reports its movers", () => {
  const diff = diffReports(reportWith(200, 3), reportWith(400, 3));
  assert.deepEqual(diff.notComparable, []);
  assert.equal(diff.movers.length, 1);
});

/** A dimension that had no score has nothing to subtract from; `score ?? 0` would invent one. */
/**
 * Points are normalised over the measurable weight, so a metric carrying a dimension alone loses
 * most of its points the moment another one starts producing a value. When `coverage` first read a
 * report, `test_to_source_ratio` rose from 0.499 to 0.57 and was reported as `-69.8`.
 */
test("a dimension whose measurable weight changed is not comparable", () => {
  const before = reportWith(200, 3);
  const after = reportWith(200, 3);
  const narrowed = {
    ...before,
    dimensions: before.dimensions.map((entry) => ({ ...entry, coverage: 0.3 })),
  };
  const diff = diffReports(narrowed, after);
  assert.equal(diff.dimensions.find((d) => d.dimension === "readability")?.delta, undefined);
  assert.deepEqual(diff.movers, []);
  assert.deepEqual(diff.notComparable, ["readability"]);
});

test("a dimension nothing could be measured in is not comparable", () => {
  const unmeasured = buildReport(".", files, [], rubricOf(BOTH_METRICS), undefined, []);
  const diff = diffReports(unmeasured, reportWith(200, 3));
  assert.equal(diff.dimensions.find((d) => d.dimension === "readability")?.delta, undefined);
  assert.deepEqual(diff.notComparable, ["readability"]);
});
