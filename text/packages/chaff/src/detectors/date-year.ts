// A date written without its year where the document's other dates carry one, or where the year cannot be read off
// because the document's dates cross the turn of a year. Pure; reads the date nodes of the structure tree.
import type { Detector, Finding, LexiconEntry, ProseDocument, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { quoteAt } from "./structure-tree.ts";

/** A date as the tree reads it: "2026-10-14" with its year, "10-14" without. */
export type DatePoint = { readonly offset: number; readonly end: number; readonly value: string };

export type YearGap = { readonly point: DatePoint; readonly kind: "minority" | "boundary"; readonly dated: number };

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
  return hasYearWord(point, source, yearWords) || anchors.some((other) => other.offset >= start && other.offset < point.offset);
};

/**
 * The yearless dates to report. Where most dates carry a year (at least two, and more than the yearless ones), every yearless
 * one is the odd one out. Otherwise writing the year once is the document's style, and only a date across the turn of a
 * year is reported. A date whose year the text gives in words or earlier on its line is never reported, nor counted.
 */
export const yearGaps = (points: readonly DatePoint[], source = "", yearWords: readonly YearWord[] = []): YearGap[] => {
  const dated = points.filter((point) => FULL.test(point.value));
  const anchors = [...dated, ...points.filter((point) => hasYearWord(point, source, yearWords))];
  const yearless = points.filter((point) => MONTH_DAY.test(point.value) && !yearGiven(point, anchors, source, yearWords));
  const minority = dated.length >= 2 && yearless.length < dated.length;
  const datedSides = new Set(dated.flatMap((point) => sideOf(monthOf(FULL, point.value)) ?? []));
  const previousOf = new Map(points.map((point, index) => [point, points[index - 1]]));
  return yearless.flatMap((point): YearGap[] => {
    if (minority) return [{ point, kind: "minority", dated: dated.length }];
    return crossesYear(point, previousOf.get(point), datedSides) ? [{ point, kind: "boundary", dated: dated.length }] : [];
  });
};

export const datePoints = (tree: StructureNode): DatePoint[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ offset: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : []));

const yearWordsOf = (doc: ProseDocument): YearWord[] =>
  (doc.lexicons[YEAR_REFERENCE_LEXICON] ?? []).map((entry: LexiconEntry) => ({ word: entry.pattern, position: entry.position }));

export const dateWithoutYear: Detector = (doc: ProseDocument): Finding[] =>
  doc.structure === undefined
    ? []
    : yearGaps(datePoints(doc.structure), doc.source, yearWordsOf(doc)).map((gap) => ({
        rule: "date-without-year",
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, gap.point.offset),
        ...(gap.kind === "boundary" ? { variant: "boundary" } : {}),
        values: { date: doc.source.slice(gap.point.offset, gap.point.end), count: gap.dated, offset: gap.point.offset },
      }));
