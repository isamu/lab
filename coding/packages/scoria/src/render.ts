import type { Finding } from "./plugin.ts";
import type { DimensionReport, Report } from "./report.ts";
import { tallyWarnings } from "./report.ts";
import type { Drift } from "./config.ts";
import type { Mover, ReportDiff } from "./diff.ts";
import type { Exemption, GateReason, Verdict } from "./gate.ts";
import { messagesFor, type Lang, type Messages } from "./messages.ts";
import { padEndWide, padStartWide } from "./width.ts";

const NAME_WIDTH = 20;
const SCORE_WIDTH = 6;
const RULE_WIDTH = 24;
const LOCATION_WIDTH = 44;
const METRIC_WIDTH = 40;
const VALUE_WIDTH = 10;
const SCALE_WIDTH = 14;
const POINTS_WIDTH = 8;
const MAX_FINDINGS = 8;
const SEPARATOR = "─".repeat(62);

export interface Comparison {
  readonly diff: ReportDiff;
  readonly since: string;
  /** Tools whose version changed, whose movement is not a regression (spec §17.3). */
  readonly rebaseline: readonly string[];
}

export interface RenderContext {
  readonly source: string;
  readonly drift: Drift;
  readonly notice: string | undefined;
  readonly lang: Lang;
  readonly comparison?: Comparison | undefined;
  /** Present only under `mode: ratchet`; its absence is what says the run gated nothing. */
  readonly verdict?: Verdict | undefined;
}

const MAX_MOVERS = 6;
const MOVER_FLOOR = 0.05;

const signed = (value: number): string => (value > 0 ? `+${value.toFixed(1)}` : value.toFixed(1));

/**
 * The point of the tool is the direction of travel, so the movers name the metric that moved and
 * by how much. The scale being linear is what lets the points be read as "what this was worth".
 */
const noteLine = (subjects: readonly string[], phrase: (joined: string) => string): readonly string[] =>
  subjects.length === 0 ? [] : [`  ${phrase(subjects.join(", "))}`];

const moverRow = (mover: Mover): string =>
  `  ${padStart(signed(mover.points), 7)}  ${pad(mover.dimension, 14)} ${pad(mover.metric, 34)} ${mover.from} → ${mover.to}`;

const movedSection = (context: RenderContext, messages: Messages): readonly string[] => {
  const comparison = context.comparison;
  if (comparison === undefined) return [messages.noBaseline, ""];
  // A mover that rounds to zero is noise; reporting it as movement is worse than silence.
  const movers = comparison.diff.movers.filter((mover) => Math.abs(mover.points) >= MOVER_FLOOR).toSorted((a, b) => Math.abs(b.points) - Math.abs(a.points));
  const rows = movers.slice(0, MAX_MOVERS).map(moverRow);
  const notes = [...noteLine(comparison.rebaseline, messages.rebaselineNeeded), ...noteLine(comparison.diff.notComparable, messages.rubricChanged)];
  if (rows.length === 0 && notes.length === 0) return [];
  return [messages.whatMoved, ...rows, ...notes, ""];
};

const pad = padEndWide;
const padStart = padStartWide;

const reasonLine = (reason: GateReason, messages: Messages): string => {
  if (reason.kind === "dimension") return messages.gateDimension(reason.dimension, reason.from.toFixed(0), reason.to.toFixed(0));
  if (reason.kind === "suppression") return messages.gateSuppression(reason.from, reason.to);
  return messages.gateFinding(reason.rule, reason.file);
};

const exemptionLine = (exemption: Exemption, messages: Messages): string => {
  if (exemption.kind === "low-confidence") return messages.gateLowConfidence(exemption.dimension);
  if (exemption.kind === "tool-version") return messages.gateToolVersion(exemption.dimension, exemption.tools.join(", "));
  return messages.gateSizeChange(exemption.dimension, exemption.percent);
};

/**
 * The exemptions are printed whether or not the run failed. A regression that was deliberately not
 * gated, shown nowhere, reads as no regression at all — and then the gate is quietly lying.
 */
const gateSection = (verdict: Verdict | undefined, messages: Messages): readonly string[] => {
  if (verdict === undefined) return [messages.reportModeNote, ""];
  const failures = verdict.failed
    ? [messages.gateFailed, ...verdict.reasons.map((reason) => `  ${reasonLine(reason, messages)}`), ""]
    : [messages.gatePassed, ""];
  if (verdict.exemptions.length === 0) return failures;
  return [...failures, messages.gateNotGated, ...verdict.exemptions.map((exemption) => `  ${exemptionLine(exemption, messages)}`), ""];
};

/** The rule id is the join between the machine-readable message and the translated one. */
const displayMessage = (finding: Finding, messages: Messages): string => messages.ruleMessages[finding.rule] ?? finding.message;

const confidenceCell = (dimension: DimensionReport): string =>
  dimension.confidence === "high" ? "high" : `${dimension.confidence}   ${dimension.confidenceReason}`;

/** A dimension nothing could be measured in shows a dash, never a number standing in for it. */
const scoreCell = (score: number | undefined): string => (score === undefined ? "—" : score.toFixed(0));

const coverageNote = (dimension: DimensionReport, messages: Messages): string =>
  dimension.coverage >= 1 ? "" : `   ${messages.partlyMeasured(Math.round(dimension.coverage * 100))}`;

const dimensionRow = (dimension: DimensionReport, messages: Messages): string =>
  `  ${pad(dimension.dimension, NAME_WIDTH)}${padStart(scoreCell(dimension.score), SCORE_WIDTH)}   ${confidenceCell(dimension)}${coverageNote(dimension, messages)}`;

