import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { isWordAt, wordOffsets, type Mark } from "../structure/time-marks.ts";
import { linesOf } from "../structure/lines.ts";

/**
 * Lengths of time in hours and minutes (8時間, 7時間30分, 90分, 1-hour, one-hour, 7.5 hours), the words written beside
 * them (実働8時間, 8 hours a day), and the stretches of text a statement of hours is read in. The words come from the
 * language packages; nothing here knows a language. Pure.
 */
export type TimeLength = Span & {
  readonly minutes: number;
  /** The smallest unit the length is written in, in minutes: 60 for 24時間, 1 for 90分 or 7時間30分, 30 for 7時間半. */
  readonly unit: number;
};

export type LengthWords = {
  readonly hourUnits: readonly string[];
  readonly minuteUnits: readonly string[];
  /** What written right after the hour unit adds half an hour (7時間半). */
  readonly halves: readonly string[];
  /** Numbers written as words, in order from one. */
  readonly numberWords: readonly string[];
};

const MINUTES_PER_HOUR = 60;
const HALF_HOUR = 30;

const alternation = (words: readonly string[]): string =>
  words
    .filter((word) => word !== "")
    .toSorted((left, right) => right.length - left.length)
    .map(escapeRegExp)
    .join("|");

const LATIN_END = /[a-z]$/iu;
const LATIN_START = /^[a-z]/iu;

const numberOf = (written: string, numberWords: readonly string[]): number => {
  const position = numberWords.findIndex((word) => word.toLowerCase() === written.toLowerCase());
  return position >= 0 ? position + 1 : Number(written.normalize("NFKC"));
};

/** A digit number not inside a longer one, or a number word standing as a word of its own. */
const numberPattern = (numberWords: readonly string[]): string => {
  const words = alternation(numberWords);
  const digits = "(?<![\\p{N}.,．/⁄])(?<digits>\\p{Nd}+(?:[.．]\\p{Nd}+)?)";
  return words === "" ? digits : `(?:${digits}|(?<![\\p{L}\\p{N}\\p{Pd}])(?<word>${words}))`;
};

const SEPARATOR = "[\\s\\-‐]?";

type Read = { readonly span: Span; readonly minutes: number; readonly unit: number };

/** A Latin unit runs on into a longer word ("8 hoursx") or a letter-led tail: not a length. */
const runsOn = (text: string, end: number): boolean => LATIN_END.test(text.slice(end - 1, end)) && LATIN_START.test(text.charAt(end));

const DECIMAL_BASE = 10;

/** 7.5 hours is written to a tenth of an hour, 6 minutes. */
const hourStep = (number: string | undefined): number => {
  const decimals = (number ?? "").normalize("NFKC").split(".")[1]?.length ?? 0;
  return MINUTES_PER_HOUR / DECIMAL_BASE ** decimals;
};

const smallestUnit = (number: string | undefined, minutes: string | undefined, half: string | undefined): number => {
  if (minutes !== undefined) return 1;
  return half === undefined ? hourStep(number) : Math.min(HALF_HOUR, hourStep(number));
};

const hourLengths = (text: string, words: LengthWords): Read[] => {
  const [hours, minutes, halves] = [alternation(words.hourUnits), alternation(words.minuteUnits), alternation(words.halves)];
  if (hours === "") return [];
  const minutePart = minutes === "" ? "" : `|\\s?(?<extra>\\p{Nd}{1,2})\\s?(?:${minutes})`;
  const halfPart = halves === "" ? "" : `|\\s?(?<half>${halves})`;
  const tail = minutePart === "" && halfPart === "" ? "" : `(?:${minutePart.slice(1)}${halfPart})?`;
  const pattern = new RegExp(`${numberPattern(words.numberWords)}${SEPARATOR}(?:${hours})${tail}`, "giu");
  return [...text.matchAll(pattern)].flatMap((match): Read[] => {
    const end = match.index + match[0].length;
    if (runsOn(text, end)) return [];
    const { digits, word, extra, half } = match.groups ?? {};
    const amount = numberOf(digits ?? word ?? "", words.numberWords);
    const extraMinutes = extra === undefined ? 0 : Number(extra.normalize("NFKC"));
    const halfMinutes = half === undefined ? 0 : HALF_HOUR;
    return [{ span: { start: match.index, end }, minutes: amount * MINUTES_PER_HOUR + extraMinutes + halfMinutes, unit: smallestUnit(digits, extra, half) }];
  });
};

