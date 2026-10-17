import type { Contributor, Finding, Metric, ProbeResult, ProbeStatus, SourceFile } from "./plugin.ts";
import type { MetricState, Rubric, ScoredDimension, ScoredMetric } from "./rubric.ts";
import type { Probe } from "./plugin.ts";
import { scoreDimension } from "./rubric.ts";
import { slocOf } from "./files.ts";
import { perKiloLines } from "./stats.ts";
import { judgeConfidence, type Confidence, type UnrunProbe } from "./confidence.ts";
import { basename } from "node:path";

/** Warning counts by rule. A hundred untyped files is one decision, not a hundred findings. */
export const tallyWarnings = (report: Report): readonly (readonly [string, number])[] => {
  const byRule = new Map<string, number>();
  report.findings.filter((finding) => finding.severity === "warning").forEach((finding) => byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1));
  return [...byRule.entries()];
};

export interface DimensionReport extends ScoredDimension {
  readonly confidence: Confidence;
  readonly confidenceReason: string;
}

export interface ProbeReport {
  readonly probe: string;
  readonly status: ProbeStatus;
  /**
   * The tools this probe ran. The merged `toolVersions` cannot say which probe a version belongs
   * to, and the ratchet needs exactly that: `yarn` changing version must exempt `security` and
   * nothing else (spec §17.3).
   */
  readonly tools: readonly string[];
}

export interface Report {
  readonly schemaVersion: 1;
  readonly root: string;
  /** What to call what was measured: `repo.json` §10.1, falling back to the directory name. */
  readonly label: string;
  readonly profile: string;
  readonly stacks: readonly string[];
  readonly complete: boolean;
  readonly size: { readonly files: number; readonly sloc: number; readonly testSloc: number };
  readonly dimensions: readonly DimensionReport[];
  /**
   * Every metric value a probe produced, including those no rubric scores (spec §17.1). A stored
   * score cannot answer "what moved"; the gate also needs values the rubrics do not weigh.
   */
  readonly metrics: Readonly<Record<string, number>>;
  readonly findings: readonly Finding[];
  readonly probes: readonly ProbeReport[];
  /** Versions of the external tools, so a score drop caused by an upgrade is not read as decay. */
  readonly toolVersions: Readonly<Record<string, string>>;
  readonly overall: {
    readonly score: number;
    /** How many dimensions the mean came from. A mean of two is not a mean of five. */
    readonly scoredDimensions: number;
    readonly comparable: false;
  };
}

const collectMetrics = (results: readonly ProbeResult[]): ReadonlyMap<string, number> =>
  new Map(results.flatMap((r) => r.metrics).map((m: Metric) => [m.id, m.value]));

/**
 * Every metric a rubric can reference, with why it has no value when it has none (spec §18.1).
 * A probe that did not run emits no metrics, so the state has to come from the probe's status.
 */
const collectStates = (results: readonly ProbeResult[], probes: readonly Probe[]): ReadonlyMap<string, MetricState> => {
  const states = new Map<string, MetricState>();
  results.flatMap((r) => r.metrics).forEach((m) => states.set(m.id, { kind: "ok", value: m.value }));
  const statusOf = new Map(results.map((r) => [r.probe, r.status]));
  probes.forEach((probe) =>
    probe.declares.forEach((id) => {
      if (states.has(id)) return;
      states.set(id, statusOf.get(probe.id)?.kind === "absent" ? { kind: "absent" } : { kind: "skipped" });
    }),
  );
  return states;
};

/**
 * Probes record which files drove a value; the rubric only turns numbers into points. Carrying the
 * contributors through is what lets `explain` answer "where", not just "how much".
 */
const collectContributors = (results: readonly ProbeResult[]): ReadonlyMap<string, readonly Contributor[]> =>
  new Map(results.flatMap((r) => r.metrics).flatMap((m: Metric) => (m.topContributors === undefined ? [] : [[m.id, m.topContributors] as const])));

const withContributors = (metrics: readonly ScoredMetric[], contributors: ReadonlyMap<string, readonly Contributor[]>): readonly ScoredMetric[] =>
  metrics.map((metric) => {
    const found = contributors.get(metric.metric);
    return found === undefined ? metric : { ...metric, topContributors: found };
  });

