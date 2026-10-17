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
/** "Mar 28 14:02:11 UTC 2024", the form of `date` and C's ctime: the year comes after the time and its zone. */
const DAY_TIME_YEAR_AFTER = /^ (?<d>\d{1,2}) (?:[01]?\d|2[0-3]):[0-5]\d(?::[0-5]\d)?(?: (?!AM\b|PM\b)[A-Z]{2,5})? (?<y>\d{4})\b/u;
const TIME_YEAR_REACH = 32;
/** A time zone or "hrs" after four figures: "1300 UTC", "0930 PST", "1300 hrs". */
const ZONE_WORDS: ReadonlySet<string> = new Set(
  ["UTC", "GMT", "Z", "EST", "EDT", "CST", "CDT", "MST", "MDT", "PST", "PDT", "BST", "IST", "JST", "KST"].concat([
    "CET",
    "CEST",
    "EET",
    "EEST",
    "AEST",
    "AEDT",
    "hrs",
    "hours",
  ]),
);
/** The word after the figures, unless it runs on into "&" ("AT&T"). */
const WORD_AFTER = /^ ?(?<word>[A-Za-z]+)(?![\w&])/u;
const zoneAfter = (rest: string): boolean => ZONE_WORDS.has(WORD_AFTER.exec(rest)?.groups?.["word"] ?? "");
const HOURS_IN_DAY = 24;
const MINUTES_IN_HOUR = 60;
/** From here on, four figures before a zone may be a year as well as a time ("March 28 2024 UTC"), and stay a year. */
const MODERN_YEARS_FROM = 1900;

/** "Mar 28 1300 UTC": four figures that can only be a 24-hour clock, with a time zone after them, are the time, not the year. */
const clockTime = (figures: string, rest: string): boolean =>
  Number(figures) < MODERN_YEARS_FROM && Number(figures.slice(0, 2)) < HOURS_IN_DAY && Number(figures.slice(2)) < MINUTES_IN_HOUR && zoneAfter(rest);

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
  if (found?.groups === undefined || clockTime(found.groups["y"] ?? "", text.slice(end + found[0].length))) return undefined;
  const value = `${found.groups["y"] ?? ""}-${pad(String(month))}-${pad(found.groups["d"] ?? "")}`;
  return { start: at, end: end + found[0].length, attrs: { value } };
};

/** "Mar 28 14:02:11 UTC 2024" → 2024-03-28. The mention ends at the day, so the time stays a time of its own. */
const monthDayTimeYear = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const found = DAY_TIME_YEAR_AFTER.exec(text.slice(end, end + TIME_YEAR_REACH));
  const day = found?.groups?.["d"];
  if (found?.groups === undefined || day === undefined) return undefined;
  const value = `${found.groups["y"] ?? ""}-${pad(String(month))}-${pad(day)}`;
  return { start: at, end: end + 1 + day.length, attrs: { value } };
};

/** "1 April 2024" → 2024-04-01, "April 2024" → 2024-04. */
const monthYear = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const found = YEAR_AFTER.exec(text.slice(end, end + 8));
  const year = found?.groups?.["y"];
  if (found === null || year === undefined || clockTime(year, text.slice(end + found[0].length))) return undefined;
  const before = dayBefore(text, at);
  const value = [year, pad(String(month)), ...(before === undefined ? [] : [pad(before.day)])].join("-");
  return { start: before?.start ?? at, end: end + found[0].length, attrs: { value } };
};

