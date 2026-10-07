// prerequisite-after-step: a sentence opening with a prerequisite (Before you begin, 作業を始める前に) after the numbered
// steps of its own section (prerequisite-order.ts).
import { quoteAt } from "./structure-tree.ts";
import { latePrerequisites } from "../prerequisite-order.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const ORDERED_ITEM = /^\s*\d{1,3}[.)]\s/u;
/** A numbered list needs this many steps to be a procedure. */
const MIN_STEPS = 3;

const QUOTED_LINE = /^[ \t]*>/u;

/** Whether a list stands in a block quote: a quoted procedure is someone else's, not the document's steps. */
const isQuoted = (source: string, start: number): boolean => QUOTED_LINE.test(source.slice(source.lastIndexOf("\n", start - 1) + 1, start + 1));

const proceduresOf = (doc: ProseDocument): { start: number; end: number }[] =>
  doc.lists
    .filter((list) => list.itemSpans.length >= MIN_STEPS && ORDERED_ITEM.test(doc.source.slice(list.span.start, list.span.end)))
    .filter((list) => !isQuoted(doc.source, list.span.start))
    .map((list) => ({ start: list.span.start, end: list.span.end }));

export const prerequisiteOrder: Detector = (doc): Finding[] => {
  const openers = (doc.lexicons["prerequisite-opener"] ?? []).map((entry) => entry.pattern);
  if (openers.length === 0) return [];
  const sections = doc.sections.map((section) => ({ start: section.span.start, end: section.span.end }));
  const sentences = doc.sentences.map((sentence) => ({ start: sentence.span.start, end: sentence.span.end, text: sentence.text }));
  return latePrerequisites(sections, proceduresOf(doc), sentences, openers).map((sentence) => ({
    rule: "prerequisite-after-step",
    severity: "info",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, sentence.start),
    values: { offset: sentence.start },
  }));
};