const findingRow = (finding: Finding, messages: Messages): string => {
  const location = `${finding.file}:${finding.line}`;
  return `  ${pad(location, LOCATION_WIDTH)} ${pad(finding.rule, RULE_WIDTH)} ${displayMessage(finding, messages)}`;
};

const probeNotes = (report: Report): readonly string[] =>
  report.probes
    .filter((probe) => probe.status.kind !== "ok")
    .map((probe) => `  ${probe.status.kind.padEnd(8)} ${probe.probe}  ${"reason" in probe.status ? probe.status.reason : ""}`);

const header = (report: Report, context: RenderContext, messages: Messages): readonly string[] => [
  "",
  `${report.root}  [${report.stacks.join(" · ")}]  ${messages.profileLabel}: ${report.profile}`,
  `${messages.filesLine(report.size.files, report.size.sloc, report.size.testSloc)}   ${messages.configLabel}: ${context.source}`,
  "",
];

const table = (report: Report, messages: Messages): readonly string[] => [
  `  ${pad(messages.dimension, NAME_WIDTH)}${padStart(messages.score, SCORE_WIDTH)}   ${messages.confidence}`,
  `  ${SEPARATOR}`,
  ...report.dimensions.map((dimension) => dimensionRow(dimension, messages)),
  `  ${SEPARATOR}`,
  `  ${pad(messages.overall, NAME_WIDTH)}${padStart(report.overall.score.toFixed(0), SCORE_WIDTH)}   ${messages.notComparable} (${messages.fromDimensions(report.overall.scoredDimensions)})`,
  "",
];

const findingsSection = (report: Report, messages: Messages): readonly string[] => {
  const errors = report.findings.filter((finding) => finding.severity === "error");
  if (errors.length === 0) return [];
  const shown = errors.slice(0, MAX_FINDINGS).map((finding) => findingRow(finding, messages));
  const rest = errors.length > MAX_FINDINGS ? [`  ${messages.more(errors.length - MAX_FINDINGS)}`] : [];
  return [messages.findingsAtError(errors.length), ...shown, ...rest, ""];
};

const warningSection = (report: Report, messages: Messages): readonly string[] => {
  const tally = tallyWarnings(report);
  if (tally.length === 0) return [];
  const total = tally.reduce((sum, [, count]) => sum + count, 0);
  return [messages.warnings(total), ...tally.map(([rule, count]) => `  ${pad(rule, RULE_WIDTH)} ${count}`), ""];
};

const driftSection = (context: RenderContext, messages: Messages): readonly string[] => {
  const lines = [...context.drift.added.map((id) => `  ${messages.stackAdded(id)}`), ...context.drift.missing.map((id) => `  ${messages.stackMissing(id)}`)];
  return lines.length === 0 ? [] : [messages.detectionDrift, ...lines, `  ${messages.driftHint}`, ""];
};

export const renderReport = (report: Report, context: RenderContext): string => {
  const messages = messagesFor(context.lang);
  const notes = probeNotes(report);
  return [
    ...header(report, context, messages),
    ...table(report, messages),
    ...movedSection(context, messages),
    ...findingsSection(report, messages),
    ...warningSection(report, messages),
    ...driftSection(context, messages),
    ...(notes.length > 0 ? [messages.probesNotScored, ...notes, ""] : []),
    ...(context.notice === undefined ? [] : [context.notice, ""]),
    messages.meanNote,
    "",
    ...gateSection(context.verdict, messages),
  ].join("\n");
};

export const renderExplain = (report: Report, dimension: string, lang: Lang): string => {
  const messages = messagesFor(lang);
  const found = report.dimensions.find((entry) => entry.dimension === dimension);
  if (found === undefined) {
    return `${messages.unknownDimension(dimension, report.dimensions.map((entry) => entry.dimension).join(", "))}\n`;
  }
  const rows = found.metrics.map((metric) => {
    const scale = `${metric.scale.good} → ${metric.scale.bad}`;
    return `  ${pad(metric.metric, METRIC_WIDTH)}${padStart(metric.value.toFixed(2), VALUE_WIDTH)}   ${padStart(scale, SCALE_WIDTH)}${padStart(metric.points.toFixed(1), POINTS_WIDTH)}`;
  });
  const contributors = found.metrics.flatMap((metric) =>
    metric.topContributors === undefined || metric.topContributors.length === 0
      ? []
      : [
          "",
          `  ${messages.topContributors(metric.metric)}`,
          ...metric.topContributors.map((entry) => `    ${padStart(String(entry.value), 8)}  ${entry.file}`),
        ],
  );
  return [
    "",
    `${found.dimension}  ${scoreCell(found.score)}   status: ${found.status}   ${messages.confidence}: ${found.confidence}`,
    "",
    `  ${pad("metric", METRIC_WIDTH)}${padStart("value", VALUE_WIDTH)}   ${padStart("scale", SCALE_WIDTH)}${padStart("pts", POINTS_WIDTH)}`,
    `  ${SEPARATOR}`,
    ...rows,
    `  ${SEPARATOR}`,
    `  ${pad("", METRIC_WIDTH)}${padStart("", VALUE_WIDTH)}   ${padStart("", SCALE_WIDTH)}${padStart(found.score === undefined ? "—" : found.score.toFixed(1), POINTS_WIDTH)}`,
    ...contributors,
    "",
    `  ${found.confidenceReason}`,
    "",
  ].join("\n");
};
