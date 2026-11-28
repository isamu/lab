// Capitals a document uses as the name of a numbered series (RFC 5785 and RFC 7230, BCP 78 and BCP 14, DR 4339 and
// DR 4340). Pure.

/**
 * Capitals, a space, and a whole number that is not part of a decimal, a range or a longer identifier. A letter's number
 * (SR 24-2, CA 21-13) is a two-digit year and the letter's place in it.
 */
const NUMBERED = /(?<![\p{L}\p{N}_&.-])(?<series>[A-Z]{2,6}) (?<number>\d\d-\d{1,3}|\d{1,6})(?![\p{L}\p{N}_&]|[.,:/-]\d)/gu;

/** Two numbers of one length, the smaller first (10-20), are a range, not a year and a letter's place in it. */
const isRange = (number: string): boolean => {
  const [low, high] = number.split("-");
  return high !== undefined && low !== undefined && low.length === high.length && Number(low) < Number(high);
};

/** A year after capitals is when something was held or issued (FOSDEM 2024, SKO 2025), not a number in a series. */
const YEAR = /^(?:19|20)\d\d$/u;

/** One number is a single thing cited (STD 66); two different numbers make the capitals a series the reader looks up by number. */
const MIN_NUMBERS = 2;

/**
 * The capitals the document writes before at least two different numbers. A numbered series is known by its numbers: a
 * reader of "BCP 78 … BCP 14" looks the numbers up, and the name needs no expansion. Capitals before one number, or before
 * years only, are not read so.
 */
export const numberedSeries = (source: string): ReadonlySet<string> => {
  const numbers = new Map<string, Set<string>>();
  [...source.matchAll(NUMBERED)].forEach((match) => {
    const series = match.groups?.["series"] ?? "";
    const number = match.groups?.["number"] ?? "";
    if (YEAR.test(number) || isRange(number)) return;
    numbers.set(series, (numbers.get(series) ?? new Set<string>()).add(number));
  });
  return new Set([...numbers].filter(([, seen]) => seen.size >= MIN_NUMBERS).map(([series]) => series));
};

/** A heading that opens with a document's number in its series and a colon (### SR 26-8: Updates to …). */
const NUMBER_HEADING = /^(?<series>[A-Z]{2,6}) \d+(?:-\d+)+:\s/u;

/**
 * The capitals of a series whose number titles a heading: the page is that numbered letter or notice, and its series is
 * how the reader finds it. A plain number (KPI 1: Revenue) numbers the headings and makes no series.
 */
export const headingSeries = (headings: readonly string[]): ReadonlySet<string> =>
  new Set(headings.flatMap((heading) => NUMBER_HEADING.exec(heading)?.groups?.["series"] ?? []));
