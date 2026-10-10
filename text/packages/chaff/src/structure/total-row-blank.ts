// A total, subtotal or tax row of a priced table fills only the amount: its quantity and unit-price cells are blank
// because they have nothing to say (| 合計 | | | 48,400円 |). Pure; the caller decides which rows are total rows.

/** One body row: whether its first cell is a total or tax label, and each cell's text (undefined when blank). */
export type BodyRow = { readonly total: boolean; readonly cells: readonly (string | undefined)[] };

const FIGURE = /\p{Nd}/u;

/** Whether every filled cell of a column, in the rows that are not totals, holds a figure, and at least one is filled. */
const isFigureColumn = (rows: readonly BodyRow[], column: number): boolean => {
  const filled = rows.filter((row) => !row.total).flatMap((row) => row.cells[column] ?? []);
  return filled.length > 0 && filled.every((text) => FIGURE.test(text));
};

/** The amount column: the rightmost column after the first whose item rows all give a figure. Undefined when none does. */
export const amountColumnOf = (rows: readonly BodyRow[], columns: number): number | undefined =>
  Array.from({ length: columns }, (_unused, column) => column)
    .slice(1)
    .findLast((column) => isFigureColumn(rows, column));

/** A blank a total row may leave: any cell but the amount, and only in a table that has an amount column to fill. */
export const isTotalRowGap = (row: BodyRow, column: number, amountColumn: number | undefined): boolean =>
  row.total && amountColumn !== undefined && column !== amountColumn;
