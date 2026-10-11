// cumulative-below-current: a table with a this-period column and a cumulative one (当月 / 累計, "This period" / "Year to
// date"), where a row's cumulative figure is lower than its figure for this period. A running total includes this period, so
// it cannot be the smaller. The columns are named by their heading words only. Pure.
import type { StructureIssue } from "./issues.ts";
import { holds, plain, sameHeadingUnits, valueIn, type ChangeTable, type TableCell } from "./change-rate-table.ts";

/**
 * current and cumulative name the two columns; prior names a heading that is neither (「前月までの累計」 is not this period's
 * running total); level names a figure that is a level, not a sum over periods (an average, a rate, a balance), in a row label or a heading.
 */
export type CumulativeRole = "current" | "cumulative" | "prior" | "level";
export type CumulativeWord = { readonly pattern: string; readonly role: CumulativeRole };

/**
 * prior first (「前月累計」 is not the running total), then level ("Current balance" is not this period), then cumulative
 * (「当月累計」 is the running total, not this month). A prior or level heading is neither column.
 */
const HEADING_ORDER: readonly CumulativeRole[] = ["prior", "level", "cumulative", "current"];

const roleOf = (heading: string, words: readonly CumulativeWord[]): CumulativeRole | undefined => {
  const key = plain(heading).toLowerCase();
  return HEADING_ORDER.find((role) => words.some((word) => word.role === role && holds(key, word.pattern)));
};

type Columns = { readonly current: number; readonly cumulative: number };

/** The one this-period column and the one cumulative column; undefined when either is missing or doubled, or their units differ. */
export const cumulativeColumnsOf = (headings: readonly string[], words: readonly CumulativeWord[]): Columns | undefined => {
  const roles = headings.map((heading) => roleOf(heading, words));
  const all = (role: CumulativeRole): number[] => roles.flatMap((found, index) => (found === role ? [index] : []));
  const [currents, cumulatives] = [all("current"), all("cumulative")];
  const [current, cumulative] = [currents[0], cumulatives[0]];
  if (currents.length !== 1 || cumulatives.length !== 1 || current === undefined || cumulative === undefined) return undefined;
  return sameHeadingUnits(headings[current], headings[cumulative]) ? { current, cumulative } : undefined;
};

/** A row whose label says its figure is a level (平均単価, "Average rate"), which a running total does not add up. */
const isLevelRow = (row: readonly TableCell[], columns: Columns, words: readonly CumulativeWord[]): boolean => {
  const label = columns.current === 0 || columns.cumulative === 0 ? "" : plain(row[0]?.text ?? "").toLowerCase();
  return words.some((word) => word.role === "level" && holds(label, word.pattern));
};

/** Room for the binary fractions of decimal amounts, as a share of the rounding allowed. */
const EPSILON = 1e-6;

const issueInRow = (row: readonly TableCell[], columns: Columns, words: readonly CumulativeWord[]): StructureIssue[] => {
  const [currentCell, cumulativeCell] = [row[columns.current], row[columns.cumulative]];
  if (currentCell === undefined || cumulativeCell === undefined || isLevelRow(row, columns, words)) return [];
  const [current, cumulative] = [valueIn(currentCell.text), valueIn(cumulativeCell.text)];
  if (current === undefined || cumulative === undefined || current.marks !== cumulative.marks) return [];
  const rounding = ((current.step + cumulative.step) / 2) * (1 + EPSILON);
  if (current.value - cumulative.value <= rounding) return [];
  const offset = cumulativeCell.start + (cumulativeCell.text.length - cumulativeCell.text.trimStart().length);
  return [{ offset, values: { cumulative: plain(cumulativeCell.text), current: plain(currentCell.text) } }];
};

/** Each row, in every table with one this-period and one cumulative column, whose cumulative figure is below this period's. */
export const cumulativeBelowCurrent = (tables: readonly ChangeTable[], words: readonly CumulativeWord[]): StructureIssue[] =>
  tables.flatMap((table) => {
    const columns = cumulativeColumnsOf(
      table.header.map((cell) => cell.text),
      words,
    );
    if (columns === undefined) return [];
    return table.rows.filter((row) => row.length === table.header.length).flatMap((row) => issueInRow(row, columns, words));
  });
