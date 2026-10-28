import type { Detector, Finding, ProseDocument, Span } from "../plugin.ts";
import { dateGroups, dateMinority, datesIn, type DateMinority } from "../date-format.ts";
import { quoteAt } from "./structure-tree.ts";
import { referenceListSpans } from "../reference-lists.ts";
import { noteSentences } from "../note-paragraphs.ts";

/**
 * 一つの文書で、日付を二通り以上の書き方で書いた所（2026-10-02 と 2026年10月2日、Oct 2, 2026 と 10/2/2026）。少ないほうを指す。
 * 行の頭の日付（予定表の行）と文の中の日付は別に比べる。月の名前は語彙表 month-name、元号は calendar-era が言う。コードの中の日付は読まない。
 * 文献一覧（見出しは語彙表 reference-list-heading）と注の並びの中の日付は比べない。
 */
const findingsOf = (doc: ProseDocument, minority: DateMinority): Finding[] =>
  minority.odd.map((date) => ({
    rule: "",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, date.offset),
    values: { written: date.written, example: minority.majority.written, count: minority.count, total: minority.total, offset: date.offset },
  }));

/** 文献一覧と、番号の付いた注の並びの範囲。 */
const citedSpans = (doc: ProseDocument): Span[] => {
  const notes = noteSentences(doc.source, doc.paragraphs);
  return [
    ...referenceListSpans(
      doc.source,
      (doc.lexicons["reference-list-heading"] ?? []).map((entry) => entry.pattern),
    ),
    ...doc.paragraphs.filter((paragraph) => paragraph.sentences.some((sentence) => notes.has(sentence))).map((paragraph) => paragraph.span),
  ];
};

export const dateFormat: Detector = (doc, options): Finding[] => {
  const words = {
    months: (doc.lexicons["month-name"] ?? []).map((entry) => entry.pattern),
    eras: (doc.lexicons["calendar-era"] ?? []).map((entry) => entry.pattern),
  };
  const text = doc.prose ?? doc.source;
  const stampLabels = (doc.lexicons["date-stamp-label"] ?? []).map((entry) => entry.pattern);
  const places = { stampLabels, cited: citedSpans(doc), source: doc.source };
  return dateGroups(text, datesIn(text, words), places).flatMap((group) => {
    const minority = dateMinority(group, options.limit);
    return minority === undefined ? [] : findingsOf(doc, minority);
  });
};
