import type { StructureIssue } from "./issues.ts";
import { runsOf, type Line } from "./runs.ts";
import { bareNumbersIn, CELL_SEPARATOR, NO_UNIT } from "./bare-numbers.ts";

/**
 * 合計の行と、その上に並べた金額の和。箇条書きの続いた項目か、表の続いた行で、合計の語（合計・小計・Total）で始まる行を読む。
 * 同じ単位で同じ列（箇条書きは一つの列）の金額を上から足し、合計の行の金額と合わなければ言う。
 * 小計と税のあとの総計のように、足し方が何通りかある。どの足し方でも合わないときだけ言う。
 * 表の升に数だけを書いた列（単位は見出しにある）も足す。そのときは上の行の升がどれも数でなければ足さない。年や番号の列を足さないため。
 */
export type Amount = { readonly offset: number; readonly end: number; readonly value: number; readonly unit: string };

const CENTS = 100;

/** 区切りのコンマを書かずに 4 桁以上続けた整数部（1205、1205.50）。 */
const UNGROUPED = /(?<![\d.])\d{4}/u;
const MIN_PARTS = 2;

/** 金額の前に書いた負の印（-500、▲500、-$500）。行頭の箇条書きの - は印にしない。 */
const NEGATIVE_BEFORE = /[-−▲△][ \t]?(?:[$€£¥￥][ \t]?)?$/u;

/** 括弧に入れた金額（(1,200)）。会計では負の数だが、補足の金額とも読めて符号が決まらない。 */
const OPEN_PAREN_BEFORE = /[(（][ \t]?(?:[$€£¥￥][ \t]?)?$/u;

type Cell = { readonly column: number; readonly unit: string };
/** cents が undefined の金額は、符号が決まらない。 */
type Placed = Amount & Cell & { readonly cents: number | undefined };
type Entry = { readonly label: boolean; readonly amounts: readonly Placed[] };

const columnOf = (source: string, line: Line, offset: number): number => source.slice(line.start, offset).split(CELL_SEPARATOR).length - 1;

const isNegative = (source: string, line: Line, amount: Amount): boolean => {
  const before = source.slice(line.start, amount.offset);
  const marker = NEGATIVE_BEFORE.exec(before);
  return marker !== null && before.slice(0, marker.index).trim().length > 0;
};

/** 行の最初の文字列（表なら最初の列）から、強調の印と箇条書きの印を除いたもの。 */
const leadingText = (text: string): string =>
  text
    .replace(/^[ \t]*(?:[-*+]|\d{1,3}[.)])?[ \t]*\|?[ \t]*/u, "")
    .replace(/^[*_]+/u, "")
    .trimStart();

/**
 * 合計の語のすぐ後ろ。行や列の終わり、区切り（: |）、括弧の注記（合計（税込））、金額。
 * 「計画」や「Total conversion: 25%」のように語が続くものは合計の行ではない。
 */