/** `<probe>.<metric>` is the contract every rubric id follows. */
const probeOfMetric = (metric: string): string => metric.split(".")[0] ?? "";

const NO_RESULT = "produced no result";

/** A probe with no result at all left its metrics as unmeasured as one that was skipped. */
const unrunReasonOf = (status: ProbeStatus | undefined): string | undefined => {
  if (status === undefined) return NO_RESULT;
  return status.kind === "skipped" && status.notApplicable !== true ? status.reason : undefined;
};

/** Probes that could have measured part of this dimension and did not, with the weight they left unmeasured. */
const unrunProbes = (rubric: Rubric, results: readonly ProbeResult[]): readonly UnrunProbe[] => {
  const status = new Map(results.map((result) => [result.probe, result.status]));
  const unrun = new Map<string, UnrunProbe>();
  rubric.metrics.forEach((rule) => {
    const probe = probeOfMetric(rule.metric);
    const reason = unrunReasonOf(status.get(probe));
    if (reason === undefined) return;
    unrun.set(probe, { probe, reason, weight: (unrun.get(probe)?.weight ?? 0) + rule.weight });
  });
  return [...unrun.values()];
};

/**
 * Dense suppressions mean the other probes saw less than the code holds (spec §15.4), and a probe
 * that could not run leaves part of the weight unmeasured. Either lowers confidence, not only points.
 */
const confidenceOf = (rubric: Rubric, values: ReadonlyMap<string, number>, results: readonly ProbeResult[], sloc: number) => {
  const suppressionCount = rubric.confidenceFrom.reduce((sum, id) => sum + (values.get(id) ?? 0), 0);
  return judgeConfidence({
    suppressionsPerKloc: rubric.confidenceFrom.length === 0 ? undefined : perKiloLines(suppressionCount, sloc),
    suppressionCount,
    totalWeight: rubric.metrics.reduce((sum, rule) => sum + rule.weight, 0),
    unrun: unrunProbes(rubric, results),
  });
};

/** One flat map of every tool version any probe reported, for the rebaseline check (spec §17.3). */
const mergedToolVersions = (results: readonly ProbeResult[]): Readonly<Record<string, string>> =>
  Object.fromEntries(results.flatMap((result) => Object.entries(result.toolVersions)));

const slocOfKind = (files: readonly SourceFile[], kind: SourceFile["kind"]): number =>
  files.filter((f) => f.kind === kind).reduce((sum, f) => sum + slocOf(f), 0);

const mean = (values: readonly number[]): number => (values.length === 0 ? 0 : Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(4)));

export interface ReportMeta {
  readonly profile: string;
  readonly stacks: readonly string[];
  readonly label?: string | undefined;
}

const DEFAULT_META: ReportMeta = { profile: "app", stacks: ["ts"] };

export const buildReport = (
  root: string,
  files: readonly SourceFile[],
  results: readonly ProbeResult[],
  rubrics: readonly Rubric[],
  meta: ReportMeta = DEFAULT_META,
  probes: readonly Probe[] = [],
): Report => {
  const values = collectMetrics(results);
  const states = collectStates(results, probes);
  const contributors = collectContributors(results);
  const sloc = slocOfKind(files, "source");
  const dimensions = rubrics.map((rubric) => {
    const scored = scoreDimension(rubric, states);
    const verdict = confidenceOf(rubric, values, results, sloc);
    return {
      ...scored,
      metrics: withContributors(scored.metrics, contributors),
      confidence: verdict.confidence,
      confidenceReason: verdict.reason,
    };
  });
  return {
    schemaVersion: 1,
    root,
    label: meta.label ?? basename(root),
    profile: meta.profile,
    stacks: meta.stacks,
    complete: results.every((r) => r.status.kind !== "skipped"),
    size: { files: files.length, sloc, testSloc: slocOfKind(files, "test") },
    dimensions,
    metrics: Object.fromEntries(values),
    findings: results.flatMap((r) => r.findings),
    probes: results.map((r) => ({ probe: r.probe, status: r.status, tools: Object.keys(r.toolVersions) })),
    toolVersions: mergedToolVersions(results),
    overall: {
      score: mean(dimensions.flatMap((d) => (d.score === undefined ? [] : [d.score]))),
      scoredDimensions: dimensions.filter((d) => d.score !== undefined).length,
      comparable: false,
    },
  };
};
