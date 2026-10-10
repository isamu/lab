import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { CELL_SEPARATOR } from "./bare-numbers.ts";
import { TABLE_RULE } from "./runs.ts";
import { roundedMatches } from "./tax.ts";
import { hasSuperscriptPower } from "../facts/superscript-power.ts";
import { perUnitPrice, quantityUnit, unitsAgree, type UnitWord } from "./line-amount-unit.ts";

/**
 * 明細の表で、数量 × 単価が金額と合わない行。見出しの行から数量・単価・金額の列を語（quantity-column、unit-price-column、
 * line-amount-column）で見つけ、本体の行ごとに数量の升の頭の数と単価の升の数を掛け、金額の升の数と比べる。
 * 単価と金額は、数の前後に書いた印（$、円、万円）が同じときだけ比べる。端数は切り捨て・四捨五入・切り上げのどれでもよい。
 * 単価が何かあたり（$100/hour、月額、Rate の列）なら、数量がその単位か単位の無い数のときだけ比べる。Pure.
 */
export type LineAmountWords = {
  readonly quantity: readonly string[];
  readonly unitPrice: readonly string[];
  readonly amount: readonly string[];
  /** Unit words of a quantity (rate-unit). */
  readonly units: readonly UnitWord[];
  /** Marks saying a price is per a unit (per-unit-mark). */
  readonly perUnitMarks: readonly UnitWord[];
  /** Column headings that say the unit of their column (Hours, Rate). */
  readonly headerUnits: readonly UnitWord[];
  /** Measure units written after a number (m³, km²): a quantity cell may end in one even when it holds a digit. */
  readonly measureUnits: readonly string[];
};

type Cell = { readonly start: number; readonly text: string };

/** A number with what is written before and after it in one cell: "$1,500.00" is $ 1500 "", "15万円" is "" 15 万円. */
type CellNumber = {
  readonly before: string;
  readonly value: number;
  readonly after: string;
  readonly offset: number;
  readonly written: string;
  readonly grouped: boolean;
  readonly decimals: number;
};

