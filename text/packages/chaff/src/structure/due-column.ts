import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { linesOf } from "./lines.ts";

const keyOf = (text: string): string => withoutEdgeMarks(text).normalize("NFKC").toLowerCase().replace(/\s+/gu, " ").trim();

type Range = { readonly start: number; readonly end: number };

/**
 * The offsets of a table's cells under a column headed by a deadline word alone, after the first column
 * (| Action | Owner | Due date |). Such a table lists actions, each with its own deadline, in the order of the actions: its
 * dates are not a schedule. A table that opens with the deadline (| 期限 | 担当 | 内容 |) is sorted by it, and is kept. Pure.
 */
const dueColumnCells = (source: string, dueLabels: readonly string[]): Range[] => {
  const labels = new Set(dueLabels.map(keyOf));
  return tablesOf(linesOf(source)).flatMap((table) => {
    const dueIndexes = cellsOf(table.header).flatMap((cell, index) => (index > 0 && labels.has(keyOf(cell.text)) ? [index] : []));
    if (dueIndexes.length === 0) return [];
    return table.rows.flatMap((row) => {
      const cells = cellsOf(row);
      return dueIndexes.flatMap((index) => {
        const cell = cells[index];
        return cell === undefined ? [] : [{ start: cell.start, end: cell.end }];
      });
    });
  });
};

/** The points that do not sit in a deadline column: the ones a schedule may be made of. */
export const scheduledPoints = <Point extends { readonly offset: number }>(source: string, points: readonly Point[], dueLabels: readonly string[]): Point[] => {
  const cells = dueColumnCells(source, dueLabels);
  return points.filter((point) => !cells.some((cell) => point.offset >= cell.start && point.offset < cell.end));
};
