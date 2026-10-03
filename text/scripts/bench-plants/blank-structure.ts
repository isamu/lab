// Seeded blanks for `yarn bench`: one table cell emptied in a column the other rows fill, and the value dropped from one
// "label: value" list item. Pure and deterministic, like scripts/bench-mutations.ts.
import { linesOf, replaceLine, type Mutation, type Plant } from "../bench-text.ts";

const LABELLED_ITEM = /^(\s*[-*] [^:：\n]{1,30}[:：])[^\S\n]*\S.*$/u;
const DELIMITER_ROW = /^\|(?:\s*:?-+:?\s*\|)+\s*$/u;
const MIN_BODY_ROWS = 3;

const secondCell = (row: string): string | undefined => row.split("|")[2]?.trim();

/** The body rows of the table under a delimiter row: every row starting with a pipe up to the first that does not. */
const bodyOf = (lines: readonly string[], delimiter: number): string[] => {
  const after = lines.slice(delimiter + 1);
  const end = after.findIndex((line) => !line.startsWith("|"));
  return end === -1 ? after : after.slice(0, end);
};

/** A table with enough body rows whose second column every row fills: emptying one cell there is a blank among filled ones. */
const fillsSecondColumn = (lines: readonly string[], index: number): boolean => {
  const body = bodyOf(lines, index);
  return DELIMITER_ROW.test(lines[index] ?? "") && body.length >= MIN_BODY_ROWS && body.every((row) => (secondCell(row) ?? "") !== "");
};

/** The first body row of the first such table, with its second cell emptied. */
const blankCell = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const delimiter = lines.findIndex((_line, index) => fillsSecondColumn(lines, index));
  const row = lines[delimiter + 1];
  if (delimiter === -1 || row === undefined) return undefined;
  const cells = row.split("|");
  const emptied = [...cells.slice(0, 2), "  ", ...cells.slice(3)].join("|");
  return { source: replaceLine(lines, delimiter + 1, emptied), line: delimiter + 2 };
};

/** The second "label: value" item of a list whose items before and after it also carry values, with the value dropped. */
const blankItem = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const index = lines.findIndex((line, at) => at > 0 && LABELLED_ITEM.test(line) && LABELLED_ITEM.test(lines[at - 1] ?? ""));
  const label = LABELLED_ITEM.exec(lines[index] ?? "")?.[1];
  return label === undefined ? undefined : { source: replaceLine(lines, index, label), line: index + 1 };
};

export const MUTATIONS: readonly Mutation[] = [
  { id: "table-cell-blanked", rule: "empty-table-cell", languages: ["ja", "en"], plant: blankCell },
  { id: "list-value-dropped", rule: "empty-list-item", languages: ["ja", "en"], plant: blankItem },
];