const CENTS = 100;
const ONE_NUMBER = /^([^\d]*?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?([^\d]*)$/u;
const LEADING_NUMBER = /^(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(?![\d,])/u;
const NEGATIVE = /[-−▲△(（]/u;

const cellsOf = (line: Line): Cell[] => {
  const bounds = [-1, ...[...line.text.matchAll(CELL_SEPARATOR)].map((match) => match.index), line.text.length];
  const cells = bounds.slice(1).map((end, index) => {
    const from = (bounds[index] ?? 0) + 1;
    return { start: line.start + from, text: line.text.slice(from, end) };
  });
  const trimmed = line.text.trim();
  return cells.slice(trimmed.startsWith("|") ? 1 : 0, trimmed.endsWith("|") ? cells.length - 1 : cells.length);
};

const plain = (text: string): string => text.normalize("NFKC").replace(/[*_`]/gu, "").trim();

/** The one number of a price cell with its marks, undefined when the cell holds none, more, or a negative one. */
export const cellNumber = (cell: Cell): CellNumber | undefined => {
  const text = plain(cell.text);
  const match = ONE_NUMBER.exec(text);
  if (match === null) return undefined;
  const [, before = "", whole = "", fraction = "", after = ""] = match;
  if (NEGATIVE.test(before) || NEGATIVE.test(after)) return undefined;
  return {
    before: before.trim(),
    value: Number(`${whole.replaceAll(",", "")}${fraction}`),
    after: after.trim(),
    offset: cell.start + (cell.text.length - cell.text.trimStart().length),
    written: text,
    grouped: whole.includes(","),
    decimals: Math.max(0, fraction.length - 1),
  };
};

const isMeasureUnit = (word: string, measureUnits: readonly string[]): boolean => measureUnits.some((unit) => plain(unit).toLowerCase() === word.toLowerCase());

/**
 * The number a quantity cell starts with ("4", "3人日", "2.5 hours", "16m³"), undefined when it does not, or holds another
 * ("2 x 3", "10³"). A digit after the number is allowed only as part of a measure unit (m³ and ㎥ normalise to m3).
 */
export const quantityOf = (cell: Cell, measureUnits: readonly string[]): number | undefined => {
  if (hasSuperscriptPower(cell.text)) return undefined;
  const text = plain(cell.text);
  const match = LEADING_NUMBER.exec(text);
  if (match === null) return undefined;
  const rest = text.slice(match[0].length).trim();
  if (/\d/u.test(rest) && !isMeasureUnit(rest, measureUnits)) return undefined;
  return Number(`${(match[1] ?? "").replaceAll(",", "")}${match[2] ?? ""}`);
};

/** What a quantity cell writes after its number ("days" in "2 days"). */
const quantityWord = (cell: Cell): string => plain(cell.text).replace(LEADING_NUMBER, "").trim();

const columnNamed = (header: readonly Cell[], names: readonly string[]): number => {
  const wanted = names.map((name) => name.toLowerCase());
  return header.findIndex((cell) => wanted.includes(plain(cell.text).toLowerCase()));
};

type Columns = { readonly quantity: number; readonly unitPrice: number; readonly amount: number };

/** A table's columns, and the units its quantity and price headings say (undefined when they say none). */
type Table = { readonly columns: Columns; readonly quantityUnit: string | undefined; readonly priceUnit: string | undefined };

const headerUnit = (cell: Cell | undefined, words: LineAmountWords): string | undefined =>
  cell === undefined ? undefined : words.headerUnits.find((word) => word.pattern.toLowerCase() === plain(cell.text).toLowerCase())?.unit;

const tableOf = (header: readonly Cell[], words: LineAmountWords): Table | undefined => {
  const columns = { quantity: columnNamed(header, words.quantity), unitPrice: columnNamed(header, words.unitPrice), amount: columnNamed(header, words.amount) };
  if (Object.values(columns).some((index) => index < 0) || new Set(Object.values(columns)).size < 3) return undefined;
  return { columns, quantityUnit: headerUnit(header[columns.quantity], words), priceUnit: headerUnit(header[columns.unitPrice], words) };
};

/** The unit the quantity cell counts: its own word, else its heading's ("Hours"). */
const rowQuantityUnit = (cell: Cell, table: Table, words: LineAmountWords): string | undefined => {
  const unit = quantityUnit(quantityWord(cell), words.units);
  return unit === "" && table.quantityUnit !== undefined ? table.quantityUnit : unit;
};

/** quantity × price, written the way the amount cell writes its number (grouping, decimals, marks). */
const shownExpected = (amount: CellNumber, exactCents: number): string => {
  const exact = exactCents / CENTS;
  const decimals = Number.isInteger(Math.round(exact * CENTS) / CENTS) && amount.decimals === 0 ? 0 : Math.max(amount.decimals, 2);
  const number = exact.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: amount.grouped });
  return `${amount.before}${number}${amount.after}`;
};

/** Another cell than the item name with a number in it (a discount, a tax rate): the amount may not be quantity × price alone. */
const hasOtherNumber = (cells: readonly Cell[], columns: Columns): boolean =>
  cells.some((cell, index) => index > 0 && !Object.values(columns).includes(index) && /\d/u.test(plain(cell.text)));

const rowIssue = (row: Line, table: Table, words: LineAmountWords): StructureIssue[] => {
  const { columns } = table;
  const cells = cellsOf(row);
  if (hasOtherNumber(cells, columns)) return [];
  const quantityCell = cells[columns.quantity];
  const priceCell = cells[columns.unitPrice];
  const amountCell = cells[columns.amount];
  if (quantityCell === undefined || priceCell === undefined || amountCell === undefined) return [];
  const quantity = quantityOf(quantityCell, words.measureUnits);
  const price = cellNumber(priceCell);
  const amount = cellNumber(amountCell);
  if (quantity === undefined || price === undefined || amount === undefined) return [];
  const perUnit = perUnitPrice(price.before, price.after, words.perUnitMarks);
  const marks = perUnit ?? price;
  if (marks.before !== amount.before || marks.after !== amount.after) return [];
  if (!unitsAgree(rowQuantityUnit(quantityCell, table, words), perUnit?.unit ?? table.priceUnit)) return [];
  const exactCents = quantity * price.value * CENTS;
  if (roundedMatches(Math.round(amount.value * CENTS), exactCents, amount.decimals === 0)) return [];
  return [
    {
      offset: amount.offset,
      values: { written: amount.written, quantity: plain(quantityCell.text), price: price.written, expected: shownExpected(amount, exactCents) },
    },
  ];
};

/** Each table: its header row and its body rows. */
const tablesOf = (lines: readonly Line[]): { header: Line; rows: Line[] }[] =>
  lines.flatMap((line, index) => {
    const header = lines[index - 1];
    if (!TABLE_RULE.test(line.text) || header === undefined || !header.text.includes("|")) return [];
    const after = lines.slice(index + 1);
    const end = after.findIndex((row) => !row.text.includes("|"));
    return [{ header, rows: end === -1 ? after : after.slice(0, end) }];
  });

export const lineAmountMismatches = (source: string, words: LineAmountWords): StructureIssue[] =>
  tablesOf(linesOf(source)).flatMap(({ header, rows }) => {
    const table = tableOf(cellsOf(header), words);
    return table === undefined ? [] : rows.flatMap((row) => rowIssue(row, table, words));
  });
