// A date written without its year where the reader cannot tell which year it is: the document's dated dates span more
// than one year, or its dates cross the turn of a year. Pure; reads the date nodes of the structure tree.
import type { Detector, DetectorOptions, Finding, LexiconEntry, ProseDocument, StructureNode } from "../plugin.ts";
import { isIn } from "../lexicon-genres.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { quoteAt } from "./structure-tree.ts";
import {
  ANY_YEAR_MARKER_LEXICON,
  MARKER_REACHES,
  YEAR_SPAN_JOINER_LEXICON,
  anyYearDate,
  opensSpan,
  type AnyYearMarker,
  type MarkerReach,
} from "./date-any-year.ts";
import { datesUnderYearHeadings, yearLabelOf, type HeadingYearWords } from "./date-heading-year.ts";
import { openingDateOf } from "./opening-date.ts";
import { withNearestYear } from "../structure/weekday.ts";

/**
 * The words that make a yearless date any year's (毎年, 例えば, "each"), that join a period's two ends (から, "to"), and
 * that join the names of one list (及び, "and"), for a marker named in one list with the date.
 */
export type AnyYearWords = { readonly markers: readonly AnyYearMarker[]; readonly joiners: readonly string[]; readonly listJoiners?: readonly string[] };

const NO_ANY_YEAR_WORDS: AnyYearWords = { markers: [], joiners: [] };

/**
 * A date as the tree reads it: "2026-10-14" with its year, "10-14" without. `yearHeaded`: the heading of its section
 * names a year ("FY27-Q2 (May 1)", 「2026年度の予定」), which the date takes. `nearStamp`: the document's own date (minutes
 * dated "January 17, 2024") lies within a few months of it in one year only, which the date takes.
 */
export type DatePoint = {
  readonly offset: number;
  readonly end: number;
  readonly value: string;
  readonly yearHeaded?: boolean;
  readonly nearStamp?: boolean;
};

/** The first and the last year of the document's dated dates. */
export type YearSpan = { readonly from: number; readonly to: number };

export type YearGap = { readonly point: DatePoint; readonly kind: "years" | "boundary"; readonly span: YearSpan | undefined };

/**
 * The words beside a date that give its year in words (その年の, 同年, 毎年; "of each year"): the date has a year, or means
 * every year. An entry stands before the date unless it says `position: after`.
 */
export const YEAR_REFERENCE_LEXICON = "year-reference";

/** A year word as the lexicon gives it. `before`: the word ends within the reach before the date ("annually, by"). */
export type YearWord = { readonly word: string; readonly position?: "before" | "after" | undefined };

const FULL = /^\d{4}-(\d{2})-\d{2}$/u;
const MONTH_DAY = /^(\d{2})-\d{2}$/u;
/** The month of any date with one: 2026-12-01, 2026-12 or 12-01. */
const ANY_MONTH = /^(?:\d{4}-(\d{2})(?:-\d{2})?|(\d{2})-\d{2})$/u;

/** How far before a date a year word may stand (「同年12月」「その年の12月」). */
const YEAR_WORD_REACH = 6;

/** The months at the end and the start of a year: a date in one, written beside a dated one in the other, could be either year. */
const YEAR_END = new Set([11, 12]);
const YEAR_START = new Set([1, 2]);

const yearOf = (value: string): number => Number(value.slice(0, 4));

const spanOf = (dated: readonly DatePoint[]): YearSpan | undefined => {
  if (dated.length === 0) return undefined;
  const years = dated.map((point) => yearOf(point.value));
  return { from: Math.min(...years), to: Math.max(...years) };
};

const monthOf = (pattern: RegExp, value: string): number | undefined => {
  const month = pattern.exec(value)?.[1];
  return month === undefined ? undefined : Number(month);
};

const sideOf = (month: number | undefined): "end" | "start" | undefined => {
  if (month === undefined) return undefined;
  if (YEAR_END.has(month)) return "end";
  return YEAR_START.has(month) ? "start" : undefined;
};

const anyMonthOf = (value: string): number | undefined => {
  const found = ANY_MONTH.exec(value);
  const month = found?.[1] ?? found?.[2];
  return month === undefined ? undefined : Number(month);
};

const opposite = (side: "end" | "start"): "end" | "start" => (side === "end" ? "start" : "end");

/**
 * A yearless date where the dates turn over the year: it sits at one turn, the date just before it at the other
 * (12月10日 then 1月15日), and a dated one sits at that other turn too (2026年12月1日). A 2月15日 far from any 12月 is a
 * day of the year, not a crossing.
 */
const crossesYear = (point: DatePoint, previous: DatePoint | undefined, datedSides: ReadonlySet<string>): boolean => {
  const side = sideOf(monthOf(MONTH_DAY, point.value));
  if (side === undefined || !datedSides.has(opposite(side))) return false;
  return previous !== undefined && sideOf(anyMonthOf(previous.value)) === opposite(side);
};

