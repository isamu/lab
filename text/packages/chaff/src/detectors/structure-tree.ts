import type { Detector, Finding, ProseDocument, StructureNode } from "../plugin.ts";
import { danglingReferences, duplicateDefinitions, inDocumentOrder, type StructureIssue } from "../structure/issues.ts";
import { numberingBreaks } from "../structure/numbering.ts";
import { listNumberBreaks, writtenNumbers } from "../structure/list-numbering.ts";
import { weekdayMismatches } from "../structure/weekday.ts";
import { documentDateOf } from "./document-date.ts";
import { dateOrderBreaks } from "../structure/date-order.ts";
import { totalMismatches, type Amount } from "../structure/total.ts";
import { proseTotalMismatches } from "../structure/prose-total.ts";
import { rangeFrameOf, reversedRanges, type DatedSpan, type RangeWords } from "../structure/date-range.ts";
import { percentSumMismatches, type ShareWords } from "../structure/percent-sum.ts";
import { isQuotedAlone } from "../quoted-span.ts";

const QUOTE_LENGTH = 80;

/** 指摘の位置から行末までを引用する。条の見出しや参照を含む一行が、読み手の探す手がかりになる。 */
export const quoteAt = (source: string, offset: number): string => {
  const end = source.indexOf("\n", offset);
  return source
    .slice(offset, end === -1 ? source.length : end)
    .slice(0, QUOTE_LENGTH)
    .trim();
};

const findingsOf =
  (rule: string, issuesOf: (tree: NonNullable<ProseDocument["structure"]>, source: string) => StructureIssue[]): Detector =>
  (doc): Finding[] =>
    doc.structure === undefined
      ? []
      : issuesOf(doc.structure, doc.source).map((issue) => ({
          rule,
          severity: "error",
          line: 0,
          column: 0,
          quote: quoteAt(doc.source, issue.offset),
          values: { ...issue.values, offset: issue.offset },
        }));

export const danglingReference: Detector = findingsOf("dangling-reference", danglingReferences);
const structureNumberingGap: Detector = findingsOf("numbering-gap", numberingBreaks);

const lineStartAt = (source: string, offset: number): number => source.lastIndexOf("\n", offset - 1) + 1;

/** The written numbers of the document's Markdown ordered lists that skip or repeat (structure/list-numbering.ts). */
const QUOTED_LINE = /^[ \t]*>/u;

/** 引用の中の箇条書きは、ほかの文書の例で、この文書の番号ではない。 */
const isQuotedList = (source: string, start: number): boolean => QUOTED_LINE.test(source.slice(lineStartAt(source, start), start));

const listNumberingGaps = (doc: ProseDocument): Finding[] =>
  doc.lists
    .filter((list) => !isQuotedList(doc.source, list.span.start))
    .flatMap((list) => listNumberBreaks(writtenNumbers(doc.source, list.itemSpans) ?? []))
    .map((issue) => ({
      rule: "numbering-gap",
      severity: "error",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
    }));

/**
 * 番号の抜けと重なり: 番地の木の並び（条、項、号）と、Markdown の番号付きの箇条書きに書いた番号。条の中の「1.」「2.」は
 * 両方に読まれるので、木が指した行の箇条書きは重ねて言わない。
 */
export const numberingGap: Detector = (doc, options): Finding[] => {
  const fromTree = structureNumberingGap(doc, options);
  const reported = new Set(fromTree.map((finding) => lineStartAt(doc.source, Number(finding.values["offset"]))));
  const fromLists = listNumberingGaps(doc).filter((finding) => !reported.has(lineStartAt(doc.source, Number(finding.values["offset"]))));
  return [...fromTree, ...fromLists].toSorted((left, right) => Number(left.values["offset"]) - Number(right.values["offset"]));
};
export const duplicateDefinition: Detector = findingsOf("duplicate-definition", duplicateDefinitions);

/** 曜日の名前は言語パッケージの語彙表（weekday、日曜日から順）から取る。無ければ番号のまま。 */
const dayName = (doc: ProseDocument, day: unknown): string => {
  const index = Number(day);
  return doc.lexicons["weekday"]?.[index]?.pattern ?? String(index);
};

const datedSpans = (tree: NonNullable<ProseDocument["structure"]>): DatedSpan[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ offset: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : []));

/** 引用符の中で日付の横にあってよい語は、曜日の一語だけ（"Monday, December 5, 2026"、「2026年12月5日（月）」）。 */
const WEEKDAY_WORDS = 1;

/**
 * 引用符で日付だけを挙げたもの（"Monday, December 5, 2026" falls on a Saturday）は、誤りの例で、文書の日付ではない。
 * from から until の日付の終わりまでを見る。
 */
const quotedDates = (doc: ProseDocument, from: DatedSpan | undefined, until: DatedSpan | undefined, wordsBesides = 0): boolean =>
  from !== undefined && until !== undefined && isQuotedAlone(doc.source, { start: from.offset, end: until.end }, wordsBesides);

const dateAt = (dates: readonly DatedSpan[], offset: number): number => dates.findIndex((date) => date.offset === offset);

/** A year written as figures in a heading: 2024年度, FY2024, "2024 events". */
const YEAR_FIGURES = /(?<![0-9０-９])(?:1[89]|20)\d{2}(?![0-9０-９])/u;
const ERA_YEAR_NUMBER = /^[ \t]?(?:[0-9０-９]{1,2}|元)/u;

