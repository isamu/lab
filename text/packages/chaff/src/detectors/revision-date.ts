import type { LexiconEntry } from "../plugin.ts";

// A date a page gives as its last revision ("ページ番号1064222 更新日 2026年6月10日", "Last updated: March 3, 2026") says
// when the text was changed. A record revised after everything it tells (minutes of a 2025 meeting updated in 2026) gives
// no year to the yearless dates in it; a notice revised before the dates it announces still does. Pure.

/** The labels of a revision date: the `updated` group of stamp-order-label (更新日, 最終改定日, Last updated, Revised). */
export const revisionLabelsOf = (entries: readonly LexiconEntry[]): readonly string[] =>
  entries.filter((entry) => entry.group === "updated").map((entry) => entry.pattern);

/** What may stand between the label and its date: a colon and spaces (更新日：, Last updated: ). */
const LABEL_GAP: ReadonlySet<string> = new Set([" ", "\t", "　", ":", "："]);

const withoutGap = (text: string): string => {
  const chars = [...text];
  const end = chars.findLastIndex((char) => !LABEL_GAP.has(char));
  return chars.slice(0, end + 1).join("");
};

/** The label is a word of its own: 未更新日 does not end with the label 更新日. */
const LETTER = /\p{L}/u;

/** What may end the line after the date: spaces and a full stop. */
const LINE_REST = /^[\s.。]*$/u;

/** A date where the tree reads it, and its value ("2026-06-10"). */
export type DateSpan = { readonly offset: number; readonly end: number; readonly value: string };

/**
 * Whether the date is a stamp line's revision date: a revision label right before it, and nothing after it on its line. In
 * a sentence ("the policy was revised October 1, 2025, and takes effect …") the date is an event of the text.
 */
export const isRevisionDate = (source: string, date: DateSpan, labels: readonly string[]): boolean => {
  const lineEnd = source.indexOf("\n", date.end);
  if (!LINE_REST.test(source.slice(date.end, lineEnd === -1 ? source.length : lineEnd))) return false;
  const before = withoutGap(source.slice(source.lastIndexOf("\n", date.offset - 1) + 1, date.offset)).toLowerCase();
  return labels.some((label) => label !== "" && before.endsWith(label.toLowerCase()) && !LETTER.test(before.charAt(before.length - label.length - 1)));
};

/** A day the calendar has: 2026-02-30 (a slip the text quotes) is not one of the dates the text tells of. */
const isCalendarDate = (value: string): boolean => {
  const time = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, VALUE_LENGTH) === value;
};
const VALUE_LENGTH = "YYYY-MM-DD".length;

/**
 * The offsets of the revision dates to leave out when anchoring a year: those later than every other dated date (the
 * values are "YYYY-MM-DD", so they compare as text). None when the revision is the only year the page gives.
 */
export const revisionDatesToSkip = (source: string, dated: readonly DateSpan[], labels: readonly string[]): ReadonlySet<number> => {
  const revision = new Set(dated.filter((date) => isRevisionDate(source, date, labels)));
  const told = dated.filter((date) => !revision.has(date) && isCalendarDate(date.value));
  const later = [...revision].filter((date) => told.length > 0 && told.every((other) => other.value < date.value));
  return new Set(later.map((date) => date.offset));
};

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

/** revisionDatesToSkip over the tree's dates ("2026-06-10", "06-10"), with the labels from the stamp-order-label entries. */
export const revisionDatesAmong = (source: string, dates: readonly DateSpan[], entries: readonly LexiconEntry[]): ReadonlySet<number> =>
  revisionDatesToSkip(
    source,
    dates.filter((date) => FULL_DATE.test(date.value)),
    revisionLabelsOf(entries),
  );

/**
 * What may anchor a yearless date's year: the dates to skip (revisionDatesAmong), and the document's date unless it is one
 * of them (a page whose only stamp is 「更新日：2026年6月10日」 above a meeting dated 令和7年11月11日).
 */
export const revisionAnchors = (
  source: string,
  dates: readonly DateSpan[],
  entries: readonly LexiconEntry[],
  stamp: string | undefined,
): { readonly skips: ReadonlySet<number>; readonly stamp: string | undefined } => {
  const skips = revisionDatesAmong(source, dates, entries);
  return { skips, stamp: dates.some((date) => skips.has(date.offset) && date.value === stamp) ? undefined : stamp };
};
