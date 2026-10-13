import { weekdayOf } from "./weekday.ts";

/**
 * 期間の両端を、比べられる値にする。年を片方にだけ書いた期間（2026年7月9日〜7月8日、July 9 – July 8, 2026）は、書いた年を
 * もう片方にも当てて読む。そう読むと逆になる期間は、年の境をまたぐ期間（2026年12月28日〜1月4日）でもあり得るので、
 * もう片方を一年ずらした読み方を退けられるときだけ逆と言う。年の無い側の曜日がどちらの年に合うか、合わなければ、またぐ読み方の長さで決める。
 */
export type RangeEnd = { readonly value: string; readonly weekday?: number | undefined };

export type RangeReading = { readonly start: string; readonly end: string };

/** 年の境をまたぐと読んだ期間がこれより長ければ、またぐ読み方は退ける。年末年始の休みや冬の旅程は数週間で、一年近い期間を年を省いて書くことはない。 */
export const YEAR_END_CROSSING_DAYS = 300;

const DAY_MS = 86_400_000;
const FULL_DATE = /^(?<y>\d{4})-(?<md>\d{2}-\d{2})$/u;
const MONTH_DAY = /^\d{2}-\d{2}$/u;
const COMPARABLE = [/^\d{4}-\d{2}-\d{2}$/u, /^\d{4}-\d{2}$/u];

const timeOf = (value: string): number | undefined => {
  if (weekdayOf(value) === undefined) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1);
};

const withYear = (year: number, monthDay: string): string => `${String(year)}-${monthDay}`;

/** 二つの読み方。same は年を書いた側と同じ年、crossing は年の無い側を一年ずらした年。 */
type Readings = { readonly same: RangeReading; readonly crossing: RangeReading; readonly yearless: "start" | "end"; readonly weekday?: number | undefined };

const readingsOf = (start: RangeEnd, end: RangeEnd): Readings | undefined => {
  const startYear = FULL_DATE.exec(start.value)?.groups;
  const endYear = FULL_DATE.exec(end.value)?.groups;
  if (startYear !== undefined && MONTH_DAY.test(end.value)) {
    const year = Number(startYear["y"]);
    const crossing = { start: start.value, end: withYear(year + 1, end.value) };
    return { same: { start: start.value, end: withYear(year, end.value) }, crossing, yearless: "end", weekday: end.weekday };
  }
  if (endYear !== undefined && MONTH_DAY.test(start.value)) {
    const year = Number(endYear["y"]);
    const crossing = { start: withYear(year - 1, start.value), end: end.value };
    return { same: { start: withYear(year, start.value), end: end.value }, crossing, yearless: "start", weekday: start.weekday };
  }
  return undefined;
};

/** 年の無い側の曜日が、同じ年の読み方に合えば同じ年、またぐ読み方に合えばまたぐ。どちらにも合わなければ決めない。 */
const weekdayDecides = (readings: Readings): "same" | "crossing" | undefined => {
  if (readings.weekday === undefined) return undefined;
  const weekdayAt = (reading: RangeReading): number | undefined => weekdayOf(reading[readings.yearless]);
  if (weekdayAt(readings.same) === readings.weekday) return "same";
  return weekdayAt(readings.crossing) === readings.weekday ? "crossing" : undefined;
};

const crossingTooLong = ({ start, end }: RangeReading): boolean => {
  const [from, to] = [timeOf(start), timeOf(end)];
  return from === undefined || to === undefined || to - from > YEAR_END_CROSSING_DAYS * DAY_MS;
};

/** 年を片方にだけ書いた期間を同じ年と読んで逆になり、年の境をまたぐ読み方を退けられるときの、同じ年の読み方。 */
const sameYearReversed = (start: RangeEnd, end: RangeEnd): RangeReading | undefined => {
  const readings = readingsOf(start, end);
  if (readings === undefined || timeOf(readings.same.start) === undefined || timeOf(readings.same.end) === undefined) return undefined;
  if (readings.same.end >= readings.same.start) return undefined;
  const decided = weekdayDecides(readings) ?? (crossingTooLong(readings.crossing) ? "same" : "crossing");
  return decided === "same" ? readings.same : undefined;
};

/** 終わりが始まりより前と言える期間の、比べた両端。両方に年があればそのまま比べる。言えなければ undefined。 */
export const reversedReading = (start: RangeEnd, end: RangeEnd): RangeReading | undefined => {
  if (COMPARABLE.some((pattern) => pattern.test(start.value) && pattern.test(end.value))) {
    return end.value < start.value ? { start: start.value, end: end.value } : undefined;
  }
  return sameYearReversed(start, end);
};
