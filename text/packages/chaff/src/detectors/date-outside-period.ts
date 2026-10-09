import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { datesOutsidePeriod, type OutsideWords } from "../structure/date-outside-period.ts";
import { rangeFrameOf } from "../structure/date-range.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** 期間の語、期間の外に置く語、文書の仕事の期間の語、締め切りの語、期間の後に来てよい仕事の語、概要の節の見出しの語、範囲の記号（range-connector、range-opener、range-frame の間の語）、月と曜日の名は語彙表から取る。 */
const wordsOf = (doc: ProseDocument): OutsideWords => ({
  labels: patternsOf(doc, "period-label"),
  terms: patternsOf(doc, "period-term-label"),
  asides: patternsOf(doc, "period-aside"),
  deadlines: patternsOf(doc, "period-deadline"),
  overviews: patternsOf(doc, "period-overview-heading"),
  afterTerm: patternsOf(doc, "period-after-term"),
  connectors: [
    ...patternsOf(doc, "range-connector"),
    ...patternsOf(doc, "range-opener"),
    ...patternsOf(doc, "range-frame").flatMap((pattern) => rangeFrameOf(pattern)?.joint ?? []),
  ],
  months: patternsOf(doc, "month-name"),
  weekdays: patternsOf(doc, "weekday"),
});

/** 書いた期間（旅行期間：…）の外の日付を持つ、その後ろの日程の項目、表の行、見出し。 */
export const dateOutsidePeriod: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const dates = inDocumentOrder(doc.structure).flatMap((node) =>
    node.kind === "date" ? [{ offset: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : [],
  );
  const headings = doc.markup?.headings ?? [];
  const sentences = doc.sentences.map((sentence) => sentence.span);
  return datesOutsidePeriod(doc.source, dates, headings, sentences, wordsOf(doc)).map((issue) => ({
    rule: "date-outside-period",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
