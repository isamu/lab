import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * annual-holidays-mismatch: a job posting's annual days off (年間休日 90日) fewer than its weekly days off give over a year
 * (完全週休2日制 is two days off every week, at least 104 a year). Only a lower bound: public holidays, summer and the
 * new year add to it. A weekly phrase that is not every week (週休2日制 is two days off in at least one week a month), a
 * negated one, one with an exception beside it, an approximate or open count, and two different counts leave the posting
 * unchecked. The words come from the lexicons. Pure.
 */

export type PositionedWord = { readonly word: string; readonly position: "before" | "after" };

/** A weekly phrase and the fewest days off a year it gives; undefined for a phrase that is not every week (週休2日制). */
export type WeeklyWord = { readonly word: string; readonly minimum: number | undefined };

export type AnnualHolidaysWords = {
  /** Labels of the annual days off: before the count (年間休日 125日) or after it, with the word of a day in it (125 days off a year). */
  readonly labels: readonly PositionedWord[];
  /** The word of a day after a count (日, days). */
  readonly days: readonly string[];
  /** Words that may stand between a label and its count (は, is). */
  readonly links: readonly string[];
  readonly weekly: readonly WeeklyWord[];
  /** Words that negate a weekly phrase: right after it (ではない) or earlier in its sentence (not). */
  readonly negations: readonly PositionedWord[];
  /** Words after a weekly phrase on its line that make an exception to it (除く, 出勤, except). */
  readonly exceptions: readonly string[];
  /** Words that make a count approximate or open (約, 以上, about, at least). */
  readonly markers: readonly PositionedWord[];
  /** Marks and words that join the two ends of a range (〜, to). */
  readonly connectors: readonly string[];
};

type Span = { readonly start: number; readonly end: number };
type DayCount = Span & { readonly days: number; readonly clear: boolean };
type Weekly = Span & { readonly minimum: number | undefined; readonly clear: boolean };

/** How far from a count a marker (約, 以上) or the start of a range is looked for. */
const MARKER_REACH = 12;
const LATIN = /[A-Za-z]/u;
const SEPARATORS = /[\s|｜:：=＝、，,・/／()（）[\]［］-]/gu;
const PARENTHETICAL_WITHOUT_DIGITS = /[（(][^()（）0-9０-９]*[)）]/gu;
const SENTENCE_END = /[。！？；;]|[.!?](?=\s|$)/u;
const SENTENCE_SPLIT = /[。！？；;]|[.!?](?=\s)/u;
const RANGE_START = /[0-9０-９]\s*$/u;
const COUNT = "(?<![0-9０-９.,，．])([0-9０-９]+)";

const wordPattern = (word: string): string => {
  const edgeStart = LATIN.test(word.charAt(0)) ? "(?<![A-Za-z])" : "";
  const edgeEnd = LATIN.test(word.charAt(word.length - 1)) ? "(?![A-Za-z])" : "";
  return `${edgeStart}${escapeRegExp(word)}${edgeEnd}`;
};

/** One alternation of the words, longest first so 完全週休2日制 wins over 週休2日制. Undefined when there are none. */
const alternation = (words: readonly string[]): string | undefined =>
  words.length === 0
    ? undefined
    : words
        .toSorted((left, right) => right.length - left.length)
        .map(wordPattern)
        .join("|");

const occurrences = (text: string, words: readonly string[]): Span[] => {
  const pattern = alternation(words);
  if (pattern === undefined) return [];
  return [...text.matchAll(new RegExp(pattern, "giu"))].map((match) => ({ start: match.index, end: match.index + match[0].length }));
};

const contains = (text: string, words: readonly string[]): boolean => occurrences(text, words).length > 0;

const wordsAt = (words: readonly PositionedWord[], position: "before" | "after"): string[] =>
  words.filter((word) => word.position === position).map((word) => word.word.toLowerCase());

