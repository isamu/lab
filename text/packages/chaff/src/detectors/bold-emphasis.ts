import type { Detector, Finding, ProseDocument, Sentence, Span } from "../plugin.ts";
import { isEmphasisBold } from "./bold-emphasis-form.ts";
import { proseText } from "../measure.ts";
import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";

const PER = 1000;
const TENTHS = 10;
/** Two bold spans are what a careful writer keeps for a deadline or a warning, and in a short text they alone pass any rate. */
const MIN_SPANS = 3;

/**
 * The bold spans of the prose that emphasise (Section.strongs already leaves out headings and tables). A bold opening its
 * line and block is a label, a field or a run-in heading (bold-label-list counts the list labels); a capitalised bold
 * mid-sentence is a name.
 */
const emphasisSpans = (doc: ProseDocument): Span[] =>
  doc.sections.flatMap((section) => section.strongs ?? []).filter((span) => isEmphasisBold(doc.source, span));

export const emphasisSpanCount = (doc: ProseDocument): number => emphasisSpans(doc).length;

const sentenceAt = (doc: ProseDocument, offset: number): Sentence | undefined => doc.sentences.find((sentence) => offset < sentence.span.end);

/** A rate over the whole document, not per section: the reader notices bold scattered through every part of it. */
export const boldEmphasis: Detector = (doc, options): Finding[] => {
  const length = wordsOf(doc);
  const spans = emphasisSpans(doc);
  const count = spans.length;
  if (count < MIN_SPANS || length < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const density = Math.round((count / length) * PER * TENTHS) / TENTHS;
  if (density <= options.limit) return [];
  const offset = spans[0]?.start ?? 0;
  const at = sentenceAt(doc, offset);
  return [
    {
      rule: "bold-emphasis",
      severity: "info",
      line: 0,
      column: 0,
      quote: at === undefined ? "" : proseText(at),
      values: { count, density, limit: options.limit, offset: at?.span.start ?? offset },
    },
  ];
};
