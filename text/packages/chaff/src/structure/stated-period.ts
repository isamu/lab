import { escapeRegExp } from "../orthography.ts";
import { withoutTrailingWeekday } from "./date-range.ts";
import { keyValueCell } from "./key-value-row.ts";
import { TABLE_ROW } from "./runs.ts";

/**
 * 文書が書いた期間（旅行期間：10月12日〜10月15日、Trip period: Oct 12–15）。期間の語（period-label）で始まる一行だけを読む。
 * 日付は年月日（2026-10-12）か月日（10-12）。片方にだけ年があれば、もう片方にも同じ年を補う。
 * 言語の知識（期間の語、範囲の記号、月の名、曜日の名）は語彙表から受け取る。
 */
export type DateMention = { readonly offset: number; readonly end: number; readonly value: string };

export type PeriodWords = {
  readonly labels: readonly string[];
  /** 二つの日付の間に置いて期間を作る記号と語（〜、–、から、to）。 */
  readonly connectors: readonly string[];
  /** 月の名。頭の 12 個が 1 月から 12 月、略した名はその頭の字で月を決める。 */
  readonly months: readonly string[];
  readonly weekdays: readonly string[];
};

export type Period = { readonly start: string; readonly end: string; readonly written: string };

/** 行の頭の印（見出し、箇条書き、引用）と、語を囲む太字や括弧の開き。表の行は statedPeriod が別に読む。 */
const LINE_MARKS = /^[ \t]*(?:(?:#{1,6}|[-*+>]|\d{1,3}[.)])[ \t]*)*/u;
const LABEL_OPEN = /^(?:\*\*|__|【|\[)?/u;
const LABEL_END = /^(?:\*\*|__|】|\])?(?:[ \t]*[:：][ \t]*|[ \t\u3000]+)/u;

export const leadOf = (line: string): number => {
  const marks = LINE_MARKS.exec(line)?.[0].length ?? 0;
  return marks + (LABEL_OPEN.exec(line.slice(marks))?.[0].length ?? 0);
};

/** 期間の語に続く、期間を書いた部分の行の中の位置。期間の語で始まらない行は undefined。 */
export const afterLabel = (line: string, labels: readonly string[]): number | undefined => {
  const lead = leadOf(line);
  const rest = line.slice(lead);
  const label = labels.find((word) => rest.toLowerCase().startsWith(word.toLowerCase()) && LABEL_END.test(rest.slice(word.length)));
  if (label === undefined) return undefined;
  return lead + label.length + (LABEL_END.exec(rest.slice(label.length))?.[0].length ?? 0);
};

/** 日付に添えた曜日（（水））と時刻（10:00）。期間のつなぎ目ではない。 */
const ASIDES = /[（(][^（()）\n]{1,6}[）)]|\d{1,2}[:：]\d{2}/gu;

const isJoint = (between: string, words: PeriodWords): boolean => {
  const bare = between
    .replace(ASIDES, "")
    .replace(/^[\s,]+/u, "")
    .trim()
    .toLowerCase();
  const joint = withoutTrailingWeekday(bare, words.weekdays).trim();
  return words.connectors.some((connector) => connector.toLowerCase() === joint);
};

const connectorPattern = (words: PeriodWords): string =>
  words.connectors
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

const hasYear = (value: string): boolean => /^\d{4}-/u.test(value);
const DAY_VALUE = /^(?:\d{4}-)?\d{2}-\d{2}$/u;

const withDay = (value: string, day: string): string => `${value.slice(0, -2)}${day.padStart(2, "0")}`;

const shiftYear = (value: string, by: number): string => `${String(Number(value.slice(0, 4)) + by)}${value.slice(4)}`;

/** 年を片方にだけ書いた期間に、もう片方の年を補う（December 28 – January 4, 2027 は 2026 年の 12 月から）。 */
const withYears = (start: string, end: string): string[] => {
  if (hasYear(start) === hasYear(end)) return [start, end];
  if (hasYear(start)) {
    const filled = `${start.slice(0, 4)}-${end}`;
    return [start, filled < start ? shiftYear(filled, 1) : filled];
  }
  const filled = `${end.slice(0, 4)}-${start}`;
  return [filled > end ? shiftYear(filled, -1) : filled, end];
};

type Dates = Omit<Period, "written">;

const periodOf = (start: string, end: string): Dates | undefined => {
  if (!DAY_VALUE.test(start) || !DAY_VALUE.test(end)) return undefined;
  const [from = start, to = end] = withYears(start, end);
  return hasYear(from) && to < from ? undefined : { start: from, end: to };
};

/** 時刻の範囲の終わり（May 3, 3–5pm）。日の範囲ではない。 */
const CLOCK = "\\s*[AaPp]\\.?[Mm]\\b";

/** 一つ書いた日付の後ろに日だけを書いた終わり（10月12日〜15日、Oct 12–15）。 */
const dayAfter = (text: string, date: DateMention, lineStart: number, words: PeriodWords): Dates | undefined => {
  const tail = text.slice(date.end - lineStart).replace(ASIDES, "");
  const found = new RegExp(`^\\s*(?:${connectorPattern(words)})\\s*(\\d{1,2})(?:st|nd|rd|th|日)?(?![\\d/:月.]|\\s*\\p{Lu}|${CLOCK})`, "u").exec(tail);
  const day = found?.[1];
  return day === undefined ? undefined : periodOf(date.value, withDay(date.value, day));
};

/** 一つ書いた日付の前に日だけを書いた始まり（3–5 May 2026）。前に月の名がある日（May 3–June 5）は、終わりの月の日ではない。 */
const dayBefore = (text: string, date: DateMention, lineStart: number, words: PeriodWords): Dates | undefined => {
  const head = text.slice(0, date.offset - lineStart);
  const found = new RegExp(`(?<![\\d/.]|\\p{L}\\.?\\s)(\\d{1,2})\\s*(?:${connectorPattern(words)})\\s*$`, "u").exec(head);
  const day = found?.[1];
  return day === undefined ? undefined : periodOf(withDay(date.value, day), date.value);
};

const MONTHS_IN_YEAR = 12;
const ABBREVIATION = 3;

const monthNumber = (name: string, months: readonly string[]): number => {
  const head = name.slice(0, ABBREVIATION).toLowerCase();
  return months.slice(0, MONTHS_IN_YEAR).findIndex((month) => month.slice(0, ABBREVIATION).toLowerCase() === head) + 1;
};

const monthDay = (name: string, day: string, months: readonly string[]): string | undefined => {
  const month = monthNumber(name, months);
  return month === 0 ? undefined : `${String(month).padStart(2, "0")}-${day.padStart(2, "0")}`;
};

const DAY = "(\\d{1,2})(?:st|nd|rd|th)?";

/**
 * 日付として読まれなかった、月の名と日の範囲（May 3–5, 2026、Dec 28–Jan 4, 2027）。英語の日付は、年を終わりにだけ書くと始まりを日付にしない。
 * 年は終わりの日付のもので、始まりには年をまたいで補う。
 */
const monthRange = (text: string, words: PeriodWords): Dates | undefined => {
  const names = words.months.map(escapeRegExp).join("|");
  if (names === "") return undefined;
  const month = `(${names})\\.?\\s+`;
  const pattern = `(?<!\\p{L})${month}${DAY}\\s*(?:${connectorPattern(words)})\\s*(?:${month})?${DAY}(?![\\d:]|${CLOCK})(?:,?\\s+(\\d{4}))?`;
  const found = new RegExp(pattern, "u").exec(text);
  if (found === null) return undefined;
  const [, startMonth = "", first = "", endMonth, last = "", year] = found;
  const start = monthDay(startMonth, first, words.months);
  const end = monthDay(endMonth ?? startMonth, last, words.months);
  if (start === undefined || end === undefined) return undefined;
  return periodOf(start, year === undefined ? end : `${year}-${end}`);
};

const fromTwo = (text: string, lineStart: number, first: DateMention, second: DateMention, words: PeriodWords): Dates | undefined =>
  isJoint(text.slice(first.end - lineStart, second.offset - lineStart), words) ? periodOf(first.value, second.value) : undefined;

const datesOf = (line: string, lineStart: number, from: number, dates: readonly DateMention[], words: PeriodWords): Dates | undefined => {
  const inside = dates.filter((date) => date.offset >= lineStart + from && date.end <= lineStart + line.length);
  const [first, second] = inside;
  if (first !== undefined && second !== undefined) return fromTwo(line, lineStart, first, second, words);
  if (first !== undefined) return dayAfter(line, first, lineStart, words) ?? dayBefore(line, first, lineStart, words) ?? monthRange(line.slice(from), words);
  return monthRange(line.slice(from), words);
};

/** 期間を書いた部分の、行の中の始まりと終わり。表の行は、その表（tableOf）を渡したときだけ、二列の表の内容の升を読む。 */
const valueSpan = (line: string, labels: readonly string[], tableOf: (() => readonly string[]) | undefined): { from: number; to: number } | undefined => {
  if (TABLE_ROW.test(line)) return tableOf === undefined ? undefined : keyValueCell(line, tableOf, labels);
  const from = afterLabel(line, labels);
  return from === undefined ? undefined : { from, to: line.length };
};

/**
 * 期間の語で始まる一行の期間。行の中の日付が二つで間が範囲の記号なら、その二つ。一つなら、その前か後ろに日だけを書いた片方を読む。
 * 日付の無い行は、月の名と日の範囲を読む。読めなければ undefined。tableOf はその行を含む表の行を返し、渡すと二列の表の一行（| 対象期間 | … |）も読む。
 */
export const statedPeriod = (
  line: string,
  lineStart: number,
  dates: readonly DateMention[],
  words: PeriodWords,
  tableOf?: () => readonly string[],
): Period | undefined => {
  const span = valueSpan(line, words.labels, tableOf);
  if (span === undefined) return undefined;
  const found = datesOf(line.slice(0, span.to), lineStart, span.from, dates, words);
  return found === undefined ? undefined : { ...found, written: line.slice(span.from, span.to).trim() };
};
