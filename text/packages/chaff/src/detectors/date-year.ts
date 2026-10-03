// A date written without its year where the document's other dates carry one, or where the year cannot be read off
// because the document's dates cross the turn of a year. Pure; reads the date nodes of the structure tree.
import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { quoteAt } from "./structure-tree.ts";

/** A date as the tree reads it: "2026-10-14" with its year, "10-14" without. */
export type DatePoint = { readonly offset: number; readonly end: number; readonly value: string };

export type YearGap = { readonly point: DatePoint; readonly kind: "minority" | "boundary"; readonly dated: number };

/** The words just before a date that give its year in words (その年の, 同年, 毎年): the date has a year, or means every year. */
export const YEAR_REFERENCE_LEXICON = "year-reference";

const FULL = /^\d{4}-(\d{2})-\d{2}$/u;
const MONTH_DAY = /^(\d{2})-\d{2}$/u;

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

/** A yearless date at one turn of the year while a dated one sits at the other: 1月15日 beside 2026年12月1日. */
const crossesYear = (point: DatePoint, datedSides: ReadonlySet<string>): boolean => {
  const side = sideOf(monthOf(MONTH_DAY, point.value));
  return side !== undefined && datedSides.has(side === "end" ? "start" : "end");
};

const lineStart = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

const hasYearWord = (point: DatePoint, source: string, yearWords: readonly string[]): boolean => {
  const before = source.slice(Math.max(lineStart(source, point.offset), point.offset - YEAR_WORD_REACH), point.offset);
  return yearWords.some((word) => word !== "" && before.includes(word));
};

/**
 * A yearless date whose year the text gives anyway: a year word just before it (「同年12月28日」「その年の12月31日」), or,
 * earlier on the same line, a date with a year or with a year word (「2026年9月25日から10月7日まで」「その年の1月1日から12月31日まで」).
 */
const yearGiven = (point: DatePoint, anchors: readonly DatePoint[], source: string, yearWords: readonly string[]): boolean => {
  const start = lineStart(source, point.offset);
  return hasYearWord(point, source, yearWords) || anchors.some((other) => other.offset >= start && other.offset < point.offset);
};

/**
 * The yearless dates to report. Where most dates carry a year (at least two, and more than the yearless ones), every yearless
 * one is the odd one out. Otherwise writing the year once is the document's style, and only a date across the turn of a
 * year is reported. A date whose year the text gives in words or earlier on its line is never reported, nor counted.
 */
export const yearGaps = (points: readonly DatePoint[], source = "", yearWords: readonly string[] = []): YearGap[] => {
  const dated = points.filter((point) => FULL.test(point.value));
  const anchors = [...dated, ...points.filter((point) => hasYearWord(point, source, yearWords))];
  const yearless = points.filter((point) => MONTH_DAY.test(point.value) && !yearGiven(point, anchors, source, yearWords));
  const minority = dated.length >= 2 && yearless.length < dated.length;
  const datedSides = new Set(dated.flatMap((point) => sideOf(monthOf(FULL, point.value)) ?? []));
  return yearless.flatMap((point): YearGap[] => {
    if (minority) return [{ point, kind: "minority", dated: dated.length }];
    return crossesYear(point, datedSides) ? [{ point, kind: "boundary", dated: dated.length }] : [];
  });
};

export const datePoints = (tree: StructureNode): DatePoint[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ offset: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : []));

const yearWordsOf = (doc: ProseDocument): string[] => (doc.lexicons[YEAR_REFERENCE_LEXICON] ?? []).map((entry) => entry.pattern);

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
