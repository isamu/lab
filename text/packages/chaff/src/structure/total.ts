import type { StructureIssue } from "./issues.ts";
import { runsOf, TABLE_RULE, type Line } from "./runs.ts";
import { bareNumbersIn, CELL_SEPARATOR, NO_UNIT } from "./bare-numbers.ts";

/**
 * 合計の行と、その上に並べた金額の和。箇条書きの続いた項目か、表の続いた行で、合計の語（合計・小計・Total）で始まる行を読む。
 * 同じ単位で同じ列（箇条書きは一つの列）の金額を上から足し、合計の行の金額と合わなければ言う。
 * 小計と税のあとの総計のように、足し方が何通りかある。どの足し方でも合わないときだけ言う。
 * 表の升に数だけを書いた列（単位は見出しにある）も足す。そのときは上の行の升がどれも数でなければ足さない。年や番号の列を足さないため。
 */
export type Amount = {
  readonly offset: number;
  readonly end: number;
  readonly value: number;
  readonly unit: string;
  /** 単位の付いた量（0.5 g）は、量の種類の一番小さい単位（mg）に直して足す。scale は書いた単位一つがその単位いくつか（g なら 1,000）。 */
  readonly scale?: number;
};

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
/**
 * spanTotal: 合計が足す期間の語を付けた合計の行（年間合計、Total for the year）。
 * closing: 見出しが名指さない名詞を付けた、表を締める合計の行（項目の表の差引合計）。上の行の一部の和とも比べる。
 */
type Entry = { readonly label: boolean; readonly spanTotal: boolean; readonly closing?: boolean; readonly amounts: readonly Placed[] };

export const columnOf = (source: string, line: Line, offset: number): number => source.slice(line.start, offset).split(CELL_SEPARATOR).length - 1;

const isNegative = (source: string, line: Line, amount: Amount): boolean => {
  const before = source.slice(line.start, amount.offset);
  const marker = NEGATIVE_BEFORE.exec(before);
  return marker !== null && before.slice(0, marker.index).trim().length > 0;
};

/** 行の最初の文字列（表なら最初の列）から、強調の印と箇条書きの印を除いたもの。 */
export const leadingText = (text: string): string =>
  text
    .replace(/^[ \t]*(?:[-*+]|\d{1,3}[.)])?[ \t]*\|?[ \t]*/u, "")
    .replace(/^[*_]+/u, "")
    .trimStart();

/** 表の行の頭に並ぶ空の升（| | 合計 |）。最初の区切りは残す。 */
const LEADING_BLANK_CELLS = /^([ \t]*\|)(?:[ \t]*\|)+/u;

/** 表の行から頭の空の升を除いたもの。合計の語を最初の空でない升に書いた行を、最初の升に書いた行と同じに読むため。 */
export const withoutLeadingBlankCells = (row: string): string => row.replace(LEADING_BLANK_CELLS, "$1");

/**
 * 合計の語のすぐ後ろ。行や列の終わり、区切り（: |）、金額。括弧の注記は endsLabel が飛ばす。
 * 「計画」や「Total conversion: 25%」のように語が続くものは合計の行ではない。
 */
const AFTER_LABEL = /^[*_]*[ \t\u3000]*(?:$|[:：|]|[-−▲△$€£¥￥\p{N}])/u;

