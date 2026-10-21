// Whether a Markdown table pictures a spreadsheet: an empty corner cell, the sheet's column letters A, B, C… in order
// across the header, and the sheet's row numbers 1, 2, 3… in order down the first column. Such a table draws cells as
// they sit in the sheet, and a cell left empty there is an empty cell of the sheet, not a value the writer forgot. A
// table that only names options A and B, or rows r1 and r2, is not one. Pure.

const FIRST_COLUMN = "A".charCodeAt(0);

/** At least two lettered columns: a header of "A" alone is a label, not a sheet. */
const MIN_COLUMNS = 2;

const isColumnLetter = (cell: string, index: number): boolean => cell === String.fromCharCode(FIRST_COLUMN + index);

const isRowNumber = (cell: string, index: number): boolean => cell === String(index + 1);

/** The header cells and the first cell of each body row, as written: ["", "A", "B"] over ["1", "2", "3"]. */
export const picturesSpreadsheet = (headerCells: readonly string[], rowLabels: readonly string[]): boolean => {
  const [corner, ...letters] = headerCells.map((cell) => cell.trim());
  const labels = rowLabels.map((cell) => cell.trim());
  return corner === "" && letters.length >= MIN_COLUMNS && letters.every(isColumnLetter) && labels.length > 0 && labels.every(isRowNumber);
};
