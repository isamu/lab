import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { periodLabelConflicts, type ReportingWords } from "../structure/period-label-conflict.ts";
import { compileFrames } from "../structure/period-labels.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

/** 期間の名前の書き方と種類（group）、業績の語、期間の行の語、比べる相手と見込みの語、今の期間の語とそれに似た別の語は語彙表から取る。 */
const wordsOf = (doc: ProseDocument): ReportingWords => ({
  frames: compileFrames(
    (doc.lexicons["reporting-period-frame"] ?? []).flatMap((entry) =>
      entry.group === undefined ? [] : [{ pattern: entry.pattern, kind: entry.group, insteadOf: entry.instead_of }],
    ),
  ),
  results: patternsOf(doc, "reporting-results-word"),
  periodLines: patternsOf(doc, "reporting-period-line"),
  comparisons: patternsOf(doc, "reporting-comparison"),
  forecasts: patternsOf(doc, "reporting-forecast"),
  currents: patternsOf(doc, "reporting-current"),
  notCurrents: patternsOf(doc, "reporting-current-not"),
});

/** 題で言った決算の期間と同じ種類の別の期間を、今の業績を言う所に書いた所。 */
export const periodLabelConflict: Detector = (doc): Finding[] => {
  const headings = (doc.markup?.headings ?? []).map((heading) => ({ start: heading.start, end: heading.end, text: heading.text }));
  const sentences = doc.sentences.map((sentence) => sentence.span);
  return periodLabelConflicts(doc.source, sentences, headings, wordsOf(doc)).map((issue) => ({
    rule: "period-label-conflict",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { label: issue.label, stated: issue.stated, offset: issue.offset },
  }));
};