const lineStart = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const lineEnd = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

/**
 * A word without a position is found anywhere in the reach before the date (「同年12月」). One that says `before` may end
 * there and start further back ("annually, by June 30"); one that says `after` starts within the reach after the date
 * ("June 30 of each year").
 */
const hasYearWord = (point: DatePoint, source: string, yearWords: readonly YearWord[]): boolean => {
  const start = lineStart(source, point.offset);
  const near = source.slice(Math.max(start, point.offset - YEAR_WORD_REACH), point.offset);
  return yearWords.some(({ word, position }) => {
    if (word === "") return false;
    if (position === "after") return source.slice(point.end, Math.min(lineEnd(source, point.end), point.end + YEAR_WORD_REACH + word.length)).includes(word);
    if (position === "before") return source.slice(Math.max(start, point.offset - YEAR_WORD_REACH - word.length), point.offset).includes(word);
    return near.includes(word);
  });
};

/**
 * A yearless date whose year the text gives anyway: a year word just before it (「同年12月28日」「その年の12月31日」), or,
 * earlier on the same line, a date with a year or with a year word (「2026年9月25日から10月7日まで」「その年の1月1日から12月31日まで」).
 */
const yearGiven = (point: DatePoint, anchors: readonly DatePoint[], source: string, yearWords: readonly YearWord[]): boolean => {
  const start = lineStart(source, point.offset);
  const placed = point.yearHeaded === true || point.nearStamp === true;
  return placed || hasYearWord(point, source, yearWords) || anchors.some((other) => other.offset >= start && other.offset < point.offset);
};

const DAY_MS = 24 * 60 * 60 * 1000;
const COMMON_YEAR_MS = 365 * DAY_MS;
/** A year with no 29 February, so that "03-01" follows "02-28" as it does in most years. */
const COMMON_YEAR = 2025;

const dayOf = (value: string): number => Date.UTC(COMMON_YEAR, Number(value.slice(0, 2)) - 1, Number(value.slice(3, 5)));

/**
 * A period of one whole year: its end is the day before its start (January 1 to December 31, 4月1日から3月31日). Without
 * a year it is every year's, like a calendar or a fiscal year.
 */
export const wholeYear = (start: string, end: string): boolean =>
  MONTH_DAY.test(start) && MONTH_DAY.test(end) && (dayOf(end) + DAY_MS - dayOf(start)) % COMMON_YEAR_MS === 0;

/**
 * The yearless dates whose year the reader cannot tell. Where most dates carry a year (at least two, and more than the
 * yearless ones) and those years differ, every yearless one is reported: in a one-year document the year is plain. Where
 * the year is written once and the rest are month and day, that is the document's style, and only a date across the turn
 * of a year is reported. A date whose year the text gives in words or earlier on its line is never reported, nor counted.
 */
export const yearGaps = (
  points: readonly DatePoint[],
  source = "",
  yearWords: readonly YearWord[] = [],
  anyYear: AnyYearWords = NO_ANY_YEAR_WORDS,
): YearGap[] => {
  const dated = points.filter((point) => FULL.test(point.value));
  const anchors = [...dated, ...points.filter((point) => hasYearWord(point, source, yearWords))];
  const nextOf = new Map(points.map((point, index) => [point, points[index + 1]]));
  const previousOf = new Map(points.map((point, index) => [point, points[index - 1]]));
  const yearlySpan = (start: DatePoint | undefined, end: DatePoint | undefined): boolean =>
    start !== undefined && end !== undefined && wholeYear(start.value, end.value) && opensSpan(start, end, source, anyYear.joiners);
  const markedAnyYear = (point: DatePoint | undefined): boolean => point !== undefined && anyYearDate(point, source, anyYear.markers, anyYear.listJoiners);
  const yearOfAny = (point: DatePoint): boolean => {
    const next = nextOf.get(point);
    const previous = previousOf.get(point);
    if (markedAnyYear(point)) return true;
    if (yearlySpan(point, next) || yearlySpan(previous, point)) return true;
    // The end of a period whose start is any year's is too: 「祝休日及び12月29日から1月3日まで」.
    if (previous !== undefined && opensSpan(previous, point, source, anyYear.joiners) && markedAnyYear(previous)) return true;
    return next !== undefined && opensSpan(point, next, source, anyYear.joiners) && hasYearWord(next, source, yearWords);
  };
  // A recurring day or an example's date has no year to write, and is not the document's way of writing dates either.
  const yearless = points.filter((point) => MONTH_DAY.test(point.value) && !yearGiven(point, anchors, source, yearWords) && !yearOfAny(point));
  const span = spanOf(dated);
  const unclear = dated.length >= 2 && yearless.length < dated.length && span !== undefined && span.to > span.from;
  const datedSides = new Set(dated.flatMap((point) => sideOf(monthOf(FULL, point.value)) ?? []));
  return yearless.flatMap((point): YearGap[] => {
    if (unclear) return [{ point, kind: "years", span }];
    return crossesYear(point, previousOf.get(point), datedSides) ? [{ point, kind: "boundary", span }] : [];
  });
};

