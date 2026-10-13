import type { StructureIssue } from "./issues.ts";
import { runsOf, type Line } from "./runs.ts";
import { columnOf, isTotalLabel, shownTotal, withoutLeadingBlankCells, type Amount } from "./total.ts";

/**
 * 税の行と、その上の金額に率を掛けた額。表か箇条書きの並びで、税の語（消費税・Sales tax）で始まり率（10%）を書いた行の
 * 金額を、上の最後の合計の行（小計）の金額に率を掛けた額と比べる。合計の行が無ければ、上の項目の和に掛ける。
 * 端数は切り捨て・四捨五入・切り上げのどれでもよく、円の位でも銭（セント）の位でもよい。
 * 内税（「うち消費税」）の行と、率の違う税の行が並ぶ並び（軽減税率）は読まない。Pure.
 */
export type TaxWords = {
  /** 税の行の頭の語（消費税、Sales tax）。 */
  readonly labels: readonly string[];
  /** 合計の行の頭の語（小計、Subtotal）。 */
  readonly totals: readonly string[];
  /** 税の行が内税だと分かる語（うち、included）。 */
  readonly included: readonly string[];
  /** 率で掛かる料金の行の頭の語（サービス料、Service charge）。税はその料金を足した額に掛かってもよい。 */
  readonly charges: readonly string[];
};

