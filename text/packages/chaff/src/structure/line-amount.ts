import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { CELL_SEPARATOR } from "./bare-numbers.ts";
import { TABLE_RULE } from "./runs.ts";
import { roundedMatches } from "./tax.ts";
import { holds } from "./change-rate-table.ts";
import { roleOf, type QuantityRole, type QuantityWord } from "./order-quantity.ts";
import { hasSuperscriptPower } from "../facts/superscript-power.ts";
import { perUnitPrice, priceHeadingUnit, quantityUnit, unitsAgree, type UnitWord } from "./line-amount-unit.ts";

/**
 * 明細の表で、数量 × 単価が金額と合わない行。見出しの行から数量・単価・金額の列を語（quantity-column、unit-price-column、
 * line-amount-column）で見つけ、本体の行ごとに数量の升の頭の数と単価の升の数を掛け、金額の升の数と比べる。
 * 単価と金額は、数の前後に書いた印（$、円、万円）が同じときだけ比べる。端数は切り捨て・四捨五入・切り上げのどれでもよい。
 * 単価が何かあたり（$100/hour、月額、Rate の列）なら、数量がその単位か単位の無い数のときだけ比べる。何あたりか言わない
 * Rate の列は、数量の見出しが単位を言えば（Hours、Miles）その単位あたりと読む。発注・納品・残の数量の列（order-quantity-column）
 * が並ぶ納品書では、どれか一つの数量で金額になれば合っていると読む。Pure.
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
  /** Heading words of a delivery note's ordered, delivered and backordered counts (order-quantity-column). */
  readonly orderRoles: readonly QuantityWord[];
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
  const wanted = names.map((name) => plain(name).toLowerCase());
  return header.findIndex((cell) => wanted.includes(plain(cell.text).toLowerCase()));
};

/** What a quantity column counts: a plain quantity (数量), or a delivery note's ordered, delivered or backordered count. */
type QuantityKind = "quantity" | QuantityRole;

/** A quantity column, the unit its heading says (Hours), and the unit the price is per beside it (undefined when none is said). */
type QuantityColumn = { readonly index: number; readonly kind: QuantityKind; readonly unit: string | undefined; readonly priceUnit: string | undefined };

type Table = { readonly quantities: readonly QuantityColumn[]; readonly unitPrice: number; readonly amount: number };

/** The column a mismatch is shown against: a delivery note bills what was delivered, then a plain quantity, then what was ordered. */
const SHOWN_FIRST: readonly QuantityKind[] = ["delivered", "quantity", "ordered", "backordered"];

const headerUnit = (cell: Cell | undefined, words: LineAmountWords): string | undefined =>
  cell === undefined ? undefined : words.headerUnits.find((word) => plain(word.pattern).toLowerCase() === plain(cell.text).toLowerCase())?.unit;

const kindOf = (cell: Cell, words: LineAmountWords): QuantityKind | undefined => {
  if (columnNamed([cell], words.quantity) === 0) return "quantity";
  const role = roleOf(cell.text, words.orderRoles);
  return role === "both" ? undefined : role;
};

const namesQuantity = (cell: Cell, words: LineAmountWords): boolean => words.quantity.some((word) => holds(plain(cell.text).toLowerCase(), word));

/**
 * The quantity columns: each heading named as a quantity (数量), and each naming an ordered, delivered or backordered
 * count (発注数量, Qty delivered). A role word alone ("Delivered") may head a date, so it is read only beside another role
 * column. Two columns of one kind leave no way to choose, so such a table is not read.
 */
const quantityColumnsOf = (header: readonly Cell[], words: LineAmountWords): Omit<QuantityColumn, "priceUnit">[] | undefined => {
  const kinds = header.map((cell) => kindOf(cell, words));
  const roleColumns = kinds.filter((kind) => kind !== undefined && kind !== "quantity").length;
  const columns = header.flatMap((cell, index) => {
    const kind = kinds[index];
    if (kind === undefined || (kind !== "quantity" && roleColumns < 2 && !namesQuantity(cell, words))) return [];
    return [{ index, kind, unit: headerUnit(cell, words) }];
  });
  return columns.length === 0 || new Set(columns.map((column) => column.kind)).size < columns.length ? undefined : columns;
};

const tableOf = (header: readonly Cell[], words: LineAmountWords): Table | undefined => {
  const quantities = quantityColumnsOf(header, words);
  const [unitPrice, amount] = [columnNamed(header, words.unitPrice), columnNamed(header, words.amount)];
  if (quantities === undefined || unitPrice < 0 || amount < 0 || unitPrice === amount) return undefined;
  if (quantities.some((column) => column.index === unitPrice || column.index === amount)) return undefined;
  const priceUnit = headerUnit(header[unitPrice], words);
  const rateUnits = words.units.map((word) => word.unit);
  return { quantities: quantities.map((column) => ({ ...column, priceUnit: priceHeadingUnit(priceUnit, column.unit, rateUnits) })), unitPrice, amount };
};