const AFTER_LABEL = /^[*_]*[ \t\u3000]*(?:$|[:：|（(]|[-−▲△$€£¥￥\p{N}])/u;

const isTotalLabel = (text: string, labels: readonly string[]): boolean => {
  const lead = leadingText(text).toLowerCase();
  return labels.some((label) => lead.startsWith(label.toLowerCase()) && AFTER_LABEL.test(lead.slice(label.length)));
};

const centsOf = (source: string, line: Line, amount: Amount): number | undefined => {
  if (OPEN_PAREN_BEFORE.test(source.slice(line.start, amount.offset))) return undefined;
  return Math.round(amount.value * CENTS) * (isNegative(source, line, amount) ? -1 : 1);
};

const entryOf = (source: string, line: Line, amounts: readonly Amount[], labels: readonly string[]): Entry => ({
  label: isTotalLabel(source.slice(line.start, line.end), labels),
  amounts: amounts
    .filter((amount) => amount.offset >= line.start && amount.offset <= line.end)
    .map((amount) => ({ ...amount, column: columnOf(source, line, amount.offset), cents: centsOf(source, line, amount) })),
});

const sameCell = (a: Cell, b: Cell): boolean => a.column === b.column && a.unit === b.unit;

const sumOf = (values: readonly number[]): number => values.reduce((sum, value) => sum + value, 0);

type RowsAbove = { readonly parts: number[]; readonly totals: number[]; sinceLast: number[] };

/**
 * 行の中で、その列と単位の値。無ければ null、二つ以上あるか、列に別の単位しか無いか、符号が決まらなければ undefined。
 * 数だけの列では、数の無い升（空、文字、括弧）も undefined。
 */
const valueIn = (entry: Entry, cell: Cell): number | null | undefined => {
  const inColumn = entry.amounts.filter((amount) => amount.column === cell.column);
  const matching = inColumn.filter((amount) => sameCell(amount, cell));
  if (matching.length === 0) return inColumn.length === 0 && cell.unit !== NO_UNIT ? null : undefined;
  return matching.length === 1 ? matching[0]?.cents : undefined;
};

const addTo = (above: RowsAbove, entry: Entry, value: number): void => {
  if (entry.label) {
    above.totals.push(value);
    above.sinceLast = [];
    return;
  }
  above.parts.push(value);
  above.sinceLast.push(value);
};

/**
 * 合計の行より上の、同じ列と単位の値。項目の行と合計の行に分け、最後の合計の行より後の項目も取る。
 * 足し方が決まらない行（valueIn が undefined）が一つでもあれば undefined。1.2万円と円のように単位が割れた列もここで止まる。
 */
const windowAbove = (entries: readonly Entry[], cell: Cell): RowsAbove | undefined => {
  const values = entries.map((entry) => valueIn(entry, cell));
  if (values.includes(undefined)) return undefined;
  const above: RowsAbove = { parts: [], totals: [], sinceLast: [] };
  entries.forEach((entry, index) => {
    const value = values[index];
    if (typeof value === "number") addTo(above, entry, value);
  });
  return above;
};

/** 足し方の候補: 上の項目すべて（小計を並べた総計もこれ）、最後の合計より後の項目、最後の合計にその後の項目。項目が無ければ小計の和だけ。 */
const candidateSums = (above: RowsAbove): number[] => {
  if (above.parts.length === 0) return [sumOf(above.totals)];
  const last = above.totals.at(-1);
  return [sumOf(above.parts), sumOf(above.sinceLast), ...(last === undefined ? [] : [last + sumOf(above.sinceLast)])];
};

/** 項目が無く小計だけが並ぶ表は、小計の和。 */
const reportedSum = (above: RowsAbove): number => (above.parts.length === 0 ? sumOf(above.totals) : (above.totals.at(-1) ?? 0) + sumOf(above.sinceLast));

/** 和と呼べるだけの行があるか。項目が二つ以上か、項目が無く小計が二つ以上。 */
const enoughRows = (above: RowsAbove): boolean => above.parts.length >= MIN_PARTS || (above.parts.length === 0 && above.totals.length >= MIN_PARTS);

/** 和は、合計の行と同じ小数の桁と区切りで見せる（$10,160.00 なら $10,260.00、1205 なら 1305）。端数があれば 2 桁。 */
const formatCents = (cents: number, written: string): string => {
  const digits = Math.max(/\.\d{2}/u.test(written) ? 2 : 0, cents % CENTS === 0 ? 0 : 2);
  const useGrouping = !UNGROUPED.test(written);
  return (cents / CENTS).toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping });
};

/** 数の前に書いた単位（$1,200、$ 1,200）の始まり。木の数量は数から始まるので、見せるときは前の単位も入れる。 */
const unitStartBefore = (source: string, amount: Amount): number | undefined => {
  if (amount.unit === NO_UNIT) return undefined;
  const gap = /[ \t]/u.test(source[amount.offset - 1] ?? "") ? 1 : 0;
  const start = amount.offset - gap - amount.unit.length;
  return start >= 0 && source.slice(start, amount.offset - gap) === amount.unit ? start : undefined;
};

/** 合計の行に書いた金額と、上の和を、同じ書き方で見せる。 */
const shownAmounts = (source: string, total: Amount, sumCents: number): Record<string, string> => {
  const unitStart = unitStartBefore(source, total);
  const written = source.slice(unitStart ?? total.offset, total.end);
  const sum = formatCents(sumCents, written);
  if (unitStart !== undefined) return { written, sum: `${source.slice(unitStart, total.offset)}${sum}` };
  return { written, sum: written.endsWith(total.unit) ? `${sum}${total.unit}` : sum };
};

/**
 * 数だけの列で、合計の行の数が項目のどれかより大きくなければ、和ではなく平均や率や年の列と読んで足さない。
 * 項目に負の数があれば、和が項目より小さいこともあるので足す。
 */
const readsAsSum = (cell: Cell, writtenCents: number, above: RowsAbove): boolean =>
  cell.unit !== NO_UNIT || above.parts.some((part) => part < 0) || above.parts.every((part) => part < writtenCents);

const mismatchesIn = (source: string, entries: readonly Entry[]): StructureIssue[] =>
  entries.flatMap((entry, index) => {
    if (!entry.label) return [];
    return entry.amounts.flatMap((total) => {
      const writtenCents = valueIn(entry, total);
      const above = windowAbove(entries.slice(0, index), total);
      if (typeof writtenCents !== "number" || above === undefined || !enoughRows(above) || !readsAsSum(total, writtenCents, above)) return [];
      if (candidateSums(above).includes(writtenCents)) return [];
      return [{ offset: total.offset, values: shownAmounts(source, total, reportedSum(above)) }];
    });
  });

export const totalMismatches = (source: string, amounts: readonly Amount[], labels: readonly string[]): StructureIssue[] =>
  runsOf(source).flatMap((run) => {
    const inRun = [...amounts, ...bareNumbersIn(source, run)];
    return mismatchesIn(
      source,
      run.map((line) => entryOf(source, line, inRun, labels)),
    );
  });
