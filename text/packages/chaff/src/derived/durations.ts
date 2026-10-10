import type { Span } from "../plugin.ts";
import { bySentence } from "./sentence-buckets.ts";
import { calendarDateOf, dateOf, shifted, valueOf, type DurationUnit } from "./date-arithmetic.ts";

/**
 * 始まりと期間と終わりを一つの文に書いたもの（「4月1日から3か月間（6月30日まで）」"for 3 months from April 1, 2026 (until
 * June 30, 2026)"）。始まりに期間を足した日が終わりと合わなければ言う。期間の数え方は三通りある。終わりの日を含めて数える
 * （4月1日から3か月間は6月30日まで）か、含めずに数える（7月1日まで）か、初日を数えずに期間が過ぎた日（「到達日から2週間が経過した日
 * （4月16日）」）。どれとも合わないときだけ言う。
 * 文に日付がちょうど二つ、期間がちょうど一つのときだけ読む。それより多い文は、どの日付とどの期間が組なのか決まらない。
 * 範囲のすぐ後ろの括弧に書いた期間（「9月1日〜9月30日（30日間）」）は範囲そのものの長さで、期間が過ぎた日を終わりに書くことはない。
 */
export type DatedValue = Span & { readonly value: string };

export type Duration = Span & {
  readonly amount: number;
  readonly unit: DurationUnit;
  /** 名詞の前に書いた期間（a 7-day returns window）。決まりの長さのことが多く、二つの日付の間の長さとは限らない。 */
  readonly attributive?: boolean;
};

export type DurationMismatch = { readonly start: DatedValue; readonly duration: Duration; readonly end: DatedValue; readonly expected: string };

/** 期間を足した日と、その前の日（終わりを含めて数える）と、次の日（初日を数えずに期間が過ぎた日。範囲の長さには無い）。 */
const expectedEnds = (start: Date, duration: Duration, rangeLength: boolean): Date[] => {
  const exclusive = shifted(start, duration.amount, duration.unit);
  const ends = [shifted(exclusive, -1, "day"), exclusive];
  return rangeLength ? ends : [...ends, shifted(exclusive, 1, "day")];
};

/** 文書と、範囲の間の語（〜、–、to）と、日付の後ろの括弧に添える曜日（（火）、(Wed)）。 */
export type RangeText = { readonly source: string; readonly joiners: readonly string[]; readonly weekdays: readonly string[] };

const LEADING_BRACKET = /^\s*[(（]([^()（）\n]+)[)）]/u;
const OPEN_BRACKET = /^\s*[(（]\s*$/u;
const CLOSE_BRACKET = /^\s*[)）]/u;

/** 先頭の曜日の括弧（（火）、(Wednesday)）を除いた残り。曜日の名の頭だけを書いたものも曜日。 */
const withoutWeekday = (text: string, weekdays: readonly string[]): string => {
  const inside = LEADING_BRACKET.exec(text);
  if (inside === null) return text;
  const word = (inside[1] ?? "").trim().toLowerCase();
  return word !== "" && weekdays.some((weekday) => weekday.toLowerCase().startsWith(word)) ? text.slice(inside[0].length) : text;
};

/** 範囲（9月1日〜9月30日、July 1 – August 31）の終わりのすぐ後ろの括弧に、期間だけを書いた（（30日間）、(30 days)）。 */
export const isRangeLength = (text: RangeText, range: readonly [Span, Span], duration: Span): boolean => {
  const { source, ...words } = text;
  const [first, end] = range;
  if (first.end > end.start || end.end > duration.start) return false;
  const joint = withoutWeekday(source.slice(first.end, end.start), words.weekdays).trim().toLowerCase();
  return (
    words.joiners.some((joiner) => joiner.toLowerCase() === joint) &&
    OPEN_BRACKET.test(withoutWeekday(source.slice(end.end, duration.start), words.weekdays)) &&
    CLOSE_BRACKET.test(source.slice(duration.end))
  );
};

/** 年まで書いた二つの日付は、早いほうを始まりにする（「7月1日まで、4月1日から3か月」）。月日だけなら書いた順（年をまたぐことがある）。 */
const ordered = (first: DatedValue, second: DatedValue, withYear: boolean): [DatedValue, DatedValue] =>
  withYear && second.value < first.value ? [second, first] : [first, second];

/** 名詞の前の期間は、日付の間がその二倍までのときだけ組にする。75日の間に書いた 7-day の窓は別の長さ。 */
export const ATTRIBUTIVE_REACH = 2;

/** 書いた終わりの日。年の無い月日で始まりより前なら、翌年。 */
const endDateOf = (start: Date, end: DatedValue, withYear: boolean): Date | undefined => {
  const written = calendarDateOf(end.value);
  if (written === undefined) return undefined;
  const date = dateOf(written);
  return withYear || date >= start ? date : shifted(date, 1, "year");
};

const beyondReach = (start: Date, end: DatedValue, duration: Duration, withYear: boolean): boolean => {
  if (duration.attributive !== true) return false;
  const endDate = endDateOf(start, end, withYear);
  return endDate === undefined || endDate > shifted(start, duration.amount * ATTRIBUTIVE_REACH, duration.unit);
};

const mismatchOf = (written: readonly [DatedValue, DatedValue], duration: Duration, rangeLength: boolean): DurationMismatch | undefined => {
  const [firstDate, secondDate] = [calendarDateOf(written[0].value), calendarDateOf(written[1].value)];
  if (firstDate === undefined || secondDate === undefined || (firstDate.year === undefined) !== (secondDate.year === undefined)) return undefined;
  const withYear = firstDate.year !== undefined;
  const [start, end] = ordered(written[0], written[1], withYear);
  const startDate = calendarDateOf(start.value);
  if (startDate === undefined) return undefined;
  const ends = expectedEnds(dateOf(startDate), duration, rangeLength);
  const [inclusive] = ends;
  if (inclusive === undefined || ends.some((candidate) => valueOf(candidate, withYear) === end.value)) return undefined;
  if (beyondReach(dateOf(startDate), end, duration, withYear)) return undefined;
  return { start, duration, end, expected: valueOf(inclusive, withYear) };
};

/** 一つの文の中の、始まり・期間・終わり。 */
export const durationMismatches = (
  sentences: readonly Span[],
  dates: readonly DatedValue[],
  durations: readonly Duration[],
  text: RangeText,
): DurationMismatch[] => {
  const datesIn = bySentence(sentences, dates);
  return [...bySentence(sentences, durations).entries()].flatMap(([index, inDurations]) => {
    const inDates = datesIn.get(index) ?? [];
    const [first, second] = inDates;
    const [duration] = inDurations;
    if (inDates.length !== 2 || inDurations.length !== 1 || first === undefined || second === undefined || duration === undefined) return [];
    const mismatch = mismatchOf([first, second], duration, isRangeLength(text, [first, second], duration));
    return mismatch === undefined ? [] : [mismatch];
  });
};