/** 見出しが年を名指すか: 数字の年（2024年度、FY2024）か、暦の元号の年（語彙表 calendar-era、令和6年度）。 */
const namesYear = (heading: string, eras: readonly string[]): boolean =>
  YEAR_FIGURES.test(heading) ||
  eras.some((era) => {
    const at = heading.indexOf(era);
    return at !== -1 && ERA_YEAR_NUMBER.test(heading.slice(at + era.length));
  });

export const dateWeekdayMismatch: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const dates = datedSpans(doc.structure);
  const sections = doc.sections.filter((section) => section.depth > 0);
  const eras = (doc.lexicons["calendar-era"] ?? []).map((entry) => entry.pattern);
  const context = {
    stamp: documentDateOf(doc, doc.structure),
    sectionStarts: sections.map((section) => section.span.start),
    yearHeadings: sections.filter((section) => namesYear(section.heading, eras)).map((section) => section.span.start),
    anchorable: (node: StructureNode): boolean => {
      const date = dates[dateAt(dates, node.span.start)];
      return !quotedDates(doc, date, date, WEEKDAY_WORDS);
    },
  };
  return weekdayMismatches(doc.structure, context)
    .filter((issue) => {
      const date = dates[dateAt(dates, issue.offset)];
      return !quotedDates(doc, date, date, WEEKDAY_WORDS);
    })
    .map((issue) => ({
      rule: "date-weekday-mismatch",
      severity: "error",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: {
        date: String(issue.values["date"]),
        written: dayName(doc, issue.values["written"]),
        actual: dayName(doc, issue.values["actual"]),
        offset: issue.offset,
      },
    }));
};

/** 木の日付を、原文の位置と一緒に並べる。 */
const datedPoints = (tree: NonNullable<ProseDocument["structure"]>): { offset: number; value: string }[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ offset: node.span.start, value: String(node.attrs["value"]) }] : []));

/** 日程の並びに逆らう日付。並びの読み方は原文の行を見るので、木と原文の両方を渡す。 */
export const dateOrder: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : dateOrderBreaks(doc.source, datedPoints(doc.structure)).map((issue) => ({
        rule: "date-order",
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));

/** 木の数量を、原文の位置と一緒に並べる。 */
const amountsOf = (tree: NonNullable<ProseDocument["structure"]>): Amount[] =>
  inDocumentOrder(tree).flatMap((node) =>
    node.kind === "quantity" ? [{ offset: node.span.start, end: node.span.end, value: Number(node.attrs["value"]), unit: String(node.attrs["unit"]) }] : [],
  );

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** 合計の行と内訳の行、文の中の合計と内訳。同じ金額は一度だけ言う。 */
const totalIssues = (doc: ProseDocument, tree: NonNullable<ProseDocument["structure"]>): StructureIssue[] => {
  const amounts = amountsOf(tree);
  const lines = totalMismatches(doc.source, amounts, patternsOf(doc, "total-label"));
  const words = {
    totals: patternsOf(doc, "total-phrase"),
    breakdowns: patternsOf(doc, "breakdown-phrase"),
    discounts: patternsOf(doc, "discount-word"),
    joiners: patternsOf(doc, "breakdown-gap-joiner"),
  };
  const prose = proseTotalMismatches(
    doc.source,
    doc.sentences.map((sentence) => sentence.span),
    amounts,
    words,
  );
  return [...lines, ...prose.filter((issue) => !lines.some((line) => line.offset === issue.offset))];
};

/**
 * 合計が内訳の和と合わない。表と箇条書きの合計の行（合計の語は total-label）と、文の中の合計（total-phrase、breakdown-phrase）。
 * 語は言語パッケージの語彙表から取る。
 */
export const totalMismatch: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : totalIssues(doc, doc.structure).map((issue) => ({
        rule: "total-mismatch",
        severity: "error",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));

const rangeWordsOf = (doc: ProseDocument): RangeWords => ({
  connectors: (doc.lexicons["range-connector"] ?? []).map((entry) => entry.pattern),
  openers: (doc.lexicons["range-opener"] ?? []).map((entry) => entry.pattern),
  closers: (doc.lexicons["range-closer"] ?? []).map((entry) => entry.pattern),
  frames: (doc.lexicons["range-frame"] ?? []).flatMap((entry) => rangeFrameOf(entry.pattern) ?? []),
  changes: (doc.lexicons["date-change-word"] ?? []).map((entry) => entry.pattern),
  weekdays: (doc.lexicons["weekday"] ?? []).map((entry) => entry.pattern),
});

/** 期間の終わりが始まりより前。範囲の記号と語は言語パッケージの語彙表（range-connector、range-opener、range-closer）から取る。 */
export const dateRangeReversed: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const dates = datedSpans(doc.structure);
  return reversedRanges(doc.source, dates, rangeWordsOf(doc))
    .filter((issue) => {
      const start = dateAt(dates, issue.offset);
      return !quotedDates(doc, dates[start], dates[start + 1]);
    })
    .map((issue) => ({
      rule: "date-range-reversed",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
    }));
};

const shareWordsOf = (doc: ProseDocument): ShareWords => ({
  labels: (doc.lexicons["share-label"] ?? []).map((entry) => entry.pattern),
  exceptions: (doc.lexicons["share-exception"] ?? []).map((entry) => entry.pattern),
  units: (doc.lexicons["percent-unit"] ?? []).map((entry) => entry.pattern),
  totalLabels: (doc.lexicons["total-label"] ?? []).map((entry) => entry.pattern),
});

/** 構成比や内訳の百分率の和が 100% にならない。割合の語と百分率の単位は言語パッケージの語彙表から取る。 */
export const percentSumMismatch: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : percentSumMismatches(doc.source, amountsOf(doc.structure), shareWordsOf(doc)).map((issue) => ({
        rule: "percent-sum-mismatch",
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));
