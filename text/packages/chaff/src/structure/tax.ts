import type { StructureIssue } from "./issues.ts";
import { runsOf, type Line } from "./runs.ts";
import { columnOf, isTotalLabel, shownTotal, type Amount } from "./total.ts";

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
};

const RATE = /(\d{1,2}(?:\.\d{1,2})?)[ \t]?[%％]/u;
const PERCENT = new Set(["%", "％"]);
/** A sign or an opening bracket right before an amount (-$200, ▲500, (1,200)): the amount may be negative. */
const SIGNED = /[-−▲△(（][ \t]?(?:[$€£¥￥][ \t]?)?$/u;
const CENTS = 100;
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

const isTaxRow = (row: Row, words: TaxWords): boolean =>
  isTotalLabel(row.text, words.labels) && !words.included.some((word) => row.text.toLowerCase().includes(word.toLowerCase()));

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

/** The base the tax is on: the last total row above, or the sum of the item rows above when there is no total row. */
const baseOf = (source: string, above: readonly Row[], tax: Amount, column: number, words: TaxWords): Amount | undefined => {
  const lastTotal = above.findLast((row) => isTotalLabel(row.text, words.totals));
  if (lastTotal !== undefined) return amountAt(source, lastTotal, column, tax.unit);
  const items = above.map((row) => amountAt(source, row, column, tax.unit));
  if (items.length === 0 || items.some((item) => item === undefined)) return undefined;
  const values = items.flatMap((item) => (item === undefined ? [] : [item.value]));
  return { offset: tax.offset, end: tax.end, unit: tax.unit, value: values.reduce((sum, value) => sum + value, 0) };
};

/** Whether the written tax is base × rate, rounded down, to nearest or up, to the unit or to the cent. */
export const taxMatches = (writtenCents: number, base: number, rate: number): boolean => {
  // base × rate% in cents: base × 100 × rate / 100.
  const exactCents = base * rate;
  const toCent = [Math.floor(exactCents), Math.round(exactCents), Math.ceil(exactCents)];
  const toUnit = [Math.floor, Math.round, Math.ceil].map((round) => round(exactCents / CENTS) * CENTS);
  return [...toCent, ...toUnit].some((candidate) => Math.abs(candidate - writtenCents) < 1);
};

const issueOf = (source: string, rows: readonly Row[], index: number, rate: number, words: TaxWords): StructureIssue[] => {
  const row = rows[index];
  const tax = row?.amounts.length === 1 ? row.amounts[0] : undefined;
  if (row === undefined || tax === undefined || isSigned(source, row, tax)) return [];
  const column = columnOf(source, row.line, tax.offset);
  const base = baseOf(source, rows.slice(0, index), tax, column, words);
  if (base === undefined || taxMatches(Math.round(tax.value * CENTS), base.value, rate)) return [];
  const expectedCents = Math.round(base.value * rate);
  const shown = shownTotal(source, tax, expectedCents);
  return [{ offset: tax.offset, values: { written: shown.written ?? "", expected: shown.sum ?? "", rate: `${String(rate)}%` } }];
};

const runIssues = (source: string, rows: readonly Row[], words: TaxWords): StructureIssue[] => {
  const taxRows = rows.flatMap((row, index) => {
    const rate = isTaxRow(row, words) ? rateOf(row.text) : undefined;
    return rate === undefined ? [] : [{ index, rate }];
  });
  if (new Set(taxRows.map((row) => row.rate)).size > 1) return [];
  return taxRows.flatMap(({ index, rate }) => issueOf(source, rows, index, rate, words));
};

export const taxMismatches = (source: string, amounts: readonly Amount[], words: TaxWords): StructureIssue[] =>
  words.labels.length === 0 ? [] : runsOf(source).flatMap((run) => runIssues(source, rowsOf(source, run, amounts), words));
