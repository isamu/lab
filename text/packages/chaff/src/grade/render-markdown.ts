import type { LengthUnit } from "../plugin.ts";
import type { Comparison } from "./baseline.ts";
import { factsLine } from "./render.ts";
import { resultName } from "./result-name.ts";
import { markdownTable, renderVariantsMarkdown } from "./render-variants.ts";
import type { GradeSummary } from "./summary.ts";
import type { GradeText } from "./text.ts";
import type { VariantComparison } from "./variants.ts";
import type { VariantText } from "./variants-text.ts";

// `chaff grade --format markdown`: a run's summary as a pull request comment. The same numbers as the screen.

const UNITS: readonly LengthUnit[] = ["word", "char"];

export type MarkdownTexts = { readonly grade: GradeText; readonly variants: VariantText };

/** One rate table per unit, as on the screen: a rate per 1,000 characters and one per 1,000 words are not on one scale. */
const rateTables = (summary: GradeSummary, text: GradeText): string[] =>
  UNITS.flatMap((unit) => {
    const rows = Object.entries(summary.rules).flatMap(([rule, entry]) => {
      const rate = entry.rate[unit];
      return rate === undefined ? [] : [[rule, rate.toFixed(1), text.outputsWith(entry.outputs)]];
    });
    return rows.length === 0 ? [] : ["", `**${text.ratesHeading(text.unit[unit])}**`, "", ...markdownTable([["", "", ""], ...rows])];
  });

const failedLines = (summary: GradeSummary, text: VariantText): string[] =>
  summary.failed.length === 0
    ? []
    : ["", `**${text.failedHeading}**`, "", ...summary.failed.map((entry) => `- \`${resultName(entry)}\`: ${entry.failedBecause.join(", ")}`)];

const baselineLines = (comparison: Comparison | undefined, text: VariantText): string[] => {
  if (comparison === undefined) return [];
  if (comparison.regressions.length === 0) return ["", text.noRegression];
  return ["", `**${text.regressionsHeading(comparison.regressions.length)}**`, "", ...comparison.regressions.map((reason) => `- ${reason}`)];
};

const stampLine = (summary: GradeSummary, text: VariantText): string[] =>
  summary.stamp === undefined
    ? []
    : ["", `<sub>${text.stamp}: ${summary.stamp.chaff} · rules ${summary.stamp.rules} · settings ${summary.stamp.settings}</sub>`];

/** The totals, the failed outputs, the variants side by side (or the rates when there are none), the regressions, and the stamp. */
export const renderMarkdown = (
  path: string,
  summary: GradeSummary,
  compared: { readonly variants?: VariantComparison | undefined; readonly baseline?: Comparison | undefined },
  texts: MarkdownTexts,
): string =>
  [
    `## ${texts.variants.runHeading(path)}`,
    "",
    texts.variants.totals(summary.total, summary.passed),
    ...failedLines(summary, texts.variants),
    ...(compared.variants === undefined ? rateTables(summary, texts.grade) : ["", renderVariantsMarkdown(compared.variants, texts.variants)]),
    "",
    factsLine(summary, texts.grade),
    "",
    texts.grade.citations(summary.citations.checked, summary.citations.failed),
    ...baselineLines(compared.baseline, texts.variants),
    ...stampLine(summary, texts.variants),
  ].join("\n");