const minuteLengths = (text: string, words: LengthWords): Read[] => {
  const minutes = alternation(words.minuteUnits);
  if (minutes === "") return [];
  const pattern = new RegExp(`${numberPattern(words.numberWords)}${SEPARATOR}(?:${minutes})`, "giu");
  return [...text.matchAll(pattern)].flatMap((match): Read[] => {
    const end = match.index + match[0].length;
    return runsOn(text, end)
      ? []
      : [{ span: { start: match.index, end }, minutes: numberOf(match.groups?.["digits"] ?? match.groups?.["word"] ?? "", words.numberWords), unit: 1 }];
  });
};

const overlaps = (left: Span, right: Span): boolean => left.start < right.end && right.start < left.end;

/** Lengths of time in hours and minutes, in the order written. A minutes-only reading inside an hours one is dropped. */
export const timeLengths = (text: string, words: LengthWords): TimeLength[] => {
  const hours = hourLengths(text, words);
  const minutes = minuteLengths(text, words).filter((read) => !hours.some((hour) => overlaps(hour.span, read.span)));
  return [...hours, ...minutes]
    .filter((read) => Number.isFinite(read.minutes) && read.minutes > 0)
    .map((read) => ({ ...read.span, minutes: read.minutes, unit: read.unit }))
    .toSorted((left, right) => left.start - right.start);
};

const longestFirst = (marks: readonly Mark[]): Mark[] => marks.toSorted((left, right) => right.pattern.length - left.pattern.length);

const LABEL_GAP_BEFORE = new Set([" ", "\t", "\u3000", ":", "："]);
const LABEL_GAP_AFTER = /^\s*/u;
const LOOK_AROUND = 40;

const lower = (text: string): string => text.toLowerCase();

/** Where the separators that may stand between a label and its length (休憩：1時間、Break: 1 hour) begin, reading back from at. */
const gapStart = (text: string, at: number): number => {
  let start = at;
  while (start > 0 && LABEL_GAP_BEFORE.has(text.charAt(start - 1))) start -= 1;
  return start;
};

/** Whether pattern is written as a word at offset at, case aside. Reads a window around it, not the whole text. */
const isLabelAt = (text: string, at: number, pattern: string): boolean => {
  if (at < 0) return false;
  const from = Math.max(0, at - 1);
  return isWordAt(lower(text.slice(from, at + pattern.length + 1)), at - from, lower(pattern));
};

/** The label written right before span (after separators only), or undefined. */
const labelBefore = (text: string, span: Span, marks: readonly Mark[]): Span | undefined => {
  const end = gapStart(text, span.start);
  if (span.start - end > LOOK_AROUND) return undefined;
  const found = longestFirst(marks.filter((mark) => (mark.position ?? "before") === "before")).find((mark) =>
    isLabelAt(text, end - mark.pattern.length, mark.pattern),
  );
  return found === undefined ? undefined : { start: end - found.pattern.length, end };
};

/** The label written right after span (after white space only), or undefined. */
const labelAfter = (text: string, span: Span, marks: readonly Mark[]): Span | undefined => {
  const start = span.end + (LABEL_GAP_AFTER.exec(text.slice(span.end, span.end + LOOK_AROUND))?.[0].length ?? 0);
  const found = longestFirst(marks.filter((mark) => mark.position === "after")).find((mark) => isLabelAt(text, start, mark.pattern));
  return found === undefined ? undefined : { start, end: start + found.pattern.length };
};

