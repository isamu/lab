// Seeded missing qualifiers for `yarn bench`: the unit dropped from one table amount (300,000円 → 300,000, $600 → 600),
// and the year dropped from one dated table row (2026年10月21日 → 10月21日, 10 November 2026 → 10 November). Pure and
// deterministic, like scripts/bench-mutations.ts.
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

export const MUTATIONS: readonly Mutation[] = [
  { id: "unit-dropped-ja", rule: "number-without-unit", languages: ["ja"], plant: secondRow(YEN_CELL, "$1$2") },
  { id: "unit-dropped-en", rule: "number-without-unit", languages: ["en"], plant: secondRow(DOLLAR_CELL, "|$1$2") },
  { id: "year-dropped", rule: "date-without-year", languages: ["ja"], plant: secondRow(DATED_CELL, "|$1$2") },
  { id: "year-dropped-en", rule: "date-without-year", languages: ["en"], plant: secondRow(DATED_CELL_EN, "|$1") },
];
