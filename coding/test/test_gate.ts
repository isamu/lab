import { test } from "node:test";
import assert from "node:assert/strict";
import { judge, UNREASONED_SUPPRESSIONS } from "../packages/scoria/src/gate.ts";
import type { Confidence, DimensionReport, Report } from "../packages/scoria/src/report.ts";
import type { Finding } from "../packages/scoria/src/plugin.ts";

interface DimensionOptions {
  readonly confidence?: Confidence;
  readonly density?: boolean;
  readonly metric?: string;
}

const dimensionOf = (dimension: string, score: number, options: DimensionOptions = {}): DimensionReport => ({
  dimension,
  status: "experimental",
  score,
  coverage: 1,
  metrics: [
    {
      metric: options.metric ?? `${dimension}.thing`,
      value: 0,
      state: "ok",
      scale: { good: 0, bad: 10 },
      weight: 1,
      points: score,
      ...(options.density === true ? { density: true } : {}),
    },
  ],
  confidence: options.confidence ?? "high",
  confidenceReason: "",
});

interface ReportOptions {
  readonly sloc?: number;
  readonly metrics?: Readonly<Record<string, number>>;
  readonly findings?: readonly Finding[];
  readonly tools?: Readonly<Record<string, readonly string[]>>;
}

const reportOf = (dimensions: readonly DimensionReport[], options: ReportOptions = {}): Report => ({
  schemaVersion: 1,
  root: "/repo",
  label: "repo",
  profile: "app",
  stacks: ["ts"],
  complete: true,
  size: { files: 10, sloc: options.sloc ?? 1000, testSloc: 0 },
  dimensions,
  metrics: options.metrics ?? {},
  findings: options.findings ?? [],
  probes: Object.entries(options.tools ?? {}).map(([probe, tools]) => ({ probe, status: { kind: "ok" as const }, tools })),
  toolVersions: {},
  overall: { score: 0, scoredDimensions: dimensions.length, comparable: false },
});

const errorFinding = (rule: string, file: string): Finding => ({
  rule,
  severity: "error",
  file,
  line: 1,
  message: "",
  probe: "p",
  dimension: "correctness",
  tier: 0,
});

test("a dimension that fell past the tolerance fails the run", () => {
  const verdict = judge(reportOf([dimensionOf("readability", 90)]), reportOf([dimensionOf("readability", 80)]), []);
  assert.equal(verdict.failed, true);
  assert.deepEqual(verdict.reasons, [{ kind: "dimension", dimension: "readability", from: 90, to: 80 }]);
});

/** A tolerance exists because rounding is not a regression, and a gate that cries wolf is turned off. */
test("a dimension that moved by less than a point does not fail the run", () => {
  const verdict = judge(reportOf([dimensionOf("readability", 90)]), reportOf([dimensionOf("readability", 89.5)]), []);
  assert.equal(verdict.failed, false);
});

test("improving does not fail the run", () => {
  const verdict = judge(reportOf([dimensionOf("readability", 80)]), reportOf([dimensionOf("readability", 95)]), []);
  assert.equal(verdict.failed, false);
  assert.deepEqual(verdict.exemptions, []);
});

/** spec §17.3: a tool that makes every dependency bump look like decay is one nobody upgrades. */
test("a regression attributable to a tool upgrade is reported but not gated", () => {
  const tools = { oxlint: ["oxlint"] };
  const verdict = judge(
    reportOf([dimensionOf("readability", 90, { metric: "oxlint.violations" })], { tools }),
    reportOf([dimensionOf("readability", 70, { metric: "oxlint.violations" })], { tools }),
    ["oxlint"],
  );
  assert.equal(verdict.failed, false);
  assert.deepEqual(verdict.exemptions, [{ kind: "tool-version", dimension: "readability", tools: ["oxlint"] }]);
});

