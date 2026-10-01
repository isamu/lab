import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { danglingReferences, duplicateDefinitions, inDocumentOrder, type StructureIssue } from "../structure/issues.ts";
import { numberingBreaks } from "../structure/numbering.ts";
import { weekdayMismatches } from "../structure/weekday.ts";
import { dateOrderBreaks } from "../structure/date-order.ts";
import { totalMismatches, type Amount } from "../structure/total.ts";
import { reversedRanges, type DatedSpan, type RangeWords } from "../structure/date-range.ts";
import { percentSumMismatches, type ShareWords } from "../structure/percent-sum.ts";

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
export const numberingGap: Detector = findingsOf("numbering-gap", numberingBreaks);
export const duplicateDefinition: Detector = findingsOf("duplicate-definition", duplicateDefinitions);

/** 曜日の名前は言語パッケージの語彙表（weekday、日曜日から順）から取る。無ければ番号のまま。 */
const dayName = (doc: ProseDocument, day: unknown): string => {
  const index = Number(day);
  return doc.lexicons["weekday"]?.[index]?.pattern ?? String(index);
};

export const dateWeekdayMismatch: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : weekdayMismatches(doc.structure).map((issue) => ({
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

/** 合計の行が、上の金額の和と合わない。合計の語は言語パッケージの語彙表（total-label）から取る。 */
export const totalMismatch: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : totalMismatches(
        doc.source,
        amountsOf(doc.structure),
        (doc.lexicons["total-label"] ?? []).map((entry) => entry.pattern),
      ).map((issue) => ({
        rule: "total-mismatch",
        severity: "error",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));

const datedSpans = (tree: NonNullable<ProseDocument["structure"]>): DatedSpan[] =>
  inDocumentOrder(tree).flatMap((node) => (node.kind === "date" ? [{ offset: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : []));

const rangeWordsOf = (doc: ProseDocument): RangeWords => ({
  connectors: (doc.lexicons["range-connector"] ?? []).map((entry) => entry.pattern),
  openers: (doc.lexicons["range-opener"] ?? []).map((entry) => entry.pattern),
  closers: (doc.lexicons["range-closer"] ?? []).map((entry) => entry.pattern),
});

/** 期間の終わりが始まりより前。範囲の記号と語は言語パッケージの語彙表（range-connector、range-opener、range-closer）から取る。 */
export const dateRangeReversed: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : reversedRanges(doc.source, datedSpans(doc.structure), rangeWordsOf(doc)).map((issue) => ({
        rule: "date-range-reversed",
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));

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
