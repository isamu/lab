// reference-number-repeated: in a table of separate items (expense lines, invoice lines), the same receipt, invoice or slip
// number on two rows. The column is found by its heading words only (lexicon reference-column). Pure.
import type { ChangeTable, TableCell } from "./change-rate-table.ts";
import { plain } from "./change-rate-table.ts";

/** The second row that carries a number, and the first row that already did (both as offsets into the source). */
export type RepeatedReference = { readonly offset: number; readonly firstOffset: number; readonly number: string; readonly heading: string };

/** A heading or a number compared without case, width or spaces: 「領収書 No.」 is 「領収書No.」, "t-0384" is "T-0384". */
const keyOf = (text: string): string => plain(text).toLowerCase().replace(/\s+/gu, "");

const DIGIT = /\d/u;

/** The one column whose heading is a reference-number heading; undefined when none or several are. */
export const referenceColumnOf = (headings: readonly string[], words: readonly string[]): number | undefined => {
  const wanted = new Set(words.map(keyOf));
  const indexes = headings.flatMap((heading, index) => (wanted.has(keyOf(heading)) ? [index] : []));
  return indexes.length === 1 ? indexes[0] : undefined;
};

const offsetOf = (cell: TableCell): number => cell.start + (cell.text.length - cell.text.trimStart().length);

/** The cells of the column that hold a number: blank, a dash, 「なし」 and "N/A" hold no digit and are not numbers. */
const numberCells = (rows: readonly (readonly TableCell[])[], column: number): TableCell[] =>
  rows.flatMap((row) => {
    const cell = row[column];
    return cell !== undefined && DIGIT.test(plain(cell.text)) ? [cell] : [];
  });

/**
 * A table's one repeated number. Only a table where exactly one number is written exactly twice is read: when several
 * numbers repeat, or one three times, the rows are grouped by slip (the lines of one invoice, an invoice and its payment),
 * and a repeat is how the table is meant to be read.
 */
const repeatOf = (cells: readonly TableCell[], heading: string): RepeatedReference[] => {
  const byKey = cells.reduce((groups, cell) => {
    const key = keyOf(cell.text);
    return groups.set(key, [...(groups.get(key) ?? []), cell]);
  }, new Map<string, TableCell[]>());
  const repeated = [...byKey.values()].filter((group) => group.length > 1);
  const [only] = repeated;
  if (repeated.length !== 1 || only?.length !== 2) return [];
  const [first, second] = only;
  if (first === undefined || second === undefined) return [];
  return [{ offset: offsetOf(second), firstOffset: offsetOf(first), number: plain(second.text), heading: plain(heading) }];
};

export const repeatedReferences = (tables: readonly ChangeTable[], words: readonly string[]): RepeatedReference[] =>
  tables.flatMap((table) => {
    const column = referenceColumnOf(
      table.header.map((cell) => cell.text),
      words,
    );
    const heading = column === undefined ? undefined : table.header[column];
    if (column === undefined || heading === undefined) return [];
    return repeatOf(numberCells(table.rows, column), heading.text);
  });
