import type { Span } from "../plugin.ts";
import { labelOf, timeLengths, type LengthWords, type TimeLength } from "../derived/time-lengths.ts";
import { isWordAt, type Mark } from "./time-marks.ts";
import { linesOf } from "./lines.ts";

/**
 * A stated total time (所要時間：80分, Total time: 1 hr 20 min) against the sum of the times written in the numbered steps
 * ((10分), bake for 40 minutes). The words come from the language packages; nothing here knows a language. Pure.
 */
export type StepTimeWords = {
  readonly lengths: LengthWords;
  /** Labels of a total time (所要時間, Total time), written before the length. */
  readonly totals: readonly Mark[];
  /** Marks of a rough figure (約, about, 程度): the total or a step that carries one is compared with a margin. */
  readonly approximate: readonly Mark[];
  /** Marks of a time that is not how long the step takes (10分後, every 5 minutes, after 10 minutes). */
  readonly notOwn: readonly Mark[];
  /** What joins the two ends of a range (10〜15分, 10 to 15 minutes): a step or total with a range is not read. */
  readonly rangeJoiners: readonly string[];
};

/** A length of time with whether it was written as a rough figure. */
export type ReadTime = Span & { readonly minutes: number; readonly approximate: boolean };

export type StepTimeSlip = {
  readonly total: ReadTime;
  readonly sum: number;
  readonly steps: number;
  /** How far the sum may be from the total and still agree, in minutes: 0 unless a rough figure is involved. */
  readonly margin: number;
};

/** A rough total agrees with a sum within this share of the total, and never less than ROUGH_MINUTES. */
export const ROUGH_SHARE = 0.1;
export const ROUGH_MINUTES = 5;
const MIN_STEPS = 2;

/** 1. or 1) with a space after it (so 1.5 hours is no step); the full-width 1．or 1）may run straight on. */
const STEP_ITEM = /^\s*\p{Nd}{1,3}(?:[.)]\s|[．）])/u;
const INDENTED = /^\s+\S/u;

type ListRead = { readonly lists: Span[][]; readonly open: boolean; readonly lastLine: number };

/** One line's place in the numbered lists: a new item, a line under the last item, a blank, or the end of the list. */
const readLine = (read: ListRead, line: { readonly text: string; readonly start: number; readonly number: number }): ListRead => {
  const end = line.start + line.text.length;
  const list = read.lists[read.lists.length - 1];
  const last = list?.[list.length - 1];
  if (STEP_ITEM.test(line.text)) {
    if (read.open && list !== undefined) list.push({ start: line.start, end });
    else read.lists.push([{ start: line.start, end }]);
    return { lists: read.lists, open: true, lastLine: line.number };
  }
  if (line.text.trim() === "") return read;
  if (read.open && list !== undefined && last !== undefined && INDENTED.test(line.text)) {
    if (read.lastLine === line.number - 1) list[list.length - 1] = { start: last.start, end };
    return { ...read, lastLine: line.number };
  }
  return { ...read, open: false };
};

/** The numbered lists of the source, each a run of items with only blank or indented lines between them. An item holds its line and the indented lines right under it. */
export const stepLists = (source: string): Span[][] => linesOf(source).reduce<ListRead>(readLine, { lists: [], open: false, lastLine: 0 }).lists;

/** Every numbered step of the source. */
export const stepItems = (source: string): Span[] => stepLists(source).flat();

const lower = (text: string): string => text.toLowerCase();

const sideOf = (marks: readonly Mark[], side: "before" | "after"): string[] =>
  marks
    .filter((mark) => (mark.position ?? "before") === side)
    .map((mark) => lower(mark.pattern))
    .filter((pattern) => pattern !== "")
    .toSorted((left, right) => right.length - left.length);

/** The mark written right before at (white space between only), and where it starts. */
const markEndingAt = (text: string, at: number, patterns: readonly string[]): number | undefined => {
  const head = lower(text.slice(0, at)).trimEnd();
  const found = patterns.find((pattern) => isWordAt(head, head.length - pattern.length, pattern));
  return found === undefined ? undefined : head.length - found.length;
};

/** Whether a mark is written right after at (white space between only). */
const markStartingAt = (text: string, at: number, patterns: readonly string[]): boolean => {
  const tail = lower(text.slice(at));
  const gap = tail.length - tail.trimStart().length;
  return patterns.some((pattern) => isWordAt(tail, gap, pattern));
};

const DIGIT_BEFORE = /\p{Nd}\s*$/u;