const lineEnd = (text: string, offset: number): number => {
  const end = text.indexOf("\n", offset);
  return end === -1 ? text.length : end;
};

const lineStart = (text: string, offset: number): number => text.lastIndexOf("\n", offset - 1) + 1;

/** Where a statement that starts at offset ends: at the end of its sentence or line. */
const statementEnd = (text: string, offset: number): number => {
  const end = lineEnd(text, offset);
  const sentence = SENTENCE_END.exec(text.slice(offset, end));
  return sentence === null ? end : offset + sentence.index;
};

/** The sentence before offset, from its start: where a negation of a phrase is looked for (does not have …). */
const sentenceBefore = (text: string, offset: number): string => text.slice(lineStart(text, offset), offset).split(SENTENCE_SPLIT).at(-1) ?? "";

/** Whether only separators, bracketed words without digits and the given words stand in the gap (「：」, " is "). */
export const isPlainGap = (gap: string, words: readonly string[]): boolean => {
  const pattern = alternation(words);
  const bare = gap.replace(PARENTHETICAL_WITHOUT_DIGITS, "");
  return (pattern === undefined ? bare : bare.replace(new RegExp(pattern, "giu"), "")).replace(SEPARATORS, "") === "";
};

/** Whether text starts with the word, a Latin word ending there ("to" is not the start of "total"). */
const startsWithWord = (text: string, word: string): boolean =>
  text.startsWith(word) && !(LATIN.test(word.charAt(word.length - 1)) && LATIN.test(text.charAt(word.length)));

/** Whether text ends with the word, a Latin word starting there ("over" is not the end of "moreover"). */
const endsWithWord = (text: string, word: string): boolean =>
  text.endsWith(word) && !(LATIN.test(word.charAt(0)) && LATIN.test(text.charAt(text.length - word.length - 1)));

/** Whether a count is approximate (約90日, 90日以上), open (90日〜) or the end of a range (80〜90日). */
const isMarked = (text: string, span: Span, words: AnnualHolidaysWords): boolean => {
  const before = text
    .slice(Math.max(0, span.start - MARKER_REACH), span.start)
    .trimEnd()
    .toLowerCase();
  const after = text
    .slice(span.end, span.end + MARKER_REACH)
    .trimStart()
    .toLowerCase();
  const connectors = words.connectors.map((connector) => connector.toLowerCase());
  const ranged = connectors.some((connector) => endsWithWord(before, connector) && RANGE_START.test(before.slice(0, -connector.length)));
  const markedBefore = wordsAt(words.markers, "before").some((marker) => endsWithWord(before, marker));
  const markedAfter = [...wordsAt(words.markers, "after"), ...connectors].some((marker) => startsWithWord(after, marker));
  return ranged || markedBefore || markedAfter;
};

const countOf = (written: string): number => Number(written.normalize("NFKC"));

const gapWords = (words: AnnualHolidaysWords): string[] => [...words.links, ...wordsAt(words.markers, "before")];

/** The gap without the start of a range at its end (年間休日 100〜|120日), so the range is read and found not plain. */
const withoutRangeStart = (gap: string, days: string, words: AnnualHolidaysWords): string => {
  const connectors = alternation(words.connectors);
  return connectors === undefined ? gap : gap.replace(new RegExp(`[0-9０-９]+\\s?(?:${days})?\\s?(?:${connectors})\\s*$`, "iu"), "");
};

/**
 * The count a label before it states (年間休日：125日): the first count of days in its statement, joined to it by a plain
 * gap. A marker (年間休日は約120日) or a range's start in the gap is read, so the count is found not plain rather than missed.
 */
