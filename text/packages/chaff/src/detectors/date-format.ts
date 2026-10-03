import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { dateGroups, dateMinority, datesIn, type DateMinority } from "../date-format.ts";
import { quoteAt } from "./structure-tree.ts";

/**
 * 一つの文書で、日付を二通り以上の書き方で書いた所（2026-10-02 と 2026年10月2日、Oct 2, 2026 と 10/2/2026）。少ないほうを指す。
 * 行の頭の日付（予定表の行）と文の中の日付は別に比べる。月の名前は語彙表 month-name、元号は calendar-era が言う。コードの中の日付は読まない。
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

export const dateFormat: Detector = (doc, options): Finding[] => {
  const words = {
    months: (doc.lexicons["month-name"] ?? []).map((entry) => entry.pattern),
    eras: (doc.lexicons["calendar-era"] ?? []).map((entry) => entry.pattern),
  };
  const text = doc.prose ?? doc.source;
  return dateGroups(text, datesIn(text, words)).flatMap((group) => {
    const minority = dateMinority(group, options.limit);
    return minority === undefined ? [] : findingsOf(doc, minority);
  });
};
