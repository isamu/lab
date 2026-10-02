import type { LengthUnit } from "../plugin.ts";
import type { GradeResult } from "./result.ts";
import type { GradeSummary } from "./summary.ts";
import type { GradeText } from "./text.ts";

const UNITS: readonly LengthUnit[] = ["word", "char"];

const block = (heading: string, lines: readonly string[]): string[] => (lines.length === 0 ? [] : ["", heading, ...lines]);

const padded = (cells: readonly string[], widths: readonly number[]): string =>
  `  ${cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)).join("  ")}`.trimEnd();

/** Columns as wide as their widest cell. */
const table = (rows: readonly (readonly string[])[]): string[] => {
  const widths = rows.reduce<number[]>((max, row) => row.map((cell, index) => Math.max(max[index] ?? 0, cell.length)), []);
  return rows.map((row) => padded(row, widths));
};

/** One table per unit: a rate per 1,000 characters and one per 1,000 words are not on one scale. */
const rateBlocks = (summary: GradeSummary, text: GradeText): string[] =>
  UNITS.flatMap((unit) => {
    const rows = Object.entries(summary.rules).flatMap(([rule, entry]) => {
      const rate = entry.rate[unit];
      return rate === undefined ? [] : [[rule, rate.toFixed(1), text.outputsWith(entry.outputs)]];
    });
    return block(text.ratesHeading(text.unit[unit]), table(rows));
  });

const kindsLine = (counts: Readonly<Record<string, number>>): string =>
  Object.entries(counts)
    .map(([kind, count]) => `${kind} ${String(count)}`)
    .join(", ");

const sum = (counts: Readonly<Record<string, number>>): number => Object.values(counts).reduce((total, count) => total + count, 0);

const factsLine = (summary: GradeSummary, text: GradeText): string =>
  text.facts(sum(summary.facts.dropped), sum(summary.facts.added), kindsLine(summary.facts.dropped), kindsLine(summary.facts.added));

const stampLines = (summary: GradeSummary, text: GradeText): string[] =>
  summary.stamp === undefined ? [] : ["", `${text.stamp}: ${summary.stamp.chaff}`, `  rules ${summary.stamp.rules}`, `  settings ${summary.stamp.settings}`];

/** For a person: the totals, each failed output with why, the rates, facts and quotations, what did not run, and the stamp. */
export const renderSummary = (path: string, summary: GradeSummary, text: GradeText): string =>
  [
    text.totals(path, summary.total, summary.passed),
    ...block(
      text.failedHeading,
      summary.failed.map((entry) => `  ✗ ${entry.id}: ${entry.failedBecause.join(", ")}`),
    ),
    ...rateBlocks(summary, text),
    "",
    factsLine(summary, text),
    text.citations(summary.citations.checked, summary.citations.failed),
    ...(summary.penalty === undefined ? [] : [text.penalty(summary.penalty)]),
    ...block(text.notRunHeading(summary.notRun.length), table(summary.notRun.map((entry) => [entry.rule, text.inOutputs(entry.outputs), entry.reason]))),
    ...stampLines(summary, text),
  ].join("\n");

/** For grep and a CI log: one line per output, its id, pass or fail and why, then the totals. */
export const renderCompact = (path: string, results: readonly GradeResult[], summary: GradeSummary, text: GradeText): string =>
  [
    ...results.map((result) =>
      [
        result.id,
        result.pass ? "pass" : "fail",
        ...(result.score === undefined ? [] : [`penalty ${String(result.score.penalty)}`]),
        ...(result.pass ? [] : [result.failedBecause.join(", ")]),
      ].join("\t"),
    ),
    text.totals(path, summary.total, summary.passed),
  ].join("\n");
