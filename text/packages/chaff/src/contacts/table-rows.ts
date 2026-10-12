// A two-column table row named by an address label (| 物件所在地 | 東京都… |, | Address | 12 Elm Street … |) read as the
// line `物件所在地 東京都…` the contact readers read: the prose masks tables, so the row's name is written back right before
// its value, at the row's own offsets. Only a table of two columns: a wider table's rows name whose address it is in
// another cell, and a list of shops or venues would compare neighbours. Pure.
import type { LexiconEntry } from "../plugin.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { withoutEdgeMarks } from "../facts/trim-marks.ts";
import { linesOf } from "../structure/lines.ts";

const TWO_COLUMNS = 2;
const LETTER = /\p{L}/u;
const LATIN_START = /^[A-Za-z]/u;

/** Whether a row's name ends with a label: 物件所在地 with 所在地, Property address with address (a Latin label as a whole word). */
const endsWithLabel = (name: string, label: string): boolean => {
  const lowered = name.toLowerCase();
  const pattern = label.toLowerCase();
  if (!lowered.endsWith(pattern)) return false;
  return !LATIN_START.test(label) || !LETTER.test(lowered.charAt(lowered.length - pattern.length - 1));
};

type LabelledRow = { readonly name: string; readonly nameEnd: number; readonly value: Cell };

const labelledRow = (cells: readonly Cell[], labels: readonly LexiconEntry[]): LabelledRow[] => {
  const [first, value] = cells;
  if (cells.length !== TWO_COLUMNS || first === undefined || value === undefined) return [];
  const name = withoutEdgeMarks(first.text);
  return labels.some((entry) => endsWithLabel(name, entry.pattern)) ? [{ name, nameEnd: first.end, value }] : [];
};

/** The two-column rows of a text's tables whose first cell names an address. */
const labelledRows = (tables: string, labels: readonly LexiconEntry[]): LabelledRow[] =>
  tablesOf(linesOf(tables))
    .filter((table) => cellsOf(table.header).length === TWO_COLUMNS)
    .flatMap((table) => table.rows.flatMap((row) => labelledRow(cellsOf(row), labels)));

/**
 * The prose with each labelled two-column row of `tables` (the same text with its tables shown) written back as its name
 * then its value. The name ends where its cell ends, so it stays inside the row's span. Offsets are kept.
 */
export const proseWithLabelledRows = (prose: string, tables: string, labels: readonly LexiconEntry[]): string => {
  const pieces: string[] = [];
  const end = labelledRows(tables, labels).reduce((from, row) => {
    const nameStart = row.nameEnd - row.name.length;
    if (nameStart < from) return from;
    pieces.push(prose.slice(from, nameStart), row.name, prose.slice(row.nameEnd, row.value.start), row.value.text);
    return row.value.end;
  }, 0);
  pieces.push(prose.slice(end));
  return pieces.join("");
};
