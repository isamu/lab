import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import type { PairedIssue, OrderDate } from "./labelled-date-order.ts";
import { labelPairsOf, type LabelPair, type OrderLabel } from "./labelled-order.ts";
import { linesOf, type Line } from "./lines.ts";

/**
 * Two dates of one table row that must come in order: a table whose header names an earlier-date column and a
 * later-date column of one pair (| ご利用日 | 獲得ポイント | 有効期限 |, | Date | Points | Expires |). Each row is compared
 * with itself only: a column is never paired with another table's. A header naming either side twice is not read, nor is
 * a cell without exactly one full date, nor a row with a passed word (期限切れ, expired). A group with context words is
 * read only when another header column contains one: a Date and Expiration date of a claims log are not a points table. Pure.
 */

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const keyOf = (text: string): string => withoutEdgeMarks(text).normalize("NFKC").toLowerCase().replace(/\s+/gu, " ");

type Column = { readonly index: number; readonly label: string };

/** The one header column that is one of the words, and the word; undefined when none or more than one is. */
const columnNamed = (header: readonly Cell[], words: readonly string[]): Column | undefined => {
  const named = header.flatMap((cell, index) => {
    const label = words.find((word) => keyOf(word) === keyOf(cell.text));
    return label === undefined ? [] : [{ index, label }];
  });
  return named.length === 1 ? named[0] : undefined;
};

const oneDateIn = (cell: Cell | undefined, dates: readonly OrderDate[]): OrderDate | undefined => {
  if (cell === undefined) return undefined;
  const within = dates.filter((date) => date.offset >= cell.start && (date.end ?? date.offset) <= cell.end && FULL_DATE.test(date.value));
  return within.length === 1 ? within[0] : undefined;
};

type Table = { readonly header: Line; readonly rows: readonly Line[] };

/** A group's words without a position name what the table is about: another header column must contain one (獲得ポイント). */
type GroupPair = LabelPair & { readonly context: readonly string[] };

const groupPairsOf = (labels: readonly OrderLabel[]): GroupPair[] =>
  [...new Set(labels.flatMap((label) => (label.group === undefined ? [] : [label.group])))].flatMap((group) => {
    const ofGroup = labels.filter((label) => label.group === group);
    const context = ofGroup.flatMap((label) => (label.position === undefined ? [keyOf(label.pattern)] : []));
    return labelPairsOf(ofGroup).map((pair) => ({ ...pair, context }));
  });

const aboutContext = (header: readonly Cell[], context: readonly string[]): boolean =>
  context.length === 0 || header.some((cell) => context.some((word) => keyOf(cell.text).includes(word)));

const rowOutOfOrder = (row: Line, earlier: Column, later: Column, dates: readonly OrderDate[]): PairedIssue[] => {
  const cells = cellsOf(row);
  const from = oneDateIn(cells[earlier.index], dates);
  const to = oneDateIn(cells[later.index], dates);
  if (from === undefined || to === undefined || to.value >= from.value) return [];
  const values = { later: to.value, earlier: from.value, later_label: later.label, earlier_label: earlier.label };
  return [{ offset: Math.max(from.offset, to.offset), values, period: false }];
};

const rowsOutOfOrder = (table: Table, pair: GroupPair, dates: readonly OrderDate[], passed: readonly string[]): PairedIssue[] => {
  const header = cellsOf(table.header);
  const earlier = columnNamed(header, pair.earlier);
  const later = columnNamed(header, pair.later);
  if (earlier === undefined || later === undefined || !aboutContext(header, pair.context)) return [];
  const reported = (row: Line): boolean => passed.some((word) => row.text.toLowerCase().includes(word.toLowerCase()));
  return table.rows.flatMap((row) => (reported(row) ? [] : rowOutOfOrder(row, earlier, later, dates)));
};

/** Every row of a table whose later-column date is before its earlier-column date, for each pair the lexicon names. */
export const columnDatesOutOfOrder = (source: string, dates: readonly OrderDate[], labels: readonly OrderLabel[], passed: readonly string[]): PairedIssue[] => {
  const tables = tablesOf(linesOf(source));
  return groupPairsOf(labels).flatMap((pair) => tables.flatMap((table) => rowsOutOfOrder(table, pair, dates, passed)));
};
