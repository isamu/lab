import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { announcedCountMismatches, type CountMismatch, type CountWords } from "../announced-count.ts";
import { inlineCountMismatches, type MemberWords } from "../inline-count.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string, position?: "before" | "after"): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => position === undefined || entry.position === position).map((entry) => entry.pattern);

const countWordsOf = (doc: ProseDocument): CountWords => ({
  anchors: patternsOf(doc, "count-anchor"),
  numbers: patternsOf(doc, "count-number"),
  counters: patternsOf(doc, "count-counter"),
  frames: patternsOf(doc, "count-frame"),
  hedgesBefore: patternsOf(doc, "count-hedge", "before"),
  hedgesAfter: patternsOf(doc, "count-hedge", "after"),
});

const memberGroup = (doc: ProseDocument, group: string): string[] =>
  (doc.lexicons["count-member"] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

const memberWordsOf = (doc: ProseDocument): MemberWords => ({
  separators: memberGroup(doc, "separator"),
  joiners: memberGroup(doc, "joiner"),
  open: memberGroup(doc, "open"),
});

const findingOf = (doc: ProseDocument, mismatch: CountMismatch, variant?: string): Finding => ({
  rule: "announced-count-mismatch",
  severity: "warning",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, mismatch.offset),
  values: { phrase: mismatch.phrase, announced: mismatch.announced, listed: mismatch.listed, offset: mismatch.offset },
  ...(variant === undefined ? {} : { variant }),
});

/** 予告の数（以下の3点、出席者（6名））と、すぐ下の箇条書きか、後ろに一行で並べた名前の数が違う。 */
export const announcedCount: Detector = (doc): Finding[] => {
  const words = countWordsOf(doc);
  return [
    ...announcedCountMismatches(doc.source, doc.lists, words).map((mismatch) => findingOf(doc, mismatch)),
    ...inlineCountMismatches(doc.prose ?? doc.source, words, memberWordsOf(doc)).map((mismatch) => findingOf(doc, mismatch, "inline")),
  ];
};
