import type { Report } from "./report.ts";
import type { ReportDiff } from "./diff.ts";

/**
 * The dimensions as a bar chart, for the GitHub job summary.
 *
 * GitHub renders a ```mermaid fence wherever it renders Markdown, the step summary included, so a
 * chart costs no image, no artifact and no third party. The table stays underneath: a chart cannot
 * carry confidence, or the reason a dimension went unmeasured, and those decide how to read the
 * number (§21.1).
 *
 * Bars are this run. The line is the baseline, drawn only where the two measured the same metrics —
 * a rubric change makes the old number a measurement of something else (§16.2).
 */

const SCALE_MAX = 100;

/** A dimension nothing could be measured in has no bar. Plotting it at zero would invent one. */
const scored = (report: Report): readonly { readonly dimension: string; readonly score: number }[] =>
  report.dimensions.flatMap((entry) => (entry.score === undefined ? [] : [{ dimension: entry.dimension, score: entry.score }]));

/** Mermaid takes double-quoted labels, so a quote inside one would end it early. */
const quoted = (value: string): string => `"${value.replace(/"/g, "'")}"`;

const round = (value: number): string => value.toFixed(0);

const baselineOf = (dimensions: readonly string[], diff: ReportDiff | undefined): readonly number[] | undefined => {
  if (diff === undefined) return undefined;
  const before = dimensions.map((dimension) => diff.dimensions.find((entry) => entry.dimension === dimension));
  // One incomparable dimension would shift the whole series against its own axis.
  if (before.some((entry) => entry?.from === undefined || entry.delta === undefined)) return undefined;
  return before.map((entry) => entry?.from ?? 0);
};

export const renderChart = (report: Report, diff?: ReportDiff): readonly string[] => {
  const entries = scored(report);
  if (entries.length === 0) return [];
  const baseline = baselineOf(
    entries.map((entry) => entry.dimension),
    diff,
  );
  const title = `scoria · ${report.label}`;
  return [
    "```mermaid",
    "xychart-beta",
    `    title ${quoted(title)}`,
    `    x-axis [${entries.map((entry) => quoted(entry.dimension)).join(", ")}]`,
    `    y-axis "score" 0 --> ${String(SCALE_MAX)}`,
    `    bar [${entries.map((entry) => round(entry.score)).join(", ")}]`,
    ...(baseline === undefined ? [] : [`    line [${baseline.map(round).join(", ")}]`]),
    "```",
    "",
  ];
};