/** The unit the quantity cell counts: its own word, else its heading's ("Hours"). */
const rowQuantityUnit = (cell: Cell, column: QuantityColumn, words: LineAmountWords): string | undefined => {
  const unit = quantityUnit(quantityWord(cell), words.units);
  return unit === "" && column.unit !== undefined ? column.unit : unit;
};

/** quantity × price, written the way the amount cell writes its number (grouping, decimals, marks). */
const shownExpected = (amount: CellNumber, exactCents: number): string => {
  const exact = exactCents / CENTS;
  const decimals = Number.isInteger(Math.round(exact * CENTS) / CENTS) && amount.decimals === 0 ? 0 : Math.max(amount.decimals, 2);
  const number = exact.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals, useGrouping: amount.grouped });
  return `${amount.before}${number}${amount.after}`;
};

const usedColumns = (table: Table): number[] => [...table.quantities.map((column) => column.index), table.unitPrice, table.amount];

const hasDigit = (cell: Cell): boolean => /\d/u.test(plain(cell.text));

/** Another cell than the item name with a number in it (a discount, a tax rate): the amount may not be quantity × price alone. */
const hasOtherNumber = (cells: readonly Cell[], table: Table): boolean =>
  cells.some((cell, index) => index > 0 && !usedColumns(table).includes(index) && hasDigit(cell));

type Reading = { readonly column: QuantityColumn; readonly cell: Cell; readonly quantity: number };

/**
 * The row's quantities, one per quantity column whose cell holds one; a cell without a number (an empty remainder) is
 * skipped. Undefined when a cell holds digits that are no quantity ("6 x 2"), or when no column holds one.
 */
const readingsOf = (cells: readonly Cell[], table: Table, words: LineAmountWords): Reading[] | undefined => {
  const readings = table.quantities.flatMap((column) => {
    const cell = cells[column.index];
    return cell === undefined ? [] : [{ column, cell, quantity: quantityOf(cell, words.measureUnits) }];
  });
  if (readings.some(({ cell, quantity }) => quantity === undefined && hasDigit(cell))) return undefined;
  const read = readings.flatMap(({ column, cell, quantity }) => (quantity === undefined ? [] : [{ column, cell, quantity }]));
  return read.length === 0 ? undefined : read;
};

const shownFirst = (readings: readonly Reading[]): Reading | undefined =>
  readings.toSorted((left, right) => SHOWN_FIRST.indexOf(left.column.kind) - SHOWN_FIRST.indexOf(right.column.kind))[0];

type Priced = { readonly price: CellNumber; readonly amount: CellNumber; readonly perUnit: string | undefined };

/** The row's price and amount, when both are one number written with the same marks (a per-unit mark taken off the price). */
const pricedOf = (cells: readonly Cell[], table: Table, words: LineAmountWords): Priced | undefined => {
  const [priceCell, amountCell] = [cells[table.unitPrice], cells[table.amount]];
  const price = priceCell === undefined ? undefined : cellNumber(priceCell);
  const amount = amountCell === undefined ? undefined : cellNumber(amountCell);
  if (price === undefined || amount === undefined) return undefined;
  const perUnit = perUnitPrice(price.before, price.after, words.perUnitMarks);
  const marks = perUnit ?? price;
  return marks.before === amount.before && marks.after === amount.after ? { price, amount, perUnit: perUnit?.unit } : undefined;
};

/**
 * A row is reported only when no quantity column times the price gives the amount: a delivery note may bill what was
 * ordered or what was delivered, and either is right. The finding shows the column SHOWN_FIRST names.
 */
const rowIssue = (row: Line, table: Table, words: LineAmountWords): StructureIssue[] => {
  const cells = cellsOf(row);
  const readings = hasOtherNumber(cells, table) ? undefined : readingsOf(cells, table, words);
  const priced = readings === undefined ? undefined : pricedOf(cells, table, words);
  if (readings === undefined || priced === undefined) return [];
  const { price, amount, perUnit } = priced;
  if (!readings.every(({ cell, column }) => unitsAgree(rowQuantityUnit(cell, column, words), perUnit ?? column.priceUnit))) return [];
  const centsOf = (reading: Reading): number => reading.quantity * price.value * CENTS;
  if (readings.some((reading) => roundedMatches(Math.round(amount.value * CENTS), centsOf(reading), amount.decimals === 0))) return [];
  const shown = shownFirst(readings);
  if (shown === undefined) return [];
  const values = { written: amount.written, quantity: plain(shown.cell.text), price: price.written, expected: shownExpected(amount, centsOf(shown)) };
  return [{ offset: amount.offset, values }];
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