/** Whether the length is the second end of a range: a joiner right before it, after a number, a number word or a unit (10〜15分, one to two hours, 10 minutes to 15 minutes). */
const endsRange = (text: string, at: number, words: StepTimeWords): boolean => {
  const start = markEndingAt(text, at, words.rangeJoiners.map(lower));
  if (start === undefined) return false;
  const { numberWords, hourUnits, minuteUnits } = words.lengths;
  const ends = [...numberWords, ...hourUnits, ...minuteUnits].map(lower).filter((word) => word !== "");
  return DIGIT_BEFORE.test(text.slice(0, start)) || markEndingAt(text, start, ends) !== undefined;
};

type Reading = { readonly time: ReadTime; readonly from: number; readonly own: boolean; readonly range: boolean };

/** Each length in text, with where its rough-figure mark starts, whether it is the step's own time, and whether it ends a range. */
const readingsOf = (text: string, words: StepTimeWords): Reading[] =>
  timeLengths(text, words.lengths).map((length: TimeLength): Reading => {
    const roughBefore = markEndingAt(text, length.start, sideOf(words.approximate, "before"));
    const roughAfter = markStartingAt(text, length.end, sideOf(words.approximate, "after"));
    const from = roughBefore ?? length.start;
    const notOwn =
      markEndingAt(text, from, sideOf(words.notOwn, "before")) !== undefined ||
      (!roughAfter && markStartingAt(text, length.end, sideOf(words.notOwn, "after")));
    return {
      time: { start: length.start, end: length.end, minutes: length.minutes, approximate: roughBefore !== undefined || roughAfter },
      from,
      own: !notOwn,
      range: endsRange(text, length.start, words),
    };
  });

/** How long one step takes: its one own length of time. undefined when it has none, more than one, or a range. */
export const stepTime = (text: string, words: StepTimeWords): ReadTime | undefined => {
  const readings = readingsOf(text, words);
  if (readings.some((reading) => reading.range)) return undefined;
  const own = readings.filter((reading) => reading.own);
  return own.length === 1 ? own[0]?.time : undefined;
};

const outside = (offset: number, items: readonly Span[]): boolean => !items.some((item) => offset >= item.start && offset < item.end);

/** The totals written on one line. A line with a range (Total time: 10 to 15 minutes) states no exact total. */
const totalsOn = (line: { readonly text: string; readonly start: number }, words: StepTimeWords): ReadTime[] => {
  const readings = readingsOf(line.text, words);
  if (readings.some((reading) => reading.range)) return [];
  return readings.flatMap((reading): ReadTime[] => {
    const label = labelOf(line.text, { start: reading.from, end: reading.time.end }, words.totals);
    if (label === undefined || !reading.own) return [];
    return [{ ...reading.time, start: line.start + reading.time.start, end: line.start + reading.time.end }];
  });
};

/** The total time the source states outside its steps: a length with a total label right before it. Only one value is read. */
export const statedTotal = (source: string, items: readonly Span[], words: StepTimeWords): ReadTime | undefined => {
  const totals = linesOf(source)
    .filter((line) => outside(line.start, items))
    .flatMap((line) => totalsOn(line, words));
  const values = new Set(totals.map((total) => total.minutes));
  return values.size === 1 ? totals[0] : undefined;
};

/** The margin a rough figure allows: ROUGH_SHARE of the total, at least ROUGH_MINUTES. */
export const marginOf = (total: number, rough: boolean): number => (rough ? Math.max(ROUGH_MINUTES, total * ROUGH_SHARE) : 0);

/**
 * The stated total against the sum of the steps' times, when the document has one numbered list, every step's time is readable,
 * and they do not agree. Two lists may be two procedures, or one of them no procedure, so a document with two is not read.
 */
export const stepTimeSlip = (source: string, words: StepTimeWords): StepTimeSlip | undefined => {
  const lists = stepLists(source);
  const [items] = lists;
  if (lists.length !== 1 || items === undefined || items.length < MIN_STEPS) return undefined;
  const total = statedTotal(source, items, words);
  if (total === undefined) return undefined;
  const times = items.map((item) => stepTime(source.slice(item.start, item.end), words));
  if (times.some((time) => time === undefined)) return undefined;
  const sum = times.reduce((minutes, time) => minutes + (time?.minutes ?? 0), 0);
  const margin = marginOf(total.minutes, total.approximate || times.some((time) => time?.approximate === true));
  return Math.abs(sum - total.minutes) <= margin ? undefined : { total, sum, steps: items.length, margin };
};
