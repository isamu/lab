import type { Finding } from "./plugin.ts";
import type { DimensionReport, Report } from "./report.ts";

/**
 * Whether a run should fail CI (spec §17.2).
 *
 * The default mode gates nothing. A tool that turns CI red on the day it is installed is one nobody
 * keeps, so `report` is where every repository starts and `ratchet` is opted into once the baseline
 * has settled.
 *
 * What the ratchet refuses to gate matters as much as what it gates. A linter upgrade adds rules and
 * the score falls; gating that teaches a team not to upgrade, which is the opposite of the point.
 */

/** Below this, a dimension moved by rounding rather than by anything anyone did. */
const TOLERANCE_POINTS = 1;

/** Past this, a density metric is measuring a different denominator (spec §17.2). */
const SIZE_CHANGE = 0.2;

export const UNREASONED_SUPPRESSIONS = "suppression-scan.unreasoned_source_count";

export type GateReason =
  | { readonly kind: "dimension"; readonly dimension: string; readonly from: number; readonly to: number }
  | { readonly kind: "suppression"; readonly from: number; readonly to: number }
  | { readonly kind: "finding"; readonly rule: string; readonly file: string };

export type Exemption =
  | { readonly kind: "low-confidence"; readonly dimension: string }
  | { readonly kind: "tool-version"; readonly dimension: string; readonly tools: readonly string[] }
  | { readonly kind: "size-change"; readonly dimension: string; readonly percent: number };

export interface Verdict {
  readonly failed: boolean;
  readonly reasons: readonly GateReason[];
  /** Regressions deliberately not gated. Silence here would read as "nothing regressed". */
  readonly exemptions: readonly Exemption[];
}

const scoreOf = (report: Report, dimension: string): number | undefined => report.dimensions.find((d) => d.dimension === dimension)?.score;

const metricValue = (report: Report, metric: string): number | undefined => report.metrics[metric];

/** `<probe>.<metric>` is the contract every rubric id follows, and the probe owns the tools. */
const probesOf = (dimension: DimensionReport): readonly string[] => [...new Set(dimension.metrics.map((m) => m.metric.split(".")[0] ?? ""))];

const toolsOf = (report: Report, dimension: DimensionReport): readonly string[] => {
  const probes = probesOf(dimension);
  return report.probes.filter((probe) => probes.includes(probe.probe)).flatMap((probe) => probe.tools);
};

const sizeChange = (baseline: Report, current: Report): number => {
  const before = baseline.size.sloc;
  return before === 0 ? 0 : Math.abs(current.size.sloc - before) / before;
};

const hasDensity = (dimension: DimensionReport): boolean => dimension.metrics.some((metric) => metric.density === true);

/** Regressed, but for a reason about the measurement rather than about the code. */
const exemptionFor = (dimension: DimensionReport, baseline: Report, current: Report, changedTools: readonly string[]): Exemption | undefined => {
  if (dimension.confidence === "low") return { kind: "low-confidence", dimension: dimension.dimension };
  const moved = [...new Set(toolsOf(current, dimension).filter((tool) => changedTools.includes(tool)))];
  if (moved.length > 0) return { kind: "tool-version", dimension: dimension.dimension, tools: moved };
  const change = sizeChange(baseline, current);
  if (hasDensity(dimension) && change >= SIZE_CHANGE) return { kind: "size-change", dimension: dimension.dimension, percent: Math.round(change * 100) };
  return undefined;
};

const regressed = (baseline: Report, dimension: DimensionReport): boolean => {
  const before = scoreOf(baseline, dimension.dimension);
  return before !== undefined && dimension.score !== undefined && dimension.score < before - TOLERANCE_POINTS;
};

/** A suppression is not wrong in itself; an unexplained new one is (spec §15.5). */
const suppressionReasons = (baseline: Report, current: Report): readonly GateReason[] => {
  const before = metricValue(baseline, UNREASONED_SUPPRESSIONS);
  const after = metricValue(current, UNREASONED_SUPPRESSIONS);
  if (before === undefined || after === undefined || after <= before) return [];
  return [{ kind: "suppression", from: before, to: after }];
};

/** Identity is rule plus file: a line number shifts when anything above it is edited. */
const errorIdsIn = (report: Report): ReadonlySet<string> =>
  new Set(report.findings.filter((finding) => finding.severity === "error").map((finding) => `${finding.rule} ${finding.file}`));

const newErrors = (baseline: Report, current: Report): readonly GateReason[] => {
  const before = errorIdsIn(baseline);
  const errors = current.findings.filter((finding: Finding) => finding.severity === "error");
  const unseen = [...new Set(errors.map((finding) => `${finding.rule} ${finding.file}`))].filter((id) => !before.has(id));
  return unseen.flatMap((id) => {
    const found = errors.find((finding) => `${finding.rule} ${finding.file}` === id);
    return found === undefined ? [] : [{ kind: "finding" as const, rule: found.rule, file: found.file }];
  });
};

const dimensionReasons = (baseline: Report, fell: readonly DimensionReport[], exempt: ReadonlySet<string>): readonly GateReason[] =>
  fell
    .filter((dimension) => !exempt.has(dimension.dimension))
    .map((dimension) => ({
      kind: "dimension" as const,
      dimension: dimension.dimension,
      from: scoreOf(baseline, dimension.dimension) ?? 0,
      to: dimension.score ?? 0,
    }));

export const judge = (baseline: Report, current: Report, changedTools: readonly string[]): Verdict => {
  const fell = current.dimensions.filter((dimension) => regressed(baseline, dimension));
  const exemptions = fell.flatMap((dimension) => {
    const exemption = exemptionFor(dimension, baseline, current, changedTools);
    return exemption === undefined ? [] : [exemption];
  });
  const reasons = [
    ...dimensionReasons(baseline, fell, new Set(exemptions.map((entry) => entry.dimension))),
    ...suppressionReasons(baseline, current),
    ...newErrors(baseline, current),
  ];
  return { failed: reasons.length > 0, reasons, exemptions };
};
