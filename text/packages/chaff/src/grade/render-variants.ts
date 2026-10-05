import type { LengthUnit } from "../plugin.ts";
import { widthOf } from "../render/rules-table.ts";
import { block, table } from "./render.ts";
import type { Disagreement, VariantColumn, VariantComparison } from "./variants.ts";
import type { VariantText } from "./variants-text.ts";

// The variant comparison for a person (a screen table), for a CI log (one line per disagreement), and for a pull request
// comment (Markdown tables). Every form is built from the same rows, so they never say different things.

const UNITS: readonly LengthUnit[] = ["word", "char"];

type Rows = readonly (readonly string[])[];

const passedCell = (column: VariantColumn, text: VariantText): string =>
  text.passedCell(column.passed, column.outputs, column.passRate === undefined ? "–" : `${String(column.passRate)}%`);

const aiScoreCellOf = (column: VariantColumn, text: VariantText): string =>
  column.aiScore === undefined ? "–" : text.aiScoreCell(column.aiScore.low, column.aiScore.medium, column.aiScore.high, column.aiScore.notScored);

/** The header and one row per measure, a column per variant. */
const measureRows = (comparison: VariantComparison, text: VariantText): Rows => {
  const { columns } = comparison;
  const scored = columns.some((column) => column.penalty !== undefined);
  const grounded = columns.some((column) => column.contexts !== undefined);
  const aiScored = columns.some((column) => column.aiScore !== undefined);
  return [
    ["", ...comparison.variants],
    [text.passed, ...columns.map((column) => passedCell(column, text))],
    [text.factsDropped, ...columns.map((column) => String(column.facts.dropped))],
    [text.factsAdded, ...columns.map((column) => String(column.facts.added))],
    [text.citationsFailed, ...columns.map((column) => text.citationsCell(column.citations.failed, column.citations.checked))],
    ...(grounded
      ? [[text.unsupportedFacts, ...columns.map((column) => text.citationsCell(column.contexts?.unsupported ?? 0, column.contexts?.checked ?? 0))]]
      : []),
    ...(scored ? [[text.penalty, ...columns.map((column) => String(column.penalty ?? 0))]] : []),
    ...(aiScored ? [[text.aiScore, ...columns.map((column) => aiScoreCellOf(column, text))]] : []),
  ];
};

/** Each rule's rate in each variant, for one unit; empty when no rule fired in that unit. */
const rateRowsOf = (comparison: VariantComparison, unit: LengthUnit): Rows =>
  comparison.rules.filter((row) => row.unit === unit).map((row) => [row.rule, ...comparison.variants.map((variant) => (row.rates[variant] ?? 0).toFixed(1))]);

const disagreementLine = (entry: Disagreement, text: VariantText): string =>
  text.disagreement(
    entry.id,
    entry.passedIn.join(", "),
    entry.failedIn.map((failed) => text.failedIn(failed.variant, failed.failedBecause.join(", "))).join(text.separator),
  );

const notComparedLines = (comparison: VariantComparison, text: VariantText): string[] => [
  ...comparison.missing.map((entry) => text.missing(entry.id, entry.missingFrom.join(", "))),
  ...(comparison.readOtherwise.length === 0 ? [] : [text.readOtherwise(comparison.readOtherwise.join(", "))]),
];

const disagreementBlock = (comparison: VariantComparison, text: VariantText, bullet: string): string[] =>
  comparison.disagreements.length === 0
    ? ["", text.noDisagreement]
    : block(
        text.disagreeHeading(comparison.disagreements.length),
        comparison.disagreements.map((entry) => `${bullet}${disagreementLine(entry, text)}`),
      );

/** For a person: the measures side by side, the rates, where pass or fail differs, and what could not be compared. */
export const renderVariants = (comparison: VariantComparison, text: VariantText): string =>
  [
    text.heading(comparison.compared.length, comparison.variants.length),
    ...table(measureRows(comparison, text), widthOf),
    ...UNITS.flatMap((unit) => {
      const rows = rateRowsOf(comparison, unit);
      return rows.length === 0 ? [] : block(text.ratesHeading(text.unit[unit]), table([["", ...comparison.variants], ...rows], widthOf));
    }),
    ...disagreementBlock(comparison, text, "  ✗ "),
    ...block(
      text.notComparedHeading,
      notComparedLines(comparison, text).map((line) => `  ${line}`),
    ),
  ].join("\n");

/** For a CI log: one line per output where pass or fail differs, then the count. */
export const renderVariantsCompact = (comparison: VariantComparison, text: VariantText): string =>
  [
    ...comparison.disagreements.map(
      (entry) => `disagree\t${entry.id}\tpass ${entry.passedIn.join(",")}\tfail ${entry.failedIn.map((failed) => failed.variant).join(",")}`,
    ),
    comparison.disagreements.length === 0 ? text.noDisagreement : text.disagreeHeading(comparison.disagreements.length),
  ].join("\n");

/** A table cell: a pipe would end the cell, and a line break the row. */
const cell = (value: string): string => value.replaceAll("|", "\\|").replaceAll(/\r?\n/gu, " ");

export const markdownTable = (rows: Rows): string[] => {
  const [header, ...body] = rows;
  if (header === undefined) return [];
  const line = (cells: readonly string[]): string => `| ${cells.map(cell).join(" | ")} |`;
  return [line(header), line(header.map(() => "---")), ...body.map(line)];
};

/** For a pull request comment: the same measures and rates as Markdown tables, and where pass or fail differs. */
export const renderVariantsMarkdown = (comparison: VariantComparison, text: VariantText): string =>
  [
    `### ${text.heading(comparison.compared.length, comparison.variants.length)}`,
    "",
    ...markdownTable(measureRows(comparison, text)),
    ...UNITS.flatMap((unit) => {
      const rows = rateRowsOf(comparison, unit);
      return rows.length === 0 ? [] : ["", `**${text.ratesHeading(text.unit[unit])}**`, "", ...markdownTable([["", ...comparison.variants], ...rows])];
    }),
    ...(comparison.disagreements.length === 0
      ? ["", text.noDisagreement]
      : [
          "",
          `**${text.disagreeHeading(comparison.disagreements.length)}**`,
          "",
          ...comparison.disagreements.map((entry) => `- ${disagreementLine(entry, text)}`),
        ]),
    ...(notComparedLines(comparison, text).length === 0
      ? []
      : ["", `**${text.notComparedHeading}**`, "", ...notComparedLines(comparison, text).map((line) => `- ${line}`)]),
  ].join("\n");
