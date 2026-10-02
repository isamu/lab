/**
 * 木の日付の値（2026-04-01、04-01、2026-04、2026）に期間を足す。年の無い月日は、同じ年の中で数える（年をまたげば翌年）。
 * 暦は先発グレゴリオ暦。月を足して月末を越えるとき（1月31日の1か月後）は、その月の末日にする。
 */
export type DurationUnit = "day" | "week" | "month" | "year";

export type CalendarDate = { readonly year: number | undefined; readonly month: number; readonly day: number };

const FULL = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MONTH_DAY = /^(\d{2})-(\d{2})$/u;
const YEAR_ONLY = /^(\d{4})$/u;
const FULL_YEAR = /^(\d{4})-\d{2}(?:-\d{2})?$/u;

/** 年がわからない月日を数えるときの年。うるう年でない年にすると 2月29日 が読めないので、うるう年を使う。 */
const LEAP_YEAR = 2000;
const DAYS_IN_WEEK = 7;
const MONTHS_IN_YEAR = 12;
const PADDED = 2;

/** 年月日か月日の値。それ以外（年月、年だけ）は undefined。 */
export const calendarDateOf = (value: string): CalendarDate | undefined => {
  const full = FULL.exec(value);
  if (full !== null) return { year: Number(full[1]), month: Number(full[2]), day: Number(full[3]) };
  const monthDay = MONTH_DAY.exec(value);
  return monthDay === null ? undefined : { year: undefined, month: Number(monthDay[1]), day: Number(monthDay[2]) };
};

/** 年を書いた値（2015、2015-04、2015-04-01）の年。 */
export const yearOf = (value: string): number | undefined => {
  const year = YEAR_ONLY.exec(value) ?? FULL_YEAR.exec(value);
  return year === null ? undefined : Number(year[1]);
};

const utcOf = (year: number, month: number, day: number): Date => new Date(Date.UTC(year, month - 1, day));

const lastDayOf = (year: number, month: number): number => utcOf(year, month + 1, 0).getUTCDate();

const addMonths = (date: Date, months: number): Date => {
  const target = utcOf(date.getUTCFullYear(), date.getUTCMonth() + 1 + months, 1);
  const day = Math.min(date.getUTCDate(), lastDayOf(target.getUTCFullYear(), target.getUTCMonth() + 1));
  return utcOf(target.getUTCFullYear(), target.getUTCMonth() + 1, day);
};

const addDays = (date: Date, days: number): Date => utcOf(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate() + days);

/** 日付に期間を足す（負なら引く）。 */
export const shifted = (date: Date, amount: number, unit: DurationUnit): Date => {
  if (unit === "day") return addDays(date, amount);
  if (unit === "week") return addDays(date, amount * DAYS_IN_WEEK);
  return addMonths(date, unit === "month" ? amount : amount * MONTHS_IN_YEAR);
};

/** 年の無い月日には仮の年を付ける。 */
export const dateOf = (date: CalendarDate): Date => utcOf(date.year ?? LEAP_YEAR, date.month, date.day);

export const sameDay = (left: Date, right: Date): boolean => left.getTime() === right.getTime();

/** 日付を、元の値と同じ細かさの値（年が無ければ月日だけ）にする。 */
export const valueOf = (date: Date, withYear: boolean): string => {
  const month = String(date.getUTCMonth() + 1).padStart(PADDED, "0");
  const day = String(date.getUTCDate()).padStart(PADDED, "0");
  return withYear ? `${String(date.getUTCFullYear())}-${month}-${day}` : `${month}-${day}`;
};
