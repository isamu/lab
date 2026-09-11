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

const header = (report: Report): readonly string[] => [
  "",
  `${report.root}  [ts]`,
  `${report.size.files} files · ${report.size.sloc} sloc · ${report.size.testSloc} test sloc`,
  "",
];

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

export const renderReport = (report: Report): string => {
  const notes = probeNotes(report);
  const lines = [
    ...header(report),
    ...table(report),
    ...findingsSection(report),
    ...(notes.length > 0 ? ["probes not scored", ...notes, ""] : []),
    "overall は 2 次元の単純平均です。profile 別の重み (spec §10) は未実装。",
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