/** "March 5", not "March 5.5", "March 5:30" or "March 50". */
const DAY_AFTER = /^ (?<d>\d{1,2})(?:st|nd|rd|th)?(?![\w%]|[.,:]\d)/u;
const LAST_DAY = 31;
/** "Rule 3 May Apply", a title-case heading: "May" before a capitalised word may be the modal, not the month after a day. */
const MODAL_AFTER = /^May [A-Z]/u;
/** "SEP 2 form", "MAY 2 servers": a capitalised month with a day and no year is more often a code or a shout than a date. */
const ALL_CAPS = /^[A-Z]+$/u;
/** The days listed after the first, "March 5, 6 and 7, 2026": ", 6". */
const LISTED_DAYS = /^(?:,\s*\d{1,2}(?:st|nd|rd|th)?)*/u;
const LINK = /^,?\s*(?:[-–—]|to|through|until|till|and|or|&)\s*/u;
const LEADING_MONTH = /^[A-Z][a-z]{2,8}\.?\s+/u;
const LATER_DAY = /^\d{1,2}(?:st|nd|rd|th)?/u;
const TRAILING_MONTH = /^\s+[A-Z][a-z]{2,8}\.?/u;
const YEAR_NEXT = /^,?\s+\d{4}\b/u;
const YEAR_LATER_REACH = 60;

/** What follows a match of `pattern` at the start of `text`, or `text` itself when `pattern` is optional and absent. */
const after = (text: string | undefined, pattern: RegExp, optional = false): string | undefined => {
  if (text === undefined) return undefined;
  const found = pattern.exec(text);
  if (found === null) return optional ? text : undefined;
  return text.slice(found[0].length);
};

/**
 * "March 5 – 7, 2026", "5 March to 7 April 2026", "March 5, 6 and 7, 2026": the year written once, at the end of the
 * range or the list, belongs to this date too, so it is not read as one without a year.
 */
const yearLater = (text: string): boolean => {
  const linked = after(after(text, LISTED_DAYS, true), LINK);
  const day = after(after(linked, LEADING_MONTH, true), LATER_DAY);
  const rest = after(day, TRAILING_MONTH, true);
  return rest !== undefined && YEAR_NEXT.test(rest);
};

/** "2025 Dec 18" and "1872 February 4" (a citation's or an astronomer's order) carry their year in front; "Figure 3 5 May" is no date. */
const YEAR_OR_NUMBER_BEFORE = /\d,?\s*$/u;

const isDay = (day: string): boolean => Number(day) >= 1 && Number(day) <= LAST_DAY;

/** "March 5" or "5 March" with no year → 03-05. */
const monthDay = (text: string, at: number, end: number, month: number): Mention | undefined => {
  const after = DAY_AFTER.exec(text.slice(end, end + 8));
  const afterDay = after?.groups?.["d"];
  const before = afterDay === undefined && !MODAL_AFTER.test(text.slice(at, end + 2)) ? dayBefore(text, at) : undefined;
  const day = afterDay ?? before?.day;
  const start = before?.start ?? at;
  if (day === undefined || !isDay(day) || YEAR_OR_NUMBER_BEFORE.test(text.slice(Math.max(0, start - 6), start))) return undefined;
  const dateEnd = after === null ? end : end + after[0].length;
  if (yearLater(text.slice(dateEnd, dateEnd + YEAR_LATER_REACH))) return undefined;
  return { start, end: dateEnd, attrs: { value: `${pad(String(month))}-${pad(day)}` } };
};

/**
 * A month name alone is not a date: "May" is also the modal verb, so it counts only with a year beside it, or a day.
 * The month is found first and its neighbours read with anchored patterns, never one long alternation.
 */
const namedDate = (text: string, match: RegExpExecArray): Mention | undefined => {
  const word = (match.groups?.["month"] ?? "").toLowerCase();
  const full = MONTHS.indexOf(word) + 1;
  const month = full === 0 ? (ABBREVIATED.get(word) ?? 0) : full;
  if (month === 0) return undefined;
  const end = match.index + match[0].length + (full === 0 && text.charAt(match.index + match[0].length) === "." ? 1 : 0);
  const dated = monthDayYear(text, match.index, end, month) ?? monthYear(text, match.index, end, month) ?? monthDayTimeYear(text, match.index, end, month);
  return dated ?? (ALL_CAPS.test(match[0]) ? undefined : monthDay(text, match.index, end, month));
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
