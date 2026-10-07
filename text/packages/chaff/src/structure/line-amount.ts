import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { CELL_SEPARATOR } from "./bare-numbers.ts";
import { TABLE_RULE } from "./runs.ts";
import { roundedMatches } from "./tax.ts";

/**
 * 明細の表で、数量 × 単価が金額と合わない行。見出しの行から数量・単価・金額の列を語（quantity-column、unit-price-column、
 * line-amount-column）で見つけ、本体の行ごとに数量の升の頭の数と単価の升の数を掛け、金額の升の数と比べる。
 * 単価と金額は、数の前後に書いた印（$、円、万円）が同じときだけ比べる。端数は切り捨て・四捨五入・切り上げのどれでもよい。Pure.
 */
export type LineAmountWords = {
  readonly quantity: readonly string[];
  readonly unitPrice: readonly string[];
  readonly amount: readonly string[];
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

/** The number a quantity cell starts with ("4", "3人日", "2.5 hours"), undefined when it does not, or holds another ("2 x 3"). */
export const quantityOf = (cell: Cell): number | undefined => {
  const text = plain(cell.text);
  const match = LEADING_NUMBER.exec(text);
  if (match === null || /\d/u.test(text.slice(match[0].length))) return undefined;
  return Number(`${(match[1] ?? "").replaceAll(",", "")}${match[2] ?? ""}`);
};

const columnNamed = (header: readonly Cell[], names: readonly string[]): number => {
  const wanted = names.map((name) => name.toLowerCase());
  return header.findIndex((cell) => wanted.includes(plain(cell.text).toLowerCase()));
};

type Columns = { readonly quantity: number; readonly unitPrice: number; readonly amount: number };

const columnsOf = (header: readonly Cell[], words: LineAmountWords): Columns | undefined => {
  const columns = { quantity: columnNamed(header, words.quantity), unitPrice: columnNamed(header, words.unitPrice), amount: columnNamed(header, words.amount) };
  return Object.values(columns).some((index) => index < 0) || new Set(Object.values(columns)).size < 3 ? undefined : columns;
};

/** quantity × price, written the way the amount cell writes its number (grouping, decimals, marks). */
const shownExpected = (amount: CellNumber, exactCents: number): string => {
  const exact = exactCents / CENTS;
  const decimals = Number.isInteger(Math.round(exact * CENTS) / CENTS) && amount.decimals === 0 ? 0 : Math.max(amount.decimals, 2);
  const number = exact.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: amount.grouped });
  return `${amount.before}${number}${amount.after}`;
};

const rowIssue = (row: Line, columns: Columns): StructureIssue[] => {
  const cells = cellsOf(row);
  const quantityCell = cells[columns.quantity];
  const priceCell = cells[columns.unitPrice];
  const amountCell = cells[columns.amount];
  if (quantityCell === undefined || priceCell === undefined || amountCell === undefined) return [];
  const quantity = quantityOf(quantityCell);
  const price = cellNumber(priceCell);
  const amount = cellNumber(amountCell);
  if (quantity === undefined || price === undefined || amount === undefined) return [];
  if (price.before !== amount.before || price.after !== amount.after) return [];
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
    const columns = columnsOf(cellsOf(header), words);
    return columns === undefined ? [] : rows.flatMap((row) => rowIssue(row, columns));
  });