const NO_HEADING_YEAR_WORDS: HeadingYearWords = { eras: [], labels: [] };

/** A yearless date that the document's own date ("2024-01-17") places in one year: within a few months of it. */
const nearStampOf = (value: string, stamp: string | undefined): boolean => stamp !== undefined && withNearestYear(value, stamp) !== undefined;

export const datePoints = (tree: StructureNode, headingWords: HeadingYearWords = NO_HEADING_YEAR_WORDS, stamp?: string): DatePoint[] => {
  const yearHeaded = new Set(datesUnderYearHeadings(tree, headingWords));
  return inDocumentOrder(tree).flatMap((node) => {
    if (node.kind !== "date") return [];
    const value = String(node.attrs["value"]);
    return [{ offset: node.span.start, end: node.span.end, value, yearHeaded: yearHeaded.has(node.span.start), nearStamp: nearStampOf(value, stamp) }];
  });
};

/**
 * The document's own date: a date alone, or labelled, on a line of its title block. A date-only paragraph further down
 * (an agenda's "April 4, 2023") is a date the text talks about, not the document's.
 */
const stampOf = (doc: ProseDocument, tree: StructureNode): string | undefined => {
  const dates = inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ ...node.span, value: String(node.attrs["value"]) }] : []));
  const labels = (doc.lexicons["date-stamp-label"] ?? []).map((entry: LexiconEntry) => entry.pattern);
  return openingDateOf(doc.source, dates, labels);
};

/**
 * The genres whose date at the top is the occasion the text is about (minutes, a letter), from the rule's dated_genres.
 * A web page's date at the top says when it was posted, and its days and months may be any year's.
 */
const datedByOccasion = (options: DetectorOptions): boolean => {
  const genres = options.settings?.["dated_genres"];
  const genre = options.genre;
  return genre !== undefined && Array.isArray(genres) && genres.some((target: string) => isIn(genre, target));
};

const pointsOf = (doc: ProseDocument, tree: StructureNode, options: DetectorOptions): DatePoint[] =>
  datePoints(tree, headingYearWordsOf(doc), datedByOccasion(options) ? stampOf(doc, tree) : undefined);

const yearWordsOf = (doc: ProseDocument): YearWord[] =>
  (doc.lexicons[YEAR_REFERENCE_LEXICON] ?? []).map((entry: LexiconEntry) => ({ word: entry.pattern, position: entry.position }));

/** The era names (calendar-era) and the fiscal-year names ("FY{y}" of reporting-period-frame) a heading may give a year with. */
const headingYearWordsOf = (doc: ProseDocument): HeadingYearWords => ({
  eras: (doc.lexicons["calendar-era"] ?? []).map((entry: LexiconEntry) => entry.pattern),
  labels: (doc.lexicons["reporting-period-frame"] ?? []).flatMap((entry: LexiconEntry) =>
    entry.group === "fiscal-year" ? (yearLabelOf(entry.pattern) ?? []) : [],
  ),
});

/** The words that join the names of one list (及び, "and"): a `listed` marker stands before the date with these between. */
const LIST_JOINER_LEXICON = "enumeration-joiner";

const reachOf = (group: string | undefined): MarkerReach => MARKER_REACHES.find((reach) => reach === group) ?? "sentence";

const anyYearWordsOf = (doc: ProseDocument): AnyYearWords => ({
  markers: (doc.lexicons[ANY_YEAR_MARKER_LEXICON] ?? []).map((entry: LexiconEntry) => ({ word: entry.pattern, reach: reachOf(entry.group) })),
  joiners: (doc.lexicons[YEAR_SPAN_JOINER_LEXICON] ?? []).map((entry: LexiconEntry) => entry.pattern),
  listJoiners: (doc.lexicons[LIST_JOINER_LEXICON] ?? []).map((entry: LexiconEntry) => entry.pattern),
});

export const dateWithoutYear: Detector = (doc: ProseDocument, options: DetectorOptions): Finding[] =>
  doc.structure === undefined
    ? []
    : yearGaps(pointsOf(doc, doc.structure, options), doc.source, yearWordsOf(doc), anyYearWordsOf(doc)).map((gap) => ({
        rule: "date-without-year",
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, gap.point.offset),
        ...(gap.kind === "boundary" ? { variant: "boundary" } : {}),
        values: {
          date: doc.source.slice(gap.point.offset, gap.point.end),
          ...(gap.span === undefined ? {} : { from: gap.span.from, to: gap.span.to }),
          offset: gap.point.offset,
        },
      }));
