import { test } from "node:test";
import assert from "node:assert/strict";
import { renderChart } from "../packages/scoria/src/chart.ts";
import type { DimensionReport, Report } from "../packages/scoria/src/report.ts";
import type { ReportDiff } from "../packages/scoria/src/diff.ts";

const dimensionOf = (dimension: string, score: number | undefined): DimensionReport => ({
  dimension,
  status: "experimental",
  score,
  coverage: 1,
  metrics: [],
  confidence: "high",
  confidenceReason: "",
});

const reportOf = (dimensions: readonly DimensionReport[], label = "acme"): Report => ({
  schemaVersion: 1,
  root: "/repo",
  label,
  profile: "app",
  stacks: ["ts"],
  complete: true,
  size: { files: 1, sloc: 1, testSloc: 0 },
  dimensions,
  metrics: {},
  findings: [],
  probes: [],
  toolVersions: {},
  overall: { score: 0, scoredDimensions: dimensions.length, comparable: false },
});

const diffOf = (entries: readonly (readonly [string, number | undefined, number | undefined])[]): ReportDiff => ({
  dimensions: entries.map(([dimension, from, delta]) => ({ dimension, from, to: 0, delta })),
  movers: [],
  notComparable: [],
});

const chartOf = (report: Report, diff?: ReportDiff): string => renderChart(report, diff).join("\n");

test("the chart is a mermaid fence GitHub renders wherever it renders Markdown", () => {
  const chart = chartOf(reportOf([dimensionOf("readability", 72)]));
  assert.ok(chart.startsWith("```mermaid\nxychart-beta\n"));
  assert.ok(chart.trimEnd().endsWith("```"));
});

test("the bars are this run's scores, in dimension order", () => {
  const chart = chartOf(reportOf([dimensionOf("architecture", 94), dimensionOf("readability", 72)]));
  assert.ok(chart.includes('x-axis ["architecture", "readability"]'));
  assert.ok(chart.includes("bar [94, 72]"));
});

test("the title names what was measured", () => {
  assert.ok(chartOf(reportOf([dimensionOf("readability", 72)], "storefront")).includes('title "scoria · storefront"'));
});

/** A quote inside a label would close mermaid's own, so it is not left there. */
test("a label carrying a quote does not break the fence", () => {
  assert.ok(chartOf(reportOf([dimensionOf("readability", 72)], 'the "good" one')).includes("title \"scoria · the 'good' one\""));
});

/** A dimension nothing could be measured in has no bar; plotting it at zero would invent one. */
test("an unmeasured dimension is left out rather than drawn as zero", () => {
  const chart = chartOf(reportOf([dimensionOf("architecture", 94), dimensionOf("security", undefined)]));
  assert.ok(chart.includes('x-axis ["architecture"]'));
  assert.ok(chart.includes("bar [94]"));
});

test("a report with nothing measured draws nothing", () => {
  assert.deepEqual(renderChart(reportOf([dimensionOf("security", undefined)])), []);
});

test("the baseline is drawn as a line beside the bars", () => {
  const report = reportOf([dimensionOf("architecture", 94), dimensionOf("readability", 72)]);
  const chart = chartOf(
    report,
    diffOf([
      ["architecture", 95, -1],
      ["readability", 60, 12],
    ]),
  );
  assert.ok(chart.includes("bar [94, 72]"));
  assert.ok(chart.includes("line [95, 60]"));
});

/** A rubric change makes the old number a measurement of something else (§16.2). */
test("no baseline line is drawn when a dimension is not comparable", () => {
  const report = reportOf([dimensionOf("architecture", 94), dimensionOf("security", 100)]);
  const chart = chartOf(
    report,
    diffOf([
      ["architecture", 95, -1],
      ["security", undefined, undefined],
    ]),
  );
  assert.ok(!chart.includes("line ["));
});

test("no comparison means bars alone", () => {
  assert.ok(!chartOf(reportOf([dimensionOf("architecture", 94)])).includes("line ["));
});
