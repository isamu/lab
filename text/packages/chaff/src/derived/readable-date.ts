import { escapeRegExp } from "../orthography.ts";

/**
 * A date chaff computed or read into a value (2026-06-30, 06-30, 2026-06), written for a message the way a reader writes it:
 * 2026年6月30日, June 30, 2026, or 30 June 2026 when the document writes its English dates day first. Text a message quotes
 * from the document never comes through here: it stays as written. Pure.
 */
export type DayOrder = "month-first" | "day-first";

/** months: the month names, January first. A language without them (or with fewer than twelve) keeps the value as it is. */
export type DateWords = { readonly language: string; readonly months: readonly string[]; readonly order: DayOrder };

type DateParts = { readonly year: string | undefined; readonly month: number; readonly day: number | undefined };

const FULL = /^(\d{4})-(\d{2})-(\d{2})$/u;
const MONTH_DAY = /^(\d{2})-(\d{2})$/u;
const YEAR_MONTH = /^(\d{4})-(\d{2})$/u;
const MONTHS_IN_YEAR = 12;
const LAST_DAY = 31;

const partsOf = (value: string): DateParts | undefined => {
  const full = FULL.exec(value);
  if (full !== null) return { year: full[1], month: Number(full[2]), day: Number(full[3]) };
  const monthDay = MONTH_DAY.exec(value);
  if (monthDay !== null) return { year: undefined, month: Number(monthDay[1]), day: Number(monthDay[2]) };
  const yearMonth = YEAR_MONTH.exec(value);
  return yearMonth === null ? undefined : { year: yearMonth[1], month: Number(yearMonth[2]), day: undefined };
};

const inRange = (parts: DateParts): boolean =>
  parts.month >= 1 && parts.month <= MONTHS_IN_YEAR && (parts.day === undefined || (parts.day >= 1 && parts.day <= LAST_DAY));

const japanese = ({ year, month, day }: DateParts): string =>
  [year === undefined ? "" : `${year}年`, `${String(month)}月`, day === undefined ? "" : `${String(day)}日`].join("");

const english = ({ year, month, day }: DateParts, name: string, order: DayOrder): string => {
  if (day === undefined) return `${name} ${year ?? ""}`.trim();
  if (order === "day-first") return [String(day), name, ...(year === undefined ? [] : [year])].join(" ");
  return year === undefined ? `${name} ${String(day)}` : `${name} ${String(day)}, ${year}`;
};

/** The value as a reader writes the date; a value that is not a date (or a language without month names) is returned unchanged. */
export const readableDate = (value: string, words: DateWords): string => {
  const parts = partsOf(value);
  if (parts === undefined || !inRange(parts)) return value;
  if (words.language === "ja") return japanese(parts);
  const name = words.months.length >= MONTHS_IN_YEAR ? words.months[parts.month - 1] : undefined;
  return name === undefined ? value : english(parts, name, words.order);
};

/**
 * Whether the document writes its English dates day first ("30 June 2026") rather than month first ("June 30, 2026"): the
 * order more of its written dates take. A tie, or no English date at all, is month first.
 */
export const dayOrderOf = (written: readonly string[], monthWords: readonly string[]): DayOrder => {
  if (monthWords.length === 0) return "month-first";
  const names = monthWords.map(escapeRegExp).join("|");
  const dayFirst = new RegExp(`(?:^|[^\\d])\\d{1,2}(?:st|nd|rd|th)?\\s+(?:${names})\\b`, "u");
  const monthFirst = new RegExp(`\\b(?:${names})\\.?\\s+\\d{1,2}(?!\\d)`, "u");
  const dayFirstCount = written.filter((text) => dayFirst.test(text) && !monthFirst.test(text)).length;
  const monthFirstCount = written.filter((text) => monthFirst.test(text) && !dayFirst.test(text)).length;
  return dayFirstCount > monthFirstCount ? "day-first" : "month-first";
};
