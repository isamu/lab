import type { Mention } from "chaffjs/plugin";

// Dates in English text, and the weekday written beside one.

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** "Sep", "Sept": a month cut short, which may carry a period ("Sept. 12, 2025"). */
const ABBREVIATED: ReadonlyMap<string, number> = new Map([...MONTHS.map((name, index) => [name.slice(0, 3), index + 1] as const), ["sept", 9]]);
/** Title case or capitals ("SEP 01, 2022" on a web page): a lower-case "mar" or "may" is never a month. */
const MONTH_WORD = /\b(?<month>[A-Z][a-z]{2,8}|[A-Z]{3,9})\b/gu;
/** "12-SEP-2025", the day-month-year form of labels and logs. Only a three-letter month is written this way. */
const HYPHENATED_DATE = /(?<![\w-])(?<d>\d{1,2})-(?<month>[A-Z][a-z]{2}|[A-Z]{3})-(?<y>\d{4})(?![\w-])/gu;
const ISO_DATE = /\b(?<y>\d{4})-(?<m>\d{2})-(?<d>\d{2})\b/gu;
const DAY_BEFORE = /(?<d>\d{1,2})(?:st|nd|rd|th)? $/u;
const DAY_YEAR_AFTER = /^ (?<d>\d{1,2})(?:st|nd|rd|th)?,? (?<y>\d{4})\b/u;
const YEAR_AFTER = /^,? (?<y>\d{4})\b/u;

const pad = (value: string): string => value.padStart(2, "0");

/** "1 April 2024": the day written before the month. */
const dayBefore = (text: string, at: number): { readonly day: string; readonly start: number } | undefined => {
  const found = DAY_BEFORE.exec(text.slice(Math.max(0, at - 6), at));
  const day = found?.groups?.["d"];
  return found === null || day === undefined ? undefined : { day, start: at - found[0].length };
};

/** "April 1, 2024" → 2024-04-01. */
const monthDayYear = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const found = DAY_YEAR_AFTER.exec(text.slice(end, end + 16));
  if (found?.groups === undefined) return undefined;
  const value = `${found.groups["y"] ?? ""}-${pad(String(month))}-${pad(found.groups["d"] ?? "")}`;
  return { start: at, end: end + found[0].length, attrs: { value } };
};

/** "1 April 2024" → 2024-04-01, "April 2024" → 2024-04. */
const monthYear = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const found = YEAR_AFTER.exec(text.slice(end, end + 8));
  const year = found?.groups?.["y"];
  if (found === null || year === undefined) return undefined;
  const before = dayBefore(text, at);
  const value = [year, pad(String(month)), ...(before === undefined ? [] : [pad(before.day)])].join("-");
  return { start: before?.start ?? at, end: end + found[0].length, attrs: { value } };
};

/**
 * A month name alone is not a date: "May" is also the modal verb, so it counts only with a year beside it.
 * The month is found first and its neighbours read with anchored patterns, never one long alternation.
 */
const namedDate = (text: string, match: RegExpExecArray): Mention | undefined => {
  const word = (match.groups?.["month"] ?? "").toLowerCase();
  const full = MONTHS.indexOf(word) + 1;
  const month = full === 0 ? (ABBREVIATED.get(word) ?? 0) : full;
  if (month === 0) return undefined;
  const end = match.index + match[0].length + (full === 0 && text.charAt(match.index + match[0].length) === "." ? 1 : 0);
  return monthDayYear(text, match.index, end, month) ?? monthYear(text, match.index, end, month);
};

const hyphenatedDate = (match: RegExpExecArray): Mention[] => {
  const month = ABBREVIATED.get((match.groups?.["month"] ?? "").toLowerCase());
  if (month === undefined) return [];
  const value = `${match.groups?.["y"] ?? ""}-${pad(String(month))}-${pad(match.groups?.["d"] ?? "")}`;
  return [{ start: match.index, end: match.index + match[0].length, attrs: { value } }];
};

const isoDate = (match: RegExpExecArray): Mention => ({
  start: match.index,
  end: match.index + match[0].length,
  attrs: { value: `${match.groups?.["y"] ?? ""}-${match.groups?.["m"] ?? ""}-${match.groups?.["d"] ?? ""}` },
});

/** Day names and their usual abbreviations, Sunday first. */
const WEEKDAYS: readonly RegExp[] = [
  /^sun(?:day)?$/iu,
  /^mon(?:day)?$/iu,
  /^tue(?:s|sday)?$/iu,
  /^wed(?:nesday)?$/iu,
  /^thu(?:r|rs|rsday)?$/iu,
  /^fri(?:day)?$/iu,
  /^sat(?:urday)?$/iu,
];
const DAY_WORD = "[A-Z][a-z]{2,8}";
const WEEKDAY_BEFORE = new RegExp(`(?<day>${DAY_WORD})\\.?,?\\s+$`, "u");
/** After the date, only a weekday in parentheses: "(Thursday)". A bare word there may start the next sentence ("Sat down"). */
const WEEKDAY_AFTER = new RegExp(`^,?\\s*\\((?<day>${DAY_WORD})\\)`, "u");
/**
 * The end of a range or a pair, "1-3 October 2026", "1 to 3 October", "1 and 3 October": a weekday beside it could
 * belong to either day, so it is not read.
 */
/** The number before the connecting word must be a day, not the end of a year ("1 October 2026 and 3 October 2026"). */
const RANGE_BEFORE = /(?<!\d)\d{1,2}(?:st|nd|rd|th)?\s*(?:[-–—]|to|through|until|till|and|or)\s*$/u;

const weekdayOf = (word: string | undefined): number | undefined => {
  const index = word === undefined ? -1 : WEEKDAYS.findIndex((pattern) => pattern.test(word));
  return index === -1 ? undefined : index;
};

/** The weekday written right before or after a date. Sunday is 0. */
const withWeekday = (text: string, date: Mention): Mention => {
  if (RANGE_BEFORE.test(text.slice(Math.max(0, date.start - 14), date.start))) return date;
  const before = weekdayOf(WEEKDAY_BEFORE.exec(text.slice(Math.max(0, date.start - 16), date.start))?.groups?.["day"]);
  const weekday = before ?? weekdayOf(WEEKDAY_AFTER.exec(text.slice(date.end, date.end + 16))?.groups?.["day"]);
  return weekday === undefined ? date : { ...date, attrs: { ...date.attrs, weekday } };
};

export const dates = (text: string): Mention[] =>
  [
    ...[...text.matchAll(MONTH_WORD)].flatMap((match) => namedDate(text, match) ?? []),
    ...[...text.matchAll(HYPHENATED_DATE)].flatMap(hyphenatedDate),
    ...[...text.matchAll(ISO_DATE)].map(isoDate),
  ]
    .toSorted((left, right) => left.start - right.start)
    .map((date) => withWeekday(text, date));
