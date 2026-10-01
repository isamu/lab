import type { StructureIssue } from "./issues.ts";
import { runsOf, TABLE_ROW, TABLE_RULE, type Line } from "./runs.ts";
import { columnOf, isTotalLabel, type Amount } from "./total.ts";
import { CELL_SEPARATOR } from "./bare-numbers.ts";
import { joined, lineAbove, linesAbove } from "../text-above.ts";

/**
 * 一つの全体を分けた割合（構成比、内訳、breakdown）の和が 100% にならない。箇条書きの続いた項目か、表の続いた行の百分率を足す。
 * 全体を分けたものと読むのは、表のその列の見出しか、すぐ上の文や見出しに割合の語があるときだけ。行ごとの率（利用率）は足さない。
 * 丸めの誤差は、項目ごとに最後の桁の半分まで認める（少なくとも 1 ポイント）。合計の行がある並びは total-mismatch に任せる。
 */
export type ShareWords = {
  readonly labels: readonly string[];
  /** 足しても 100% にならない集計（複数回答）。 */
  readonly exceptions: readonly string[];
  readonly units: readonly string[];
  readonly totalLabels: readonly string[];
};

const WHOLE = 100;
const MIN_PARTS = 2;
const HALF = 0.5;
const DECIMAL_BASE = 10;

type Share = Amount & { readonly column: number; readonly decimals: number; readonly signed: boolean };

/** 数の前に書いた符号（+3%、-2%、▲2%）。増減の率で、全体の一部ではない。行頭の箇条書きの - は符号にしない。 */
const SIGNS = "-+−▲△";

const isSigned = (source: string, line: Line, offset: number): boolean => {
  const before = source.slice(line.start, offset).trimEnd();
  return SIGNS.includes(before.at(-1) ?? " ") && before.slice(0, -1).trim().length > 0;
};
const DECIMALS = /\.(\d+)/u;

const includesAny = (text: string, words: readonly string[]): boolean => {
  const lowered = text.toLowerCase();
  return words.some((word) => lowered.includes(word.toLowerCase()));
};

/** 位置の順に並べた百分率のうち、offset 以後の最初のもの。 */
const firstFrom = (percents: readonly Amount[], offset: number, low = 0, high = percents.length): number => {
  if (low >= high) return low;
  const middle = Math.floor((low + high) / 2);
  return (percents[middle]?.offset ?? 0) < offset ? firstFrom(percents, offset, middle + 1, high) : firstFrom(percents, offset, low, middle);
};

/** 行の中の百分率。百分率は位置の順に並んでいるので、行の頭から探して行の終わりで止める。 */
const onLine = (percents: readonly Amount[], line: Line): Amount[] => {
  const from = firstFrom(percents, line.start);
  const past = firstFrom(percents, line.end + 1, from);
  return percents.slice(from, past);
};

const sharesIn = (source: string, line: Line, percents: readonly Amount[]): Share[] =>
  onLine(percents, line).map((amount) => ({
    ...amount,
    column: columnOf(source, line, amount.offset),
    signed: isSigned(source, line, amount.offset),
    decimals: DECIMALS.exec(source.slice(amount.offset, amount.end))?.[1]?.length ?? 0,
  }));

/** 表の見出しの行の升。区切りの行のすぐ上の行。表でなければ無い。 */
const headerCells = (source: string, firstRow: Line): string[] => {
  const rule = lineAbove(source, firstRow.start);
  if (rule === undefined || !TABLE_RULE.test(rule.text)) return [];
  const header = lineAbove(source, rule.start);
  return header === undefined ? [] : header.text.split(CELL_SEPARATOR);
};

/** 並びのすぐ上の文か見出し。表なら見出しの行と区切りの行を飛ばして、その上。 */
const textAbove = (source: string, run: readonly Line[]): string => {
  const first = run[0];
  return first === undefined
    ? ""
    : (joined(
        source,
        linesAbove(source, first.start, (text) => TABLE_ROW.test(text)),
      )?.text ?? "");
};

/** 列の百分率。どの行にもちょうど一つあり、符号の無いときだけ。 */
const columnShares = (rows: readonly Share[][], column: number): Share[] | undefined => {
  const cells = rows.map((row) => row.filter((share) => share.column === column));
  if (cells.some((cell) => cell.length !== 1)) return undefined;
  const shares = cells.flat();
  return shares.some((share) => share.signed) ? undefined : shares;
};

const sumOf = (shares: readonly Share[]): number => shares.reduce((total, share) => total + share.value, 0);

const decimalsOf = (shares: readonly Share[]): number => Math.max(0, ...shares.map((share) => share.decimals));

/** 丸めで離れうる幅。項目ごとに最後の桁の半分、少なくとも 1 ポイント。 */
const tolerance = (shares: readonly Share[]): number => Math.max(1, shares.length * HALF * DECIMAL_BASE ** -decimalsOf(shares));

/** 和は、項目のいちばん細かい桁で、最初の項目の単位を付けて見せる。 */
const shownSum = (shares: readonly Share[]): string => `${sumOf(shares).toFixed(decimalsOf(shares))}${shares[0]?.unit ?? ""}`;

type Named = { readonly header: readonly string[]; readonly above: string };

/** 列が全体を分けた割合と名指されているか。表は列の見出しか、百分率の列が一つだけの表の上の文。箇条書きは上の文。 */
const namesShares = (named: Named, column: number, percentColumns: number, words: ShareWords): boolean => {
  const header = named.header[column] ?? "";
  if (named.header.length > 0 && includesAny(header, words.labels)) return true;
  return (named.header.length === 0 || percentColumns === 1) && includesAny(named.above, words.labels);
};

/** 足してよい並び: 二行以上で、合計の行が無い。 */
const isBreakdown = (source: string, run: readonly Line[], totalLabels: readonly string[]): boolean =>
  run.length >= MIN_PARTS && !run.some((line) => isTotalLabel(source.slice(line.start, line.end), totalLabels));

const namingOf = (source: string, run: readonly Line[], first: Line): Named => ({ header: headerCells(source, first), above: textAbove(source, run) });

const mismatchesIn = (source: string, run: readonly Line[], percents: readonly Amount[], words: ShareWords): StructureIssue[] => {
  const first = run[0];
  if (first === undefined || !isBreakdown(source, run, words.totalLabels)) return [];
  const rows = run.map((line) => sharesIn(source, line, percents));
  const columns = [...new Set((rows[0] ?? []).map((share) => share.column))];
  if (columns.length === 0) return [];
  const named = namingOf(source, run, first);
  if (includesAny([...named.header, named.above].join(" "), words.exceptions)) return [];
  return columns.flatMap((column) => {
    const shares = columnShares(rows, column);
    if (shares === undefined || !namesShares(named, column, columns.length, words)) return [];
    if (Math.abs(sumOf(shares) - WHOLE) <= tolerance(shares)) return [];
    return [{ offset: shares[0]?.offset ?? first.start, values: { sum: shownSum(shares) } }];
  });
};

export const percentSumMismatches = (source: string, amounts: readonly Amount[], words: ShareWords): StructureIssue[] => {
  if (words.labels.length === 0) return [];
  const percents = amounts.filter((amount) => words.units.includes(amount.unit)).toSorted((a, b) => a.offset - b.offset);
  return runsOf(source).flatMap((run) => mismatchesIn(source, run, percents, words));
};
