// Capitals a document uses as the name of a numbered series (RFC 5785 and RFC 7230, BCP 78 and BCP 14, DR 4339 and
// DR 4340). Pure.

/** Capitals, a space, and a whole number that is not part of a decimal, a range or a longer identifier. */
const NUMBERED = /(?<![\p{L}\p{N}_&.-])(?<series>[A-Z]{2,6}) (?<number>\d{1,6})(?![\p{L}\p{N}_&]|[.,:/-]\d)/gu;

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
    if (YEAR.test(number)) return;
    numbers.set(series, (numbers.get(series) ?? new Set<string>()).add(number));
  });
  return new Set([...numbers].filter(([, seen]) => seen.size >= MIN_NUMBERS).map(([series]) => series));
};