const RATE = /(\d{1,2}(?:\.\d{1,2})?)[ \t]?[%％]/u;
const PERCENT = new Set(["%", "％"]);
/** A sign or an opening bracket right before an amount (-$200, ▲500, (1,200)): the amount may be negative. */
const SIGNED = /[-−▲△(（][ \t]?(?:[$€£¥￥][ \t]?)?$/u;
const CENTS = 100;
/** More charge rows than this in a row give too many ways to tax them, so there is no base. */
const MAX_CHARGES = 4;
const MAX_RATE = 100;

type Row = { readonly line: Line; readonly text: string; readonly amounts: readonly Amount[] };

const rowsOf = (source: string, run: readonly Line[], amounts: readonly Amount[]): Row[] =>
  run.map((line) => ({
    line,
    text: source.slice(line.start, line.end),
    amounts: amounts.filter((amount) => amount.offset >= line.start && amount.offset <= line.end && !PERCENT.has(amount.unit)),
  }));

const rateOf = (text: string): number | undefined => {
  const rate = Number(RATE.exec(text)?.[1]);
  return Number.isFinite(rate) && rate > 0 && rate < MAX_RATE ? rate : undefined;
};

/** A tax or total row may leave its first cells blank and put its word in the first cell that is not (| | 小計 | 12,000円 |). */
const startsWithLabel = (row: Row, labels: readonly string[]): boolean => isTotalLabel(withoutLeadingBlankCells(row.text), labels);

const isTaxRow = (row: Row, words: TaxWords): boolean =>
  startsWithLabel(row, words.labels) && !words.included.some((word) => row.text.toLowerCase().includes(word.toLowerCase()));

const isChargeRow = (row: Row, words: TaxWords): boolean => isTotalLabel(row.text, words.charges) && rateOf(row.text) !== undefined;

/** The list marker at the start of a line (- $500) is not a sign. */
const isSigned = (source: string, row: Row, amount: Amount): boolean => {
  const before = source.slice(row.line.start, amount.offset);
  const sign = SIGNED.exec(before);
  return sign !== null && before.slice(0, sign.index).trim().length > 0;
};

/**
 * The one amount of the row in the column and unit of the tax amount, undefined when there is none, more than one, or
 * one that may be negative (a discount is not added as written).
 */
const amountAt = (source: string, row: Row, column: number, unit: string): Amount | undefined => {
  const matching = row.amounts.filter((amount) => amount.unit === unit && columnOf(source, row.line, amount.offset) === column);
  const [only] = matching;
  return matching.length === 1 && only !== undefined && !isSigned(source, row, only) ? only : undefined;
};

const sumOf = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

/** The amounts of the rows in the column and unit of the tax, undefined when a row has none (or more than one). */
const valuesAt = (source: string, rows: readonly Row[], column: number, unit: string): number[] | undefined => {
  const amounts = rows.map((row) => amountAt(source, row, column, unit));
  return amounts.some((amount) => amount === undefined) ? undefined : amounts.flatMap((amount) => (amount === undefined ? [] : [amount.value]));
};

/**
 * The base with each set of the charges above it added, the full sum last: a tax may be on the subtotal alone or with some
 * charges (hotels tax the service charge; a gratuity may be untaxed).
 */
const withCharges = (base: number, charges: readonly number[]): number[] =>
  charges.length > MAX_CHARGES ? [] : charges.reduce<number[]>((sums, charge) => [...sums, ...sums.map((sum) => sum + charge)], [0]).map((sum) => base + sum);

/**
 * The bases the rate may be on: the last total row above, or the sum of the item rows above when there is no total row,
 * each with and without the rate charge rows (a service charge) right above the row. Any other row with an amount between
 * the total and the row (a discount, shipping) may or may not be taxed, so there is no base.
 */
const basesOf = (source: string, above: readonly Row[], tax: Amount, column: number, words: TaxWords): number[] => {
  const chargeStart = above.findLastIndex((row) => !isChargeRow(row, words)) + 1;
  const charges = valuesAt(source, above.slice(chargeStart), column, tax.unit);
  if (charges === undefined) return [];
  const before = above.slice(0, chargeStart);
  const lastTotalIndex = before.findLastIndex((row) => startsWithLabel(row, words.totals));
  const lastTotal = before[lastTotalIndex];
  if (lastTotal !== undefined) {
    const total = amountAt(source, lastTotal, column, tax.unit);
    const between = before.slice(lastTotalIndex + 1);
    return total === undefined || between.some((row) => row.amounts.length > 0) ? [] : withCharges(total.value, charges);
  }
  const items = valuesAt(source, before, column, tax.unit);
  return items === undefined || items.length === 0 ? [] : withCharges(sumOf(items), charges);
};

/**
 * Whether a written amount is an exact one rounded down, to nearest or up, to the cent or (when toUnit) to the unit. Both
 * in cents. An amount written with cents ($59.00) is rounded to the cent only.
 */
export const roundedMatches = (writtenCents: number, exactCents: number, toUnits = true): boolean => {
  const toCent = [Math.floor(exactCents), Math.round(exactCents), Math.ceil(exactCents)];
  const toUnit = toUnits ? [Math.floor, Math.round, Math.ceil].map((round) => round(exactCents / CENTS) * CENTS) : [];
  return [...toCent, ...toUnit].some((candidate) => Math.abs(candidate - writtenCents) < 1);
};

/** Whether the written tax is base × rate, rounded down, to nearest or up, to the unit or to the cent. */
// base × rate% in cents: base × 100 × rate / 100.
export const taxMatches = (writtenCents: number, base: number, rate: number): boolean => roundedMatches(writtenCents, base * rate);

const issueOf = (source: string, rows: readonly Row[], index: number, rate: number, words: TaxWords): StructureIssue[] => {
  const row = rows[index];
  const tax = row?.amounts.length === 1 ? row.amounts[0] : undefined;
  if (row === undefined || tax === undefined || isSigned(source, row, tax)) return [];
  const column = columnOf(source, row.line, tax.offset);
  const bases = basesOf(source, rows.slice(0, index), tax, column, words);
  const base = bases.at(-1);
  if (base === undefined || bases.some((candidate) => taxMatches(Math.round(tax.value * CENTS), candidate, rate))) return [];
  const expectedCents = Math.round(base * rate);
  const shown = shownTotal(source, tax, expectedCents);
  return [{ offset: tax.offset, values: { written: shown.written ?? "", expected: shown.sum ?? "", rate: `${String(rate)}%` } }];
};

type RateRow = { readonly index: number; readonly rate: number };

const rateRowsOf = (rows: readonly Row[], isRateRow: (row: Row) => boolean): RateRow[] =>
  rows.flatMap((row, index) => {
    const rate = isRateRow(row) ? rateOf(row.text) : undefined;
    return rate === undefined ? [] : [{ index, rate }];
  });

/** Tax rows of different rates split the base (a reduced rate), so none is compared; a charge row is not a tax row. */
const runIssues = (source: string, rows: readonly Row[], words: TaxWords): StructureIssue[] => {
  const taxRows = rateRowsOf(rows, (row) => isTaxRow(row, words) && !isChargeRow(row, words));
  const firstTax = taxRows[0]?.index ?? rows.length;
  // A charge below a tax row (a suggested gratuity under the total) is often on the amount before tax, so it is not read.
  const chargeRows = rateRowsOf(rows, (row) => isChargeRow(row, words)).filter((row) => row.index < firstTax);
  const comparable = new Set(taxRows.map((row) => row.rate)).size > 1 ? chargeRows : [...taxRows, ...chargeRows];
  return comparable.flatMap(({ index, rate }) => issueOf(source, rows, index, rate, words));
};

export const taxMismatches = (source: string, amounts: readonly Amount[], words: TaxWords): StructureIssue[] =>
  words.labels.length + words.charges.length === 0 ? [] : runsOf(source).flatMap((run) => runIssues(source, rowsOf(source, run, amounts), words));
