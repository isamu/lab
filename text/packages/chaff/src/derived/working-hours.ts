import type { Span } from "../plugin.ts";
import { dayShiftOf, SECONDS_PER_DAY, withoutDayShiftBefore, type Mark, type TimeSpan, type TimeWords } from "../structure/time-marks.ts";
import { labelOf, mentionsIn, readScopes, within, type TimeLength } from "./time-lengths.ts";

/**
 * Working hours: the stated total (実働8時間, 8 hours a day) against the end minus the start minus the break
 * (9:00〜17:30、休憩1時間 is 7.5 hours). Read in one line, or in a list whose items say it together, holding exactly one
 * range of two times, one break with its length and one total, and no other length. A range across midnight is read
 * only when the end carries a next-day mark (22:00〜翌7:00). Pure.
 */
export type WorkingHoursWords = {
  /** What stands alone between the two times of a range (〜, to, から). */
  readonly joiners: readonly string[];
  readonly dayShifts: readonly Mark[];
  readonly breaks: readonly Mark[];
  readonly totals: readonly Mark[];
  readonly approximate: readonly Mark[];
};

export type WorkingHoursMismatch = {
  readonly start: Span;
  readonly end: Span;
  readonly break: Span;
  readonly total: Span;
  /** The total the times and the break give, in minutes. */
  readonly expected: number;
};

type ClockRange = Span & { readonly from: Span; readonly to: Span; readonly minutes: number | undefined };

const SECONDS_PER_MINUTE = 60;

const keyOf = (text: string): string => text.normalize("NFKC").trim().toLowerCase().replace(/\s+/gu, " ");

const timeWordsOf = (words: WorkingHoursWords): TimeWords => ({ legs: [], columns: [], dayShifts: words.dayShifts, zones: [] });

/** The minutes from one time to the other, the end a day later when it carries a next-day mark. */
const minutesOf = (text: string, from: TimeSpan, to: TimeSpan, words: TimeWords): number | undefined => {
  const shift = dayShiftOf(text.slice(from.end, to.start), text, to.end, words);
  const seconds = to.seconds + Math.max(0, shift) * SECONDS_PER_DAY - from.seconds;
  return seconds > 0 ? seconds / SECONDS_PER_MINUTE : undefined;
};

/** Two times written one after the other with only a joiner between them (9:00〜17:30, 9 a.m. to 5:30 p.m.). */
export const clockRanges = (text: string, times: readonly TimeSpan[], words: WorkingHoursWords): ClockRange[] => {
  const joiners = new Set(words.joiners.map(keyOf));
  const timeWords = timeWordsOf(words);
  return times.flatMap((from, index): ClockRange[] => {
    const to = times[index + 1];
    if (to === undefined || !joiners.has(keyOf(withoutDayShiftBefore(text.slice(from.end, to.start), timeWords)))) return [];
    return [{ start: from.start, end: to.end, from, to, minutes: minutesOf(text, from, to, timeWords) }];
  });
};

const isApproximate = (text: string, length: Span, words: WorkingHoursWords): boolean => labelOf(text, length, words.approximate) !== undefined;

type Labeled = { readonly length: TimeLength; readonly label: Span };

const labeled = (text: string, lengths: readonly TimeLength[], marks: readonly Mark[]): Labeled[] =>
  lengths.flatMap((length) => {
    const label = labelOf(text, length, marks);
    return label === undefined ? [] : [{ length, label }];
  });

/** The one statement in scope, or undefined when the scope does not hold exactly one. */
const statementIn = (text: string, scope: Span, ranges: readonly ClockRange[], lengths: readonly TimeLength[], words: WorkingHoursWords) => {
  const inRanges = ranges.filter((range) => within(range, scope));
  const inLengths = lengths.filter((length) => within(length, scope));
  const breaks = labeled(text, inLengths, words.breaks);
  const totals = labeled(text, inLengths, words.totals);
  const [range, breakLength, total] = [inRanges[0], breaks[0], totals[0]];
  if (inRanges.length !== 1 || breaks.length !== 1 || totals.length !== 1 || inLengths.length !== 2) return undefined;
  if (range?.minutes === undefined || breakLength === undefined || total === undefined || breakLength.length === total.length) return undefined;
  const label = breakLength.label;
  const unexplained = mentionsIn(text, scope, words.breaks).some((mention) => mention.end <= label.start || mention.start >= label.end);
  if (unexplained || isApproximate(text, breakLength.length, words) || isApproximate(text, total.length, words)) return undefined;
  return { range: { ...range, minutes: range.minutes }, breakLength: breakLength.length, total: total.length };
};

/** Working hours whose stated total is not the end minus the start minus the break. */
export const workingHoursMismatches = (
  text: string,
  source: string,
  sentences: readonly Span[],
  times: readonly TimeSpan[],
  lengths: readonly TimeLength[],
  words: WorkingHoursWords,
): WorkingHoursMismatch[] => {
  const ranges = clockRanges(text, times, words);
  return readScopes(text, source, { sentences, times }, (scope) => statementIn(text, scope, ranges, lengths, words)).flatMap(
    ({ range, breakLength, total }) => {
      const expected = range.minutes - breakLength.minutes;
      if (expected <= 0 || expected === total.minutes) return [];
      return [{ start: range.from, end: range.to, break: breakLength, total, expected }];
    },
  );
};
