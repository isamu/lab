import type { StructureIssue } from "./issues.ts";

/**
 * 期間の終わりが始まりより前。二つの日付の間が範囲の記号（〜、–、through）だけか、開きの語（から）で終わりの日付に閉じの語（まで）が続くときを期間と読む。
 * 比べるのは、両方が年月日か、両方が年月のときだけ。年の無い期間（12月28日〜1月4日）は年をまたぐかもしれない。
 * 言語の知識（範囲の記号と語）は語彙表から受け取る。
 */
export type DatedSpan = { readonly offset: number; readonly end: number; readonly value: string };

export type RangeWords = {
  /** それだけで期間を作る記号と語。 */
  readonly connectors: readonly string[];
  /** 終わりの日付に閉じの語が続くときだけ期間を作る語（から）。 */
  readonly openers: readonly string[];
  readonly closers: readonly string[];
};

const COMPARABLE = [/^\d{4}-\d{2}-\d{2}$/u, /^\d{4}-\d{2}$/u];

const comparable = (start: string, end: string): boolean => COMPARABLE.some((pattern) => pattern.test(start) && pattern.test(end));

/** 日付に添えた曜日（（水））と時刻（10:00）は、期間のつなぎ目ではないので読み飛ばす。 */
const ASIDES = /[（(][^（()）\n]{1,6}[）)]|\d{1,2}[:：]\d{2}/gu;

const bare = (text: string): string => text.replace(ASIDES, "").trim().toLowerCase();

const isOneOf = (text: string, words: readonly string[]): boolean => words.some((word) => word.toLowerCase() === text);

/** 行の終わりまでの、終わりの日付の後ろ。曜日と時刻を除いてから閉じの語を探す。 */
const closedAfter = (source: string, end: DatedSpan, closers: readonly string[]): boolean => {
  const lineEnd = source.indexOf("\n", end.end);
  const after = source
    .slice(end.end, lineEnd === -1 ? source.length : lineEnd)
    .replace(ASIDES, "")
    .trimStart();
  return closers.some((closer) => after.startsWith(closer));
};

/**
 * 二つの日付の間のつなぎ。行をまたぐなら、つなぎは前の行の終わりにあり、次の行は終わりの日付から始まるときだけ（期間は2026年4月1日〜↵2026年3月31日）。
 * 次の行の頭の「- 」は箇条書きの印で、範囲の記号ではない（日付を並べた一覧）。
 */
const jointOf = (source: string, start: DatedSpan, end: DatedSpan): string | undefined => {
  const [first = "", ...next] = source.slice(start.end, end.offset).split("\n");
  return next.every((line) => line.trim() === "") ? bare(first) : undefined;
};

const isRange = (source: string, start: DatedSpan, end: DatedSpan, words: RangeWords): boolean => {
  const joint = jointOf(source, start, end);
  if (joint === undefined) return false;
  return isOneOf(joint, words.connectors) || (isOneOf(joint, words.openers) && closedAfter(source, end, words.closers));
};

/** 書いたままの期間。行をまたいだ期間は一行にする。 */
const writtenPeriod = (source: string, start: DatedSpan, end: DatedSpan): string =>
  source
    .slice(start.offset, end.end)
    .split("\n")
    .map((part) => part.trim())
    .join(" ");

/** 隣り合う二つの日付のうち、期間をなし、終わりが始まりより前のもの。期間の書き出しを指し、書いたままの期間を見せる。 */
export const reversedRanges = (source: string, dates: readonly DatedSpan[], words: RangeWords): StructureIssue[] =>
  dates.slice(1).flatMap((end, index) => {
    const start = dates[index];
    if (start === undefined || !comparable(start.value, end.value) || end.value >= start.value) return [];
    if (!isRange(source, start, end, words)) return [];
    return [{ offset: start.offset, values: { start: start.value, end: end.value, period: writtenPeriod(source, start, end) } }];
  });
