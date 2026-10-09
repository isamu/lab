import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import type { Mark } from "../structure/time-marks.ts";
import { linesOf } from "../structure/lines.ts";

/**
 * Counts of uses in a period (1日3回, 3 times a day, twice in 24 hours) and the words that make a number a limit (まで,
 * no more than, 最大量). The words come from the language packages; nothing here knows a language. Pure.
 */
export type PeriodWord = Mark & { readonly hours: number };

/** A number written as a word, with its value (three, twice). alone: it counts uses without a counter (twice a day). */
export type CountWord = { readonly pattern: string; readonly value: number; readonly alone: boolean };

export type PeriodCountWords = {
  /** Periods: before the number (1日3回) or after the counter (3 times a day). */
  readonly periods: readonly PeriodWord[];
  /** What a count of uses is written in (回, times, doses). */
  readonly counters: readonly string[];
  readonly numberWords: readonly CountWord[];
};

export type PeriodCount = Span & { readonly amount: number; readonly hours: number };

const alternation = (words: readonly string[]): string =>
  [...new Set(words.filter((word) => word !== ""))]
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

/** A word that does not run on from a Latin letter or a digit before it, or into a Latin letter after it. */
const bounded = (pattern: string): string => `(?<![A-Za-z0-9])(?:${pattern})(?![A-Za-z])`;

const DIGITS = "(?<![\\p{N}.,．])\\p{Nd}+(?:[.．]\\p{Nd}+)?";

const numberAt = (written: string, words: readonly CountWord[]): number =>
  words.find((word) => word.pattern.toLowerCase() === written.toLowerCase())?.value ?? Number(written.normalize("NFKC"));

const periodsOn = (words: PeriodCountWords, side: "before" | "after"): PeriodWord[] => words.periods.filter((period) => (period.position ?? "before") === side);

const hoursOf = (words: PeriodCountWords, written: string): number =>
  words.periods.find((period) => period.pattern.toLowerCase() === written.toLowerCase())?.hours ?? 0;

/** The hours of the longest period word the match starts with. */
const periodHoursIn = (written: string, words: PeriodCountWords): number => {
  const found = periodsOn(words, "before")
    .toSorted((left, right) => right.pattern.length - left.pattern.length)
    .find((period) => written.toLowerCase().startsWith(period.pattern.toLowerCase()));
  return found?.hours ?? 0;
};

/** At most this many letters (の, に, あたり) between a period written first and its count: 1日に3回. */
const JOINER = "[^\\p{N}\\s。、，,.．！？!?]{0,4}";

/** 1日3回: the period first, then the number and the counter. */
const periodFirst = (text: string, words: PeriodCountWords): PeriodCount[] => {
  const [periods, counters] = [alternation(periodsOn(words, "before").map((word) => word.pattern)), alternation(words.counters)];
  if (periods === "" || counters === "") return [];
  const pattern = new RegExp(`${bounded(periods)}${JOINER}\\s?(?<digits>${DIGITS})\\s?(?:${counters})`, "giu");
  return [...text.matchAll(pattern)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    amount: Number((match.groups?.["digits"] ?? "").normalize("NFKC")),
    hours: periodHoursIn(match[0], words),
  }));
};

const namesOf = (words: readonly CountWord[], alone: boolean): string => alternation(words.filter((word) => word.alone === alone).map((word) => word.pattern));

/** 3 times a day, twice in 24 hours: the number and the counter first, then the period. */
const periodLast = (text: string, words: PeriodCountWords): PeriodCount[] => {
  const [periods, counters] = [alternation(periodsOn(words, "after").map((word) => word.pattern)), alternation(words.counters)];
  if (periods === "" || counters === "") return [];
  const [counted, alone] = [namesOf(words.numberWords, false), namesOf(words.numberWords, true)];
  const number = counted === "" ? `(?<digits>${DIGITS})` : `(?:(?<digits>${DIGITS})|(?<word>${bounded(counted)}))`;
  const once = alone === "" ? "" : `|(?<alone>${bounded(alone)})`;
  const pattern = new RegExp(`(?:${number}\\s?${bounded(counters)}${once})\\s+(?<period>${bounded(periods)})`, "giu");
  return [...text.matchAll(pattern)].map((match) => {
    const groups = match.groups ?? {};
    const written = groups["digits"] ?? groups["word"] ?? groups["alone"] ?? "";
    return {
      start: match.index,
      end: match.index + match[0].length,
      amount: numberAt(written, words.numberWords),
      hours: hoursOf(words, groups["period"] ?? ""),
    };
  });
};