/** 見出しのすぐ後ろの括弧の注記（合計（税込）、Total (incl. tax)）の開き。 */
const NOTE_OPEN = /^[*_]*[ \t\u3000]*[（(]/u;
const OPENERS = new Set(["(", "（"]);
const CLOSERS = new Set([")", "）"]);

type NoteScan = { readonly depth: number; readonly end: number | undefined; readonly stopped: boolean };

/** 開きの括弧（start）に対応する閉じの次の位置。中の括弧は何段でもよい。升の区切り（\| でない |）までに閉じなければ undefined。 */
const noteEnd = (text: string, start: number): number | undefined =>
  text
    .slice(start)
    .split("")
    .reduce<NoteScan>(
      (scan, char, offset) => {
        if (scan.end !== undefined || scan.stopped) return scan;
        if (char === "|" && text[start + offset - 1] !== "\\") return { ...scan, stopped: true };
        const depth = scan.depth + (OPENERS.has(char) ? 1 : 0) - (CLOSERS.has(char) ? 1 : 0);
        return { depth, end: depth === 0 ? start + offset + 1 : undefined, stopped: false };
      },
      { depth: 0, end: undefined, stopped: false },
    ).end;

/**
 * 見出しの語の後ろが見出しの終わりか。括弧の注記は飛ばして、その後ろを同じに読む。注記の後ろに語が続けば（Tax (10%) workshop、
 * 合計（第1期）設計）、注記の付いた項目の名前。升の中で閉じない括弧は、そこからを注記とみなす。
 */
const endsLabel = (rest: string): boolean => {
  const open = NOTE_OPEN.exec(rest);
  if (open === null) return AFTER_LABEL.test(rest);
  const end = noteEnd(rest, open[0].length - 1);
  return end === undefined || endsLabel(rest.slice(end));
};

export const isTotalLabel = (text: string, labels: readonly string[]): boolean => {
  const lead = leadingText(text).toLowerCase();
  return labels.some((label) => lead.startsWith(label.toLowerCase()) && endsLabel(lead.slice(label.length)));
};

const centsOf = (source: string, line: Line, amount: Amount): number | undefined => {
  if (OPEN_PAREN_BEFORE.test(source.slice(line.start, amount.offset))) return undefined;
  return Math.round(amount.value * CENTS) * (isNegative(source, line, amount) ? -1 : 1);
};

/** 行が合計の行か。語彙で決める判定は呼ぶ側が渡す。header は表の見出しの行（無ければ undefined）。 */
export type IsTotalLine = (text: string, header: string | undefined) => boolean;

/** source の中で start から始まる行のすぐ前の行。 */
const lineBefore = (source: string, start: number): { readonly start: number; readonly text: string } | undefined => {
  if (start === 0) return undefined;
  const begin = source.lastIndexOf("\n", start - 2) + 1;
  return { start: begin, text: source.slice(begin, start - 1) };
};

/** 表の行のすぐ上が区切りの行（| --- |）なら、そのすぐ上の見出しの行。続けて書いた次の表の見出しも、ここで行ごとに拾う。 */
const headerAbove = (source: string, line: Line): string | undefined => {
  const rule = lineBefore(source, line.start);
  if (line.kind !== "table" || rule === undefined || !TABLE_RULE.test(rule.text)) return undefined;
  const header = lineBefore(source, rule.start);
  return header?.text.includes("|") === true ? header.text : undefined;
};

/** 一つの並びに続けて書いた表を、見出しごとに分ける。下の表の合計に、上の表の行を足さないため。 */
const tablesIn = (source: string, run: readonly Line[]): Line[][] =>
  run.reduce<Line[][]>((tables, line, index) => {
    const current = tables.at(-1);
    if (current === undefined || (index > 0 && headerAbove(source, line) !== undefined)) tables.push([line]);
    else current.push(line);
    return tables;
  }, []);

/** 行が、合計が足す期間の語を付けた合計の行か（年間合計、Total for the year）。 */
export type IsSpanTotal = (text: string) => boolean;

type LineKinds = { readonly isTotal: (text: string) => boolean; readonly isSpanTotal: IsSpanTotal };

const entryOf = (source: string, line: Line, amounts: readonly Amount[], kinds: LineKinds): Entry => ({
  label: kinds.isTotal(source.slice(line.start, line.end)),
  spanTotal: kinds.isSpanTotal(source.slice(line.start, line.end)),
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

/**
 * 表を締める合計の行の、ほかの足し方: 下から続けた項目の和（支給の行の下に控除の行を並べた表の控除合計）と、
 * その上の項目の和からそれを引いた額（同じ表の差し引いた後の額）。
 */
const blockSums = (parts: readonly number[]): number[] =>
  parts.flatMap((_, start) => {
    const below = sumOf(parts.slice(start));
    return start === 0 ? [below] : [below, sumOf(parts.slice(0, start)) - below];
  });

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

/** 負の金額の前に書いた印（-、▲）。見せる金額に入れる。 */
const SIGN_BEFORE = /[-−▲△][ \t]?$/u;
const SIGN_REACH = 2;

const signBefore = (source: string, total: Placed, start: number): string =>
  total.cents !== undefined && total.cents < 0 ? (SIGN_BEFORE.exec(source.slice(Math.max(0, start - SIGN_REACH), start))?.[0] ?? "") : "";

/** 数の後ろに書いた単位。単位の組の名前（credit）と書いた語（credits）が違えば、書いた語を見せる。 */
const unitAfterNumber = (written: string, unit: string): string =>
  written.endsWith(unit) ? unit : written.slice(written.split("").findLastIndex((char) => char >= "0" && char <= "9") + 1);

/** 合計の行に書いた金額と、上の和を、同じ書き方で見せる。負の和には、合計に書いた印（無ければ -）を付ける。 */
const shownAmounts = (source: string, total: Placed, sumCents: number): Record<string, string> => {
  const unitStart = unitStartBefore(source, total);
  const start = unitStart ?? total.offset;
  const sign = signBefore(source, total, start);
  const written = source.slice(start - sign.length, total.end);
  const sumSign = sumCents < 0 ? sign || "-" : "";
  const sum = formatCents(Math.abs(sumCents), written);
  if (unitStart !== undefined) return { written, sum: `${sumSign}${source.slice(unitStart, total.offset)}${sum}` };
  return { written, sum: `${sumSign}${sum}${unitAfterNumber(written, total.unit)}` };
};

/** 文の中の合計の金額（符号の無い、単位付きの金額）と和を、合計の書き方で見せる。 */
export const shownTotal = (source: string, total: Amount, sumCents: number): Record<string, string> =>
  shownAmounts(source, { ...total, column: 0, cents: Math.round(total.value * CENTS) }, sumCents);

/**
 * 数だけの列で、合計の行の数が項目のどれかより大きくなければ、和ではなく平均や率や年の列と読んで足さない。
 * 項目に負の数があれば、和が項目より小さいこともあるので足す。
 */
const readsAsSum = (cell: Cell, writtenCents: number, above: RowsAbove): boolean =>
  cell.unit !== NO_UNIT || above.parts.some((part) => part < 0) || above.parts.every((part) => part < writtenCents);

/** 書いた数の小数の桁（0.25 g なら 2）。 */
const decimalsOf = (written: string): number => /[.．](\d+)/u.exec(written.normalize("NFKC"))?.[1]?.length ?? 0;

/** 見せる和の小数の桁の上限。合計より細かい単位の内訳（1 g の合計に 250 mg の内訳）の和を、合計の単位で見せるため。 */
const MAX_SHOWN_DECIMALS = 3;

/** 換算の倍率が割り切れない単位（8 oz + 8 oz = 1 lb）で、丸めの差を合うとみなす割合。 */
const MEASURE_TOLERANCE = 1e-6;

/** 単位の付いた量の合計。和は合計に書いた単位と書き方で見せる（1 g の合計に 300 mg と 0.6 g の内訳なら 0.9 g）。 */
const measuredMismatch = (source: string, total: Placed, scale: number, sums: readonly number[], reported: number): StructureIssue[] => {
  const number = source.slice(total.offset, total.end);
  const digits = decimalsOf(number);
  const written = total.value * CENTS;
  if (sums.some((sum) => Math.abs(sum - written) <= Math.abs(written) * MEASURE_TOLERANCE)) return [];
  const inTotalUnit = (cents: number): number => cents / CENTS / scale;
  const sum = inTotalUnit(reported).toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: Math.max(digits, MAX_SHOWN_DECIMALS),
    useGrouping: !UNGROUPED.test(number),
  });
  return [{ offset: total.offset, values: { written: number, sum: `${sum}${unitAfterNumber(number, total.unit)}` } }];
};

/** 一年の中の期間の数（四半期、月、週）。期間の合計が和のちょうどこの倍なら、内訳を一年に直した額と読む。二倍は書き誤りでも起きるので入れない。 */
const SPAN_MULTIPLES: readonly number[] = [4, 12, 52];

/** 書いた合計が、どれかの足し方の和を一年に直した額か（月額の内訳に年間合計）。 */
const isSpanMultiple = (writtenCents: number, sums: readonly number[]): boolean =>
  sums.some((sum) => SPAN_MULTIPLES.some((multiple) => sum !== 0 && writtenCents === sum * multiple));

const mismatchesIn = (source: string, entries: readonly Entry[]): StructureIssue[] =>
  entries.flatMap((entry, index) => {
    if (!entry.label) return [];
    return entry.amounts.flatMap((total) => {
      const writtenCents = valueIn(entry, total);
      const above = windowAbove(entries.slice(0, index), total);
      if (typeof writtenCents !== "number" || above === undefined || !enoughRows(above) || !readsAsSum(total, writtenCents, above)) return [];
      const sums = entry.closing === true ? [...candidateSums(above), ...blockSums(above.parts)] : candidateSums(above);
      if (entry.spanTotal && isSpanMultiple(writtenCents, sums)) return [];
      if (total.scale !== undefined) return measuredMismatch(source, total, total.scale, sums, reportedSum(above));
      if (sums.includes(writtenCents)) return [];
      return [{ offset: total.offset, values: shownAmounts(source, total, reportedSum(above)) }];
    });
  });

/**
 * 表を締める合計の行を読む語彙。isListed: 見出しが名指さなくても上の行の和と読める合計か（差引合計、Total deductions）。
 * isTotalLike: 合計のような行か（合計の行、支給合計、総支給額）。header は表の見出しの行。
 */
export type ClosingTotal = {
  readonly isListed: (text: string) => boolean;
  readonly isTotalLike: (text: string, header: string) => boolean;
};

/** 表の行の金額が、見出しの列（最初の升）のほかに一つの列だけにあり、どの行にも一つまでか。 */
const oneAmountColumn = (source: string, table: readonly Line[], entries: readonly Entry[]): boolean => {
  const valuesOf = (line: Line, entry: Entry): Placed[] => {
    const labelColumn = source.slice(line.start, line.end).trimStart().startsWith("|") ? 1 : 0;
    return entry.amounts.filter((amount) => amount.column > labelColumn);
  };
  const rows = table.map((line, index) => {
    const entry = entries[index];
    return entry === undefined ? [] : valuesOf(line, entry);
  });
  return rows.every((values) => values.length <= 1) && new Set(rows.flat().map((amount) => amount.column)).size === 1;
};

/**
 * 表の最後の行が、表を締める合計の行か。見出しのある表で、最後の行が isListed の合計で、上に合計のような行が一つも無く、
 * 金額の列が一つのときだけ。上に支給の合計や総支給額があれば、合計が表のどこからどこまでの和か決まらないので読まない。
 */
const closesTable = (source: string, table: readonly Line[], entries: readonly Entry[], header: string | undefined, closing: ClosingTotal): boolean => {
  const texts = table.map((line) => source.slice(line.start, line.end));
  const last = entries.at(-1);
  const lastText = texts.at(-1);
  if (header === undefined || last === undefined || lastText === undefined || last.label || !closing.isListed(lastText)) return false;
  return !texts.slice(0, -1).some((text) => closing.isTotalLike(text, header)) && oneAmountColumn(source, table, entries);
};

/** 一つの表（見出しの下の行）の合計。名詞の付いた合計の行は、その表の見出しで読む。 */
const tableMismatches = (
  source: string,
  table: readonly Line[],
  amounts: readonly Amount[],
  isTotal: IsTotalLine,
  isSpanTotal: IsSpanTotal,
  closing: ClosingTotal | undefined,
): StructureIssue[] => {
  const header = table[0] === undefined ? undefined : headerAbove(source, table[0]);
  const kinds = { isTotal: (text: string): boolean => isTotal(text, header), isSpanTotal };
  const entries = table.map((line) => entryOf(source, line, amounts, kinds));
  if (closing === undefined || !closesTable(source, table, entries, header, closing)) return mismatchesIn(source, entries);
  return mismatchesIn(
    source,
    entries.map((entry, index) => (index === entries.length - 1 ? { ...entry, label: true, closing: true } : entry)),
  );
};

export const totalMismatches = (
  source: string,
  amounts: readonly Amount[],
  isTotal: IsTotalLine,
  isSpanTotal: IsSpanTotal = () => false,
  closing?: ClosingTotal,
): StructureIssue[] =>
  runsOf(source).flatMap((run) => {
    const inRun = [...amounts, ...bareNumbersIn(source, run)];
    return tablesIn(source, run).flatMap((table) => tableMismatches(source, table, inRun, isTotal, isSpanTotal, closing));
  });