/** The label beside span, before or after it. */
export const labelOf = (text: string, span: Span, marks: readonly Mark[]): Span | undefined => labelBefore(text, span, marks) ?? labelAfter(text, span, marks);

/** Where the words of marks are written inside scope. */
export const mentionsIn = (text: string, scope: Span, marks: readonly Mark[]): Span[] => {
  const inside = lower(text.slice(scope.start, scope.end));
  return [...new Set(marks.map((mark) => lower(mark.pattern)))].flatMap((pattern) =>
    wordOffsets(inside, pattern).map((at) => ({ start: scope.start + at, end: scope.start + at + pattern.length })),
  );
};

export const within = (inner: Span, outer: Span): boolean => inner.start >= outer.start && inner.end <= outer.end;

const LIST_ITEM = /^\s*(?:[-*+・•]|\d{1,3}[.)])\s/u;

type Paragraph = { readonly span: Span; readonly lines: readonly Span[]; readonly listed: boolean };

type Run = { readonly lines: Span[]; listed: boolean };

/** Runs of non-blank lines. listed: every line of the run is a list item in the source. */
const paragraphsOf = (text: string, source: string): Paragraph[] => {
  const listedLines = linesOf(source).map((line) => LIST_ITEM.test(line.text));
  const runs: Run[] = [{ lines: [], listed: true }];
  linesOf(text).forEach((line, index) => {
    const run = runs[runs.length - 1];
    if (line.text.trim() === "") runs.push({ lines: [], listed: true });
    else if (run !== undefined) {
      run.lines.push({ start: line.start, end: line.start + line.text.length });
      run.listed = run.listed && listedLines[index] === true;
    }
  });
  return runs.flatMap(({ lines, listed }) => {
    const [first, last] = [lines[0], lines[lines.length - 1]];
    return first === undefined || last === undefined ? [] : [{ span: { start: first.start, end: last.end }, lines, listed }];
  });
};

const clipped = (inner: Span, outer: Span): Span => ({ start: Math.max(inner.start, outer.start), end: Math.min(inner.end, outer.end) });

/** A sentence that ends on a clock time ("5:30 p.m. (a one-hour break") runs on into the next. */
const joinedAtTimes = (sentences: readonly Span[], times: readonly Span[]): Span[] =>
  sentences.reduce<Span[]>((joined, sentence) => {
    const last = joined[joined.length - 1];
    if (last !== undefined && times.some((time) => time.start < last.end && last.end <= time.end)) {
      joined[joined.length - 1] = { start: last.start, end: sentence.end };
    } else joined.push(sentence);
    return joined;
  }, []);

/** The sentences of a line, clipped to it; the line itself when no sentence lies on it. */
const sentencesOn = (line: Span, sentences: readonly Span[]): Span[] => {
  const on = sentences.filter((sentence) => overlaps(sentence, line)).map((sentence) => clipped(sentence, line));
  return on.length === 0 ? [line] : on;
};

/**
 * The stretches a statement is read in: each sentence of a line, and a list whose items say it together (勤務時間 /
 * 休憩 / 実働 on three items). read returns undefined when a stretch does not hold exactly one statement; a list that
 * reads as one is not read again line by line.
 */
export const readScopes = <T>(
  text: string,
  source: string,
  split: { readonly sentences: readonly Span[]; readonly times: readonly Span[] },
  read: (scope: Span) => T | undefined,
): T[] => {
  const sentences = joinedAtTimes(split.sentences, split.times);
  return paragraphsOf(text, source).flatMap((paragraph) => {
    const whole = paragraph.listed && paragraph.lines.length > 1 ? read(paragraph.span) : undefined;
    if (whole !== undefined) return [whole];
    return paragraph.lines.flatMap((line) =>
      sentencesOn(line, sentences).flatMap((scope) => {
        const result = read(scope);
        return result === undefined ? [] : [result];
      }),
    );
  });
};