test("a tool that changed version exempts only the dimensions that used it", () => {
  const tools = { oxlint: ["oxlint"], audit: ["yarn"] };
  const before = [dimensionOf("readability", 90, { metric: "oxlint.violations" }), dimensionOf("security", 90, { metric: "audit.high" })];
  const after = [dimensionOf("readability", 70, { metric: "oxlint.violations" }), dimensionOf("security", 70, { metric: "audit.high" })];
  const verdict = judge(reportOf(before, { tools }), reportOf(after, { tools }), ["oxlint"]);
  assert.equal(verdict.failed, true);
  assert.deepEqual(
    verdict.reasons.map((reason) => (reason.kind === "dimension" ? reason.dimension : reason.kind)),
    ["security"],
  );
});

/** spec §15.4: where the measurement is untrustworthy, so is the regression. */
test("a low-confidence dimension is reported but not gated", () => {
  const verdict = judge(reportOf([dimensionOf("integrity", 90)]), reportOf([dimensionOf("integrity", 60, { confidence: "low" })]), []);
  assert.equal(verdict.failed, false);
  assert.deepEqual(verdict.exemptions, [{ kind: "low-confidence", dimension: "integrity" }]);
});

test("density metrics stop being gated once the repository changes size sharply", () => {
  const verdict = judge(
    reportOf([dimensionOf("readability", 90, { density: true })], { sloc: 1000 }),
    reportOf([dimensionOf("readability", 70, { density: true })], { sloc: 1400 }),
    [],
  );
  assert.equal(verdict.failed, false);
  assert.deepEqual(verdict.exemptions, [{ kind: "size-change", dimension: "readability", percent: 40 }]);
});

test("a dimension without density metrics is gated however much the repository grew", () => {
  const verdict = judge(reportOf([dimensionOf("architecture", 90)], { sloc: 1000 }), reportOf([dimensionOf("architecture", 70)], { sloc: 1400 }), []);
  assert.equal(verdict.failed, true);
});

test("an unexplained suppression added fails the run on its own", () => {
  const verdict = judge(reportOf([], { metrics: { [UNREASONED_SUPPRESSIONS]: 2 } }), reportOf([], { metrics: { [UNREASONED_SUPPRESSIONS]: 3 } }), []);
  assert.equal(verdict.failed, true);
  assert.deepEqual(verdict.reasons, [{ kind: "suppression", from: 2, to: 3 }]);
});

test("removing a suppression does not fail the run", () => {
  const verdict = judge(reportOf([], { metrics: { [UNREASONED_SUPPRESSIONS]: 3 } }), reportOf([], { metrics: { [UNREASONED_SUPPRESSIONS]: 1 } }), []);
  assert.equal(verdict.failed, false);
});

test("a new error finding fails the run", () => {
  const verdict = judge(reportOf([]), reportOf([], { findings: [errorFinding("no-any", "src/a.ts")] }), []);
  assert.deepEqual(verdict.reasons, [{ kind: "finding", rule: "no-any", file: "src/a.ts" }]);
});

/** Identity is rule plus file: a line number shifts when anything above it is edited. */
test("an error the baseline already had is not new", () => {
  const existing = { findings: [errorFinding("no-any", "src/a.ts")] };
  const verdict = judge(reportOf([], existing), reportOf([], existing), []);
  assert.equal(verdict.failed, false);
});

test("the same rule in a different file is a new finding", () => {
  const verdict = judge(
    reportOf([], { findings: [errorFinding("no-any", "src/a.ts")] }),
    reportOf([], { findings: [errorFinding("no-any", "src/a.ts"), errorFinding("no-any", "src/b.ts")] }),
    [],
  );
  assert.deepEqual(verdict.reasons, [{ kind: "finding", rule: "no-any", file: "src/b.ts" }]);
});

test("a warning is not a gate", () => {
  const warning: Finding = { ...errorFinding("untyped-source", "src/a.js"), severity: "warning" };
  const verdict = judge(reportOf([]), reportOf([], { findings: [warning] }), []);
  assert.equal(verdict.failed, false);
});

/** A dimension nothing could be measured in has no score to compare, and `?? 0` would invent one. */
test("a dimension with no score neither fails nor exempts", () => {
  const unmeasured: DimensionReport = { ...dimensionOf("architecture", 0), score: undefined, coverage: 0 };
  const verdict = judge(reportOf([dimensionOf("architecture", 90)]), reportOf([unmeasured]), []);
  assert.equal(verdict.failed, false);
  assert.deepEqual(verdict.exemptions, []);
});
