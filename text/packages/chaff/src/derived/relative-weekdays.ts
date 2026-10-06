// A date named by a weekday or a day relative to the document's date (「来週月曜（10月12日）」"next Monday (October 12)",
// 「明日（10月7日）」) that the absolute date beside it contradicts. Pure; the detector finds the words and the dates.
import type { Span } from "../plugin.ts";

/** 「来週月曜」"next Monday": weeks from the base's week (来週 is 1), and the weekday (Sunday is 0). */
export type WeekdayRelative = Span & { readonly kind: "weekday"; readonly weeks: number; readonly weekday: number };
/** 「明日」"tomorrow": days from the base. */
export type DayRelative = Span & { readonly kind: "day"; readonly days: number };
export type DayWord = WeekdayRelative | DayRelative;

const DAY_MS = 86_400_000;
const WEEK = 7;
const MONDAY = 1;
const FULL = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MONTH_DAY = /^(\d{2})-(\d{2})$/u;

const timeOf = (value: string): number | undefined => {
  const found = FULL.exec(value);
  if (found === null) return undefined;
  const [year, month, day] = [Number(found[1]), Number(found[2]), Number(found[3])];
  const time = Date.UTC(year, month - 1, day);
  const date = new Date(time);
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? time : undefined;
};

const valueOf = (time: number): string => new Date(time).toISOString().slice(0, "2026-10-06".length);

/**
 * The days a weekday word can mean. Weeks are counted from Monday or from Sunday, and "next Monday" can also mean the
 * coming Monday: every reading is allowed, so only a date that fits none of them is wrong.
 */
const weekdayCandidates = (base: number, relative: WeekdayRelative): number[] => {
  const baseDay = new Date(base).getUTCDay();
  const fromMonday = base - ((baseDay - MONDAY + WEEK) % WEEK) * DAY_MS;
  const fromSunday = base - baseDay * DAY_MS;
  const inWeek = (weekStart: number, firstDay: number): number => weekStart + (relative.weeks * WEEK + ((relative.weekday - firstDay + WEEK) % WEEK)) * DAY_MS;
  // "next Monday" and "this Monday" can mean the coming one; "last Monday" the one just past.
  const coming = base + (((relative.weekday - baseDay + WEEK - 1) % WEEK) + 1) * DAY_MS;
  const past = base - (((baseDay - relative.weekday + WEEK - 1) % WEEK) + 1) * DAY_MS;
  const nearest = new Map([
    [0, [coming]],
    [1, [coming]],
    [-1, [past]],
  ]).get(relative.weeks);
  return [inWeek(fromMonday, MONDAY), inWeek(fromSunday, 0), ...(nearest ?? [])];
};

const candidatesOf = (base: number, relative: DayWord): number[] =>
  relative.kind === "day" ? [base + relative.days * DAY_MS] : weekdayCandidates(base, relative);

/** Whether the written date (2026-10-12, or 10-12 without its year) is one of the days the word can mean. */
const fits = (written: string, candidates: readonly number[]): boolean => {
  const monthDay = MONTH_DAY.exec(written);
  return candidates.some((time) => (monthDay === null ? valueOf(time) === written : valueOf(time).slice("2026-".length) === written));
};

/** The day the word means, as the message shows it: the first reading, written as the date was (with or without the year). */
export const relativeDayMismatch = (base: string, relative: DayWord, written: string): string | undefined => {
  const baseTime = timeOf(base);
  if (baseTime === undefined || (!FULL.test(written) && !MONTH_DAY.test(written))) return undefined;
  const candidates = candidatesOf(baseTime, relative);
  const [first] = candidates;
  if (first === undefined || fits(written, candidates)) return undefined;
  return MONTH_DAY.test(written) ? valueOf(first).slice("2026-".length) : valueOf(first);
};