const FULL_WIDTH_ZERO = 0xff10;
const ASCII_ZERO = 0x30;

/** Full-width digits as ASCII ones, one for one, so offsets stay (１日 reads as 1日). */
export const asciiDigits = (text: string): string =>
  text.replace(/[０-９]/gu, (digit) => String.fromCharCode(digit.charCodeAt(0) - FULL_WIDTH_ZERO + ASCII_ZERO));

/** Counts of uses in a period, in the order written. */
export const periodCounts = (written: string, words: PeriodCountWords): PeriodCount[] => {
  const text = asciiDigits(written);
  return [...periodFirst(text, words), ...periodLast(text, words)]
    .filter((count) => Number.isFinite(count.amount) && count.amount > 0 && count.hours > 0)
    .toSorted((left, right) => left.start - right.start);
};

/** The periods written in text, wherever they stand (the maximum daily dose, 1日の最大量). */
export const periodsIn = (written: string, words: PeriodCountWords): (Span & { readonly hours: number })[] => {
  const text = asciiDigits(written);
  const all = alternation(words.periods.map((word) => word.pattern));
  if (all === "") return [];
  return [...text.matchAll(new RegExp(bounded(all), "giu"))].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
    hours: hoursOf(words, match[0]),
  }));
};

const SENTENCE_END = /[。．！？!?\n]|\.(?=\s|$)/gu;

/** How far back the window of a number reaches at most, in characters. */
const WINDOW_REACH = 120;

/** The index of the last of values (ascending) at or before at, or -1. */
export const lastIndexAtOrBefore = (values: readonly number[], at: number): number => {
  let [low, high, found] = [0, values.length - 1, -1];
  while (low <= high) {
    const middle = (low + high) >> 1;
    if ((values[middle] ?? Infinity) <= at) [found, low] = [middle, middle + 1];
    else high = middle - 1;
  }
  return found;
};

/** Where the stretch a number is read in begins: after the sentence end, or the last of takenEnds (ascending), before at. */
export const windowStart = (text: string, at: number, takenEnds: readonly number[]): number => {
  const reach = Math.max(0, at - WINDOW_REACH);
  const ends = [...text.slice(reach, at).matchAll(SENTENCE_END)].map((match) => reach + match.index + match[0].length);
  return Math.max(reach, takenEnds[lastIndexAtOrBefore(takenEnds, at)] ?? 0, ...ends);
};

export type LimitWords = {
  /** Limit words; a word in group limit-negated ("more than") is one only with a negation before it ("do not take more than"). */
  readonly limits: readonly Mark[];
  readonly negations: readonly string[];
};

const NEGATED = "limit-negated";
const LIMIT_GAP_AFTER = /^[\s、,]*/u;
const LIMIT_REACH_AFTER = 24;

const containsWord = (text: string, word: string): boolean => new RegExp(bounded(escapeRegExp(word.toLowerCase())), "u").test(text);

/** A limit word in the window before span (no more than, 最大量は), or right after it (まで, を超えて). */
export const isLimited = (text: string, span: Span, from: number, words: LimitWords): boolean => {
  const before = text.slice(from, span.start).toLowerCase();
  const after = text.slice(span.end, span.end + LIMIT_REACH_AFTER).toLowerCase();
  const gap = LIMIT_GAP_AFTER.exec(after)?.[0].length ?? 0;
  const negated = words.negations.some((word) => containsWord(before, word));
  return words.limits.some((limit) =>
    (limit.position ?? "before") === "before"
      ? containsWord(before, limit.pattern) && (limit.group !== NEGATED || negated)
      : after.startsWith(limit.pattern.toLowerCase(), gap),
  );
};

const TABLE_ROW = /^\s*\|/u;

const isProse = (line: { readonly text: string } | undefined): boolean => line !== undefined && line.text.trim() !== "" && !TABLE_ROW.test(line.text);

/** Runs of non-blank lines that are not table rows: the paragraphs a statement of use is read in. */
export const paragraphsOf = (text: string): Span[] =>
  linesOf(text).reduce<Span[]>((runs, line, index, lines) => {
    if (!isProse(line)) return runs;
    const end = line.start + line.text.length;
    const last = runs.at(-1);
    if (isProse(lines[index - 1]) && last !== undefined) runs[runs.length - 1] = { start: last.start, end };
    else runs.push({ start: line.start, end });
    return runs;
  }, []);
