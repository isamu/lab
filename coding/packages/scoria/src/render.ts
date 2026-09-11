import type { Finding } from "./plugin.ts";
import type { DimensionReport, Report } from "./report.ts";
import type { Drift } from "./config.ts";
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

export interface RenderContext {
  readonly source: string;
  readonly drift: Drift;
  readonly notice: string | undefined;
  readonly lang: Lang;
}

const pad = padEndWide;
const padStart = padStartWide;

/** The rule id is the join between the machine-readable message and the translated one. */
const displayMessage = (finding: Finding, messages: Messages): string => messages.ruleMessages[finding.rule] ?? finding.message;

const confidenceCell = (dimension: DimensionReport): string =>
  dimension.confidence === "high" ? "high" : `${dimension.confidence}   ${dimension.confidenceReason}`;

const dimensionRow = (dimension: DimensionReport): string =>
  `  ${pad(dimension.dimension, NAME_WIDTH)}${padStart(dimension.score.toFixed(0), SCORE_WIDTH)}   ${confidenceCell(dimension)}`;

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
  ...report.dimensions.map(dimensionRow),
  `  ${SEPARATOR}`,
  `  ${pad(messages.overall, NAME_WIDTH)}${padStart(report.overall.score.toFixed(0), SCORE_WIDTH)}   ${messages.notComparable}`,
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
  const warnings = report.findings.filter((finding) => finding.severity === "warning");
  if (warnings.length === 0) return [];
  const byRule = new Map<string, number>();
  warnings.forEach((finding) => byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1));
  const rows = [...byRule.entries()].map(([rule, count]) => `  ${pad(rule, RULE_WIDTH)} ${count}`);
  return [messages.warnings(warnings.length), ...rows, ""];
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
    ...findingsSection(report, messages),
    ...warningSection(report, messages),
    ...driftSection(context, messages),
    ...(notes.length > 0 ? [messages.probesNotScored, ...notes, ""] : []),
    ...(context.notice === undefined ? [] : [context.notice, ""]),
    messages.meanNote,
    messages.reportModeNote,
    "",
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
    `${found.dimension}  ${found.score.toFixed(0)}   status: ${found.status}   ${messages.confidence}: ${found.confidence}`,
    "",
    `  ${pad("metric", METRIC_WIDTH)}${padStart("value", VALUE_WIDTH)}   ${padStart("scale", SCALE_WIDTH)}${padStart("pts", POINTS_WIDTH)}`,
    `  ${SEPARATOR}`,
    ...rows,
    `  ${SEPARATOR}`,
    `  ${pad("", METRIC_WIDTH)}${padStart("", VALUE_WIDTH)}   ${padStart("", SCALE_WIDTH)}${padStart(found.score.toFixed(1), POINTS_WIDTH)}`,
    ...contributors,
    "",
    `  ${found.confidenceReason}`,
    "",
  ].join("\n");
};
