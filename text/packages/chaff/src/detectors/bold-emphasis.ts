import type { Detector, Finding, ProseDocument, Sentence } from "../plugin.ts";
import { isQuotedAt, opensWithBoldLabel } from "./bold-label.ts";
import { proseText } from "../measure.ts";
import { wordsOf } from "./structure.ts";
import { MIN_DOCUMENT_LENGTH } from "./signals.ts";

const PER = 1000;
const TENTHS = 10;
/** Two bold spans are what a careful writer keeps for a deadline or a warning, and in a short text they alone pass any rate. */
const MIN_SPANS = 3;

const BOLD_OPENING = /(?:\*\*|__)(?=\S)/u;

/** The list items that open with a bold label (code-only labels too): bold-label-list's to count, not emphasis. */
const labelItemCount = (doc: ProseDocument): number =>
  doc.lists
    .flatMap((list) => list.itemSpans)
    .filter((span) => !isQuotedAt(doc.source, span.start) && opensWithBoldLabel(doc.source.slice(span.start, span.end))).length;

/** The bold spans of the prose (Section.strongCount already leaves out headings and tables), less one per labelled item. */
export const emphasisSpanCount = (doc: ProseDocument): number =>
  Math.max(0, doc.sections.reduce((sum, section) => sum + section.strongCount, 0) - labelItemCount(doc));

const firstBoldSentence = (doc: ProseDocument): Sentence | undefined =>
  doc.sentences.find((sentence) => BOLD_OPENING.test(doc.source.slice(sentence.span.start, sentence.span.end)));

/** A rate over the whole document, not per section: the reader notices bold scattered through every part of it. */
export const boldEmphasis: Detector = (doc, options): Finding[] => {
  const length = wordsOf(doc);
  const count = emphasisSpanCount(doc);
  if (count < MIN_SPANS || length < MIN_DOCUMENT_LENGTH[doc.lengthUnit]) return [];
  const density = Math.round((count / length) * PER * TENTHS) / TENTHS;
  if (density <= options.limit) return [];
  const at = firstBoldSentence(doc);
  return [
    {
      rule: "bold-emphasis",
      severity: "info",
      line: 0,
      column: 0,
      quote: at === undefined ? "" : proseText(at),
      values: { count, density, limit: options.limit, offset: at?.span.start ?? 0 },
    },
  ];
};
