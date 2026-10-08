import type { Span } from "../plugin.ts";
import type { Mark } from "../structure/time-marks.ts";
import { labelOf, readScopes, within, type TimeLength } from "./time-lengths.ts";

/**
 * A number of sessions times the length of one against the stated total (90分×15回（計24時間）, 15 sessions of 90
 * minutes, 24 hours in total). Read in one line, or in a list whose items say it together, holding exactly one count of
 * two or more sessions, one length of a session and one total. A total written as approximate (約24時間, about 24 hours)
 * may differ by less than the smallest unit it is written in. Pure.
 */
export type Count = Span & { readonly amount: number };

export type SessionHoursWords = { readonly totals: readonly Mark[]; readonly approximate: readonly Mark[] };

export type SessionHoursMismatch = {
  readonly count: Count;
  readonly length: TimeLength;
  readonly total: TimeLength;
  /** The count times the length, in minutes. */
  readonly expected: number;
};

const overlaps = (left: Span, right: Span): boolean => left.start < right.end && right.start < left.end;

type Statement = { readonly count: Count; readonly length: TimeLength; readonly total: TimeLength };

/** The length with a rough mark written before it taken in (計約24時間 reads its label past 約). */
const withRoughMark = (text: string, length: TimeLength, words: SessionHoursWords): Span => {
  const mark = labelOf(text, length, words.approximate);
  return mark !== undefined && mark.end <= length.start ? { start: mark.start, end: length.end } : length;
};

const statementIn = (text: string, scope: Span, counts: readonly Count[], lengths: readonly TimeLength[], words: SessionHoursWords) => {
  const inCounts = counts.filter((count) => count.amount > 1 && within(count, scope));
  const inLengths = lengths.filter((length) => within(length, scope));
  const totals = inLengths.filter((length) => labelOf(text, withRoughMark(text, length, words), words.totals) !== undefined);
  const sessions = inLengths.filter((length) => !totals.includes(length));
  const [count, length, total] = [inCounts[0], sessions[0], totals[0]];
  if (inCounts.length !== 1 || sessions.length !== 1 || totals.length !== 1 || count === undefined || length === undefined || total === undefined)
    return undefined;
  if (overlaps(count, length) || labelOf(text, length, words.approximate) !== undefined) return undefined;
  return { count, length, total } satisfies Statement;
};

const allowanceOf = (text: string, total: TimeLength, words: SessionHoursWords): number =>
  labelOf(text, total, words.approximate) === undefined ? 0 : total.unit;

/** Sessions whose count times length is not the stated total. counts are the written counts of sessions (15回, 15 sessions). */
export const sessionHoursMismatches = (
  text: string,
  source: string,
  sentences: readonly Span[],
  counts: readonly Count[],
  lengths: readonly TimeLength[],
  words: SessionHoursWords,
): SessionHoursMismatch[] =>
  readScopes(text, source, { sentences, times: [] }, (scope) => statementIn(text, scope, counts, lengths, words)).flatMap(({ count, length, total }) => {
    const expected = count.amount * length.minutes;
    const allowance = allowanceOf(text, total, words);
    if (allowance === 0 ? expected === total.minutes : Math.abs(expected - total.minutes) < allowance) return [];
    return [{ count, length, total, expected }];
  });
