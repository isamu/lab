import { test } from "node:test";
import assert from "node:assert/strict";
import { judgeConfidence, type ConfidenceInput, type UnrunProbe } from "../packages/scoria/src/confidence.ts";
import { buildReport } from "../packages/scoria/src/report.ts";
import type { ProbeResult, ProbeStatus } from "../packages/scoria/src/plugin.ts";
import type { Rubric } from "../packages/scoria/src/rubric.ts";
import { tsc } from "../packages/scoria/src/probes/tsc.ts";
import { uiToken } from "../packages/scoria/src/probes/ui-token.ts";
import { sourceMix } from "../packages/scoria/src/probes/source-mix.ts";
import { contextOf } from "./helpers.ts";

const inputOf = (overrides: Partial<ConfidenceInput> = {}): ConfidenceInput => ({
  suppressionsPerKloc: 0,
  suppressionCount: 0,
  totalWeight: 1,
  unrun: [],
  ...overrides,
});

const unrun = (probe: string, weight: number): UnrunProbe => ({ probe, weight, reason: `${probe} is not installed alongside scoria` });

test("nothing suppressed and everything run is high, saying how many suppressions it counted", () => {
  assert.deepEqual(judgeConfidence(inputOf()), { confidence: "high", reason: "0 suppressions in scope" });
});

test("a rubric with no suppression signal is high on that signal alone", () => {
  assert.deepEqual(judgeConfidence(inputOf({ suppressionsPerKloc: undefined })), { confidence: "high", reason: "no suppression signal wired" });
});

test("suppression density moves confidence at its two thresholds and not before", () => {
  const at = (perKloc: number) => judgeConfidence(inputOf({ suppressionsPerKloc: perKloc, suppressionCount: 7 })).confidence;
  assert.deepEqual([at(0.49), at(0.5), at(1.99), at(2), at(50)], ["high", "medium", "medium", "low", "low"]);
});

/** The property that outlives the old implementation: with every probe run, only suppressions decide. */
test("with every probe run, confidence follows suppression density alone", () => {
  const expected: readonly (readonly [number, string])[] = [
    [0, "high"],
    [0.1, "high"],
    [0.4999, "high"],
    [0.5, "medium"],
    [0.5001, "medium"],
    [1, "medium"],
    [1.9999, "medium"],
    [2, "low"],
    [2.0001, "low"],
    [10, "low"],
    [1000, "low"],
  ];
  expected.forEach(([perKloc, level]) => {
    assert.equal(judgeConfidence(inputOf({ suppressionsPerKloc: perKloc, suppressionCount: 3 })).confidence, level, `at ${perKloc}`);
  });
});

test("a probe that could not run lowers confidence and is named in the reason", () => {
  const verdict = judgeConfidence(inputOf({ unrun: [unrun("knip", 0.25)] }));
  assert.equal(verdict.confidence, "medium");
  assert.equal(verdict.reason, "not run: knip (knip is not installed alongside scoria)");
});

test("half the weight or more unmeasured is low", () => {
  assert.equal(judgeConfidence(inputOf({ unrun: [unrun("knip", 0.3), unrun("circular", 0.2)] })).confidence, "low");
  assert.equal(judgeConfidence(inputOf({ unrun: [unrun("knip", 0.49)] })).confidence, "medium");
});

test("the share is of the rubric's own total weight, not of 1", () => {
  assert.equal(judgeConfidence(inputOf({ totalWeight: 4, unrun: [unrun("knip", 1)] })).confidence, "medium");
  assert.equal(judgeConfidence(inputOf({ totalWeight: 4, unrun: [unrun("knip", 2)] })).confidence, "low");
});

test("the lower signal decides, and only its reason is given", () => {
  const verdict = judgeConfidence(inputOf({ suppressionsPerKloc: 5, suppressionCount: 40, unrun: [unrun("knip", 0.1)] }));
  assert.deepEqual(verdict, { confidence: "low", reason: "40 suppressions in scope" });
  const byUnrun = judgeConfidence(inputOf({ suppressionsPerKloc: 1, suppressionCount: 4, unrun: [unrun("knip", 0.6)] }));
  assert.deepEqual(byUnrun, { confidence: "low", reason: "not run: knip (knip is not installed alongside scoria)" });
});

