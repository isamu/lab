// Seeded missing qualifiers for `yarn bench`: the unit dropped from one table amount (300,000円 → 300,000, $600 → 600),
// and the year dropped from one dated table row (2026年10月21日 → 10月21日, 10 November 2026 → 10 November) in a document
// that also names a date of the year before, so the reader cannot tell the year. Pure and deterministic, like
// scripts/bench-mutations.ts.
import { codeLines, isTableRow, linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const YEN_CELL = /(\d)円(\s*\|)/u;
const DOLLAR_CELL = /\|(\s*)\$(\d)/u;
const DATED_CELL = /\|(\s*)\d{4}年(\d{1,2}月\d{1,2}日)/u;
const DATED_CELL_EN = /\|(\s*(?:[A-Z][a-z]+, )?\d{1,2} [A-Z][a-z]+) \d{4}/u;

/** The second table row outside code that matches, rewritten: the others keep the qualifier, so this one lacks it. */
const secondRow =
  (pattern: RegExp, replacement: string) =>
  (source: string): Plant | undefined => {
    const lines = linesOf(source);
    const code = codeLines(lines);
    const index = lines.map((line, at) => (!code.has(at) && isTableRow(line) && pattern.test(line) ? at : -1)).filter((at) => at !== -1)[1];
    const line = index === undefined ? undefined : lines[index];
    return index === undefined || line === undefined ? undefined : { source: replaceLine(lines, index, line.replace(pattern, replacement)), line: index + 1 };
  };

/** A date of the year before, closing the document: the samples' dates are all in one year, where a yearless date is plain. */
const LAST_YEAR_JA = "前年の同じ予定は2025年11月10日（月）でした。";
const LAST_YEAR_EN = "The same item last year was on Monday, 10 November 2025.";

const withLastYear =
  (plant: (source: string) => Plant | undefined, sentence: string) =>
  (source: string): Plant | undefined => {
    const planted = plant(source);
    return planted === undefined ? undefined : { ...planted, source: `${planted.source.trimEnd()}\n\n${sentence}\n` };
  };

export const MUTATIONS: readonly Mutation[] = [
  { id: "unit-dropped-ja", rule: "number-without-unit", languages: ["ja"], plant: secondRow(YEN_CELL, "$1$2") },
  { id: "unit-dropped-en", rule: "number-without-unit", languages: ["en"], plant: secondRow(DOLLAR_CELL, "|$1$2") },
  { id: "year-dropped", rule: "date-without-year", languages: ["ja"], plant: withLastYear(secondRow(DATED_CELL, "|$1$2"), LAST_YEAR_JA) },
  { id: "year-dropped-en", rule: "date-without-year", languages: ["en"], plant: withLastYear(secondRow(DATED_CELL_EN, "|$1"), LAST_YEAR_EN) },
];
