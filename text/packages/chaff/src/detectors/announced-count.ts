import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { announcedCountMismatches, type CountWords } from "../announced-count.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string, position?: "before" | "after"): string[] =>
  (doc.lexicons[id] ?? []).filter((entry) => position === undefined || entry.position === position).map((entry) => entry.pattern);

const countWordsOf = (doc: ProseDocument): CountWords => ({
  anchors: patternsOf(doc, "count-anchor"),
  numbers: patternsOf(doc, "count-number"),
  counters: patternsOf(doc, "count-counter"),
  hedgesBefore: patternsOf(doc, "count-hedge", "before"),
  hedgesAfter: patternsOf(doc, "count-hedge", "after"),
});

/** 予告の数（以下の3点）と、すぐ下の箇条書きの項目の数が違う。 */
export const announcedCount: Detector = (doc): Finding[] =>
  announcedCountMismatches(doc.source, doc.lists, countWordsOf(doc)).map((mismatch) => ({
    rule: "announced-count-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, mismatch.offset),
    values: { phrase: mismatch.phrase, announced: mismatch.announced, listed: mismatch.listed, offset: mismatch.offset },
  }));