test("when both signals land on the same level, both reasons are given", () => {
  const verdict = judgeConfidence(inputOf({ suppressionsPerKloc: 1, suppressionCount: 4, unrun: [unrun("knip", 0.1)] }));
  assert.deepEqual(verdict, { confidence: "medium", reason: "4 suppressions in scope; not run: knip (knip is not installed alongside scoria)" });
});

test("an empty or zero-weight rubric does not divide by zero", () => {
  assert.equal(judgeConfidence(inputOf({ totalWeight: 0, unrun: [unrun("knip", 0)] })).confidence, "high");
  assert.equal(judgeConfidence(inputOf({ unrun: [unrun("knip", 0)] })).confidence, "high");
});

const RUBRIC: Rubric = {
  id: "readability",
  status: "experimental",
  metrics: [
    { metric: "file-shape.p95", scale: { good: 0, bad: 1 }, weight: 0.75 },
    { metric: "jscpd.duplicated_lines_pct", scale: { good: 0, bad: 1 }, weight: 0.25 },
  ],
  confidenceFrom: [],
};

const resultOf = (probe: string, status: ProbeStatus, metrics: ProbeResult["metrics"] = []): ProbeResult => ({
  probe,
  status,
  metrics,
  findings: [],
  toolVersions: {},
  durationMs: 0,
});

const confidenceWith = (jscpd: ProbeStatus) => {
  const results = [resultOf("file-shape", { kind: "ok" }, [{ id: "file-shape.p95", value: 0, unit: "lines" }]), resultOf("jscpd", jscpd)];
  const dimension = buildReport(".", [], results, [RUBRIC]).dimensions[0];
  return { confidence: dimension?.confidence, reason: dimension?.confidenceReason };
};

test("in a report, a probe that could not run lowers its dimension's confidence", () => {
  assert.deepEqual(confidenceWith({ kind: "skipped", reason: "jscpd is not installed alongside scoria" }), {
    confidence: "medium",
    reason: "not run: jscpd (jscpd is not installed alongside scoria)",
  });
});

test("in a report, a probe that does not apply lowers nothing", () => {
  assert.equal(confidenceWith({ kind: "skipped", reason: "no .vue, .tsx or .jsx files", notApplicable: true }).confidence, "high");
});

/** absent means the project lacks something it ought to have; it is scored as zero, not left unmeasured. */
test("in a report, an absent probe is a measurement, not a gap", () => {
  assert.equal(confidenceWith({ kind: "absent", reason: "no source files" }).confidence, "high");
});

const tsProject = { typescript: true, installed: true, packageManager: "yarn" as const, stacks: ["ts"] };
const jsProject = { ...tsProject, typescript: false, stacks: [] };

test("the skips that mean 'nothing here to measure' say so, and only those", async () => {
  const noTsconfigJs = await tsc.detect(contextOf([], jsProject, []));
  const noTsconfigTs = await tsc.detect(contextOf([], tsProject, []));
  const noUi = await uiToken.detect(contextOf([], tsProject, []));
  const jsMix = await sourceMix.detect(contextOf([], jsProject, []));
  const flag = (status: ProbeStatus) => status.kind === "skipped" && status.notApplicable === true;
  assert.deepEqual([flag(noTsconfigJs), flag(noUi), flag(jsMix)], [true, true, true]);
  assert.equal(flag(noTsconfigTs), false);
  assert.equal(noTsconfigTs.kind, "skipped");
});

test("in a report, a probe with no result at all counts as not run", () => {
  const results = [resultOf("file-shape", { kind: "ok" }, [{ id: "file-shape.p95", value: 0, unit: "lines" }])];
  const dimension = buildReport(".", [], results, [RUBRIC]).dimensions[0];
  assert.equal(dimension?.confidence, "medium");
  assert.equal(dimension?.confidenceReason, "not run: jscpd (produced no result)");
});

/** A probe that ran and had nothing to say about one metric — no CLI, so no flags to document — measured what applies. */
test("in a report, a probe that ran but omitted one of its metrics lowers nothing", () => {
  const results = [resultOf("file-shape", { kind: "ok" }, [{ id: "file-shape.p95", value: 0, unit: "lines" }]), resultOf("jscpd", { kind: "ok" }, [])];
  assert.equal(buildReport(".", [], results, [RUBRIC]).dimensions[0]?.confidence, "high");
});
