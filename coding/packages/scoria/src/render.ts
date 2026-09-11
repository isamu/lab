import type { Finding } from "./plugin.ts";
import type { DimensionReport, Report } from "./report.ts";

const NAME_WIDTH = 20;
const SCORE_WIDTH = 6;
const RULE_WIDTH = 22;
const LOCATION_WIDTH = 44;
const METRIC_WIDTH = 40;
const VALUE_WIDTH = 10;
const SCALE_WIDTH = 14;
const POINTS_WIDTH = 8;
const MAX_FINDINGS = 8;
const SEPARATOR = "─".repeat(62);

const pad = (text: string, width: number): string => text.padEnd(width);
const padStart = (text: string, width: number): string => text.padStart(width);

const confidenceCell = (dimension: DimensionReport): string =>
  dimension.confidence === "high" ? "high" : `${dimension.confidence}   ${dimension.confidenceReason}`;

const dimensionRow = (dimension: DimensionReport): string =>
  `  ${pad(dimension.dimension, NAME_WIDTH)}${padStart(dimension.score.toFixed(0), SCORE_WIDTH)}   ${confidenceCell(dimension)}`;

const findingRow = (finding: Finding): string => {
  const location = `${finding.file}:${finding.line}`;
  return `  ${pad(location, LOCATION_WIDTH)} ${pad(finding.rule, RULE_WIDTH)} ${finding.message}`;
};

const probeNotes = (report: Report): readonly string[] =>
  report.probes.filter((p) => p.status.kind !== "ok").map((p) => `  ${p.status.kind.padEnd(8)} ${p.probe}  ${"reason" in p.status ? p.status.reason : ""}`);

export interface RenderContext {
  readonly source: string;
  readonly drift: readonly string[];
  readonly notice: string | undefined;
}

const header = (report: Report, context: RenderContext): readonly string[] => [
  "",
  `${report.root}  [${report.stacks.join(" · ")}]  profile: ${report.profile}`,
  `${report.size.files} files · ${report.size.sloc} sloc · ${report.size.testSloc} test sloc   config: ${context.source}`,
  "",
];

const driftSection = (context: RenderContext): readonly string[] =>
  context.drift.length === 0
    ? []
    : ["detection drift", ...context.drift.map((line) => `  ${line}`), "  取り込むなら `scoria init`（baseline の取り直しが要ります）", ""];

const warningSection = (report: Report): readonly string[] => {
  const warnings = report.findings.filter((finding) => finding.severity === "warning");
  if (warnings.length === 0) return [];
  const byRule = new Map<string, number>();
  warnings.forEach((finding) => byRule.set(finding.rule, (byRule.get(finding.rule) ?? 0) + 1));
  const rows = [...byRule.entries()].map(([rule, count]) => `  ${pad(rule, RULE_WIDTH)} ${count} 件`);
  return [`${warnings.length} warnings`, ...rows, ""];
};

const table = (report: Report): readonly string[] => [
  `  ${pad("Dimension", NAME_WIDTH)}${padStart("Score", SCORE_WIDTH)}   Confidence`,
  `  ${SEPARATOR}`,
  ...report.dimensions.map(dimensionRow),
  `  ${SEPARATOR}`,
  `  ${pad("Overall", NAME_WIDTH)}${padStart(report.overall.score.toFixed(0), SCORE_WIDTH)}   not comparable across repos`,
  "",
];

const findingsSection = (report: Report): readonly string[] => {
  const errors = report.findings.filter((f) => f.severity === "error");
  if (errors.length === 0) return [];
  const shown = errors.slice(0, MAX_FINDINGS).map(findingRow);
  const rest = errors.length > MAX_FINDINGS ? [`  … ${errors.length - MAX_FINDINGS} more`] : [];
  return [`${errors.length} findings at severity error`, ...shown, ...rest, ""];
};

export const renderReport = (report: Report, context: RenderContext): string => {
  const notes = probeNotes(report);
  const lines = [
    ...header(report, context),
    ...table(report),
    ...findingsSection(report),
    ...warningSection(report),
    ...driftSection(context),
    ...(notes.length > 0 ? ["probes not scored", ...notes, ""] : []),
    ...(context.notice === undefined ? [] : [context.notice, ""]),
    "overall は各次元の単純平均です。profile 別の重み (spec §10) は未実装。",
    "mode: report — この実行は何もゲートしません (spec §17.2)。",
    "",
  ];
  return lines.join("\n");
};

export const renderExplain = (report: Report, dimension: string): string => {
  const found = report.dimensions.find((d) => d.dimension === dimension);
  if (found === undefined) {
    return `unknown dimension: ${dimension}\nknown: ${report.dimensions.map((d) => d.dimension).join(", ")}\n`;
  }
  const rows = found.metrics.map((m) => {
    const scale = `${m.scale.good} → ${m.scale.bad}`;
    return `  ${pad(m.metric, METRIC_WIDTH)}${padStart(m.value.toFixed(2), VALUE_WIDTH)}   ${padStart(scale, SCALE_WIDTH)}${padStart(m.points.toFixed(1), POINTS_WIDTH)}`;
  });
  return [
    "",
    `${found.dimension}  ${found.score.toFixed(0)}   status: ${found.status}   confidence: ${found.confidence}`,
    "",
    `  ${pad("metric", METRIC_WIDTH)}${padStart("value", VALUE_WIDTH)}   ${padStart("scale", SCALE_WIDTH)}${padStart("pts", POINTS_WIDTH)}`,
    `  ${SEPARATOR}`,
    ...rows,
    `  ${SEPARATOR}`,
    `  ${pad("", METRIC_WIDTH)}${padStart("", VALUE_WIDTH)}   ${padStart("", SCALE_WIDTH)}${padStart(found.score.toFixed(1), POINTS_WIDTH)}`,
    "",
    `  ${found.confidenceReason}`,
    "",
  ].join("\n");
};