const countAfterLabel = (text: string, label: Span, words: AnnualHolidaysWords): DayCount | undefined => {
  const days = alternation(words.days);
  if (days === undefined) return undefined;
  const end = statementEnd(text, label.end);
  const match = new RegExp(`${COUNT}\\s?(?:${days})`, "iu").exec(text.slice(label.end, end));
  if (match === null || !isPlainGap(withoutRangeStart(text.slice(label.end, label.end + match.index), days, words), gapWords(words))) return undefined;
  const span = { start: label.end + match.index, end: label.end + match.index + match[0].length };
  return { ...span, days: countOf(match[1] ?? ""), clear: !isMarked(text, span, words) };
};

/** The counts a label after them states (125 days off a year). */
const countsBeforeLabels = (text: string, words: AnnualHolidaysWords): DayCount[] => {
  const labels = alternation(wordsAt(words.labels, "after"));
  if (labels === undefined) return [];
  return [...text.matchAll(new RegExp(`${COUNT}\\s?(?:${labels})`, "giu"))].map((match) => {
    const span = { start: match.index, end: match.index + match[0].length };
    return { ...span, days: countOf(match[1] ?? ""), clear: !isMarked(text, span, words) };
  });
};

/** Every annual count of days off the document states, in document order. */
export const annualCountsIn = (text: string, words: AnnualHolidaysWords): DayCount[] => {
  const after = occurrences(text, wordsAt(words.labels, "before")).flatMap((label) => countAfterLabel(text, label, words) ?? []);
  return [...after, ...countsBeforeLabels(text, words)].toSorted((left, right) => left.start - right.start);
};

/** Whether a weekly phrase is negated (完全週休2日制ではない, does not offer two days off every week). */
const isNegated = (text: string, span: Span, words: AnnualHolidaysWords): boolean => {
  const after = text
    .slice(span.end, span.end + MARKER_REACH)
    .trimStart()
    .toLowerCase();
  return (
    wordsAt(words.negations, "after").some((word) => startsWithWord(after, word)) ||
    contains(sentenceBefore(text, span.start), wordsAt(words.negations, "before"))
  );
};

/** Every weekly phrase in the document, each with the fewest days off a year it gives and whether it can be read plainly. */
export const weeklyIn = (text: string, words: AnnualHolidaysWords): Weekly[] => {
  const minimums = new Map(words.weekly.map((entry): [string, number | undefined] => [entry.word.toLowerCase(), entry.minimum]));
  return occurrences(
    text,
    words.weekly.map((entry) => entry.word),
  ).map((span) => {
    const minimum = minimums.get(text.slice(span.start, span.end).toLowerCase());
    const excepted = contains(text.slice(span.end, lineEnd(text, span.end)), words.exceptions);
    return { ...span, minimum, clear: minimum !== undefined && !excepted && !isNegated(text, span, words) };
  });
};

/** The fewest days off a year every weekly phrase gives together; undefined when there is none or one is not plain. */
const minimumOf = (weekly: readonly Weekly[]): Weekly | undefined => {
  if (weekly.length === 0 || weekly.some((entry) => !entry.clear)) return undefined;
  return weekly.reduce((least, entry) => ((entry.minimum ?? 0) < (least.minimum ?? 0) ? entry : least));
};

/** The one count all the document's counts agree on; undefined when there is none, one is not plain, or two differ. */
const agreedCount = (counts: readonly DayCount[]): DayCount | undefined => {
  const [first] = counts;
  if (first === undefined) return undefined;
  return counts.every((count) => count.clear && count.days === first.days) ? first : undefined;
};

/** Every annual count of days off below the fewest the posting's weekly days off give. */
export const annualHolidaysMismatches = (text: string, words: AnnualHolidaysWords): StructureIssue[] => {
  const counts = annualCountsIn(text, words);
  const count = agreedCount(counts);
  const weekly = minimumOf(weeklyIn(text, words));
  if (count === undefined || weekly?.minimum === undefined || count.days >= weekly.minimum) return [];
  const values = { days: count.days, weekly: text.slice(weekly.start, weekly.end), minimum: weekly.minimum };
  return counts.map((each) => ({ offset: each.start, values: { ...values, written: text.slice(each.start, each.end) } }));
};
