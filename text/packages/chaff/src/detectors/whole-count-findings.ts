import type { Finding, ProseDocument } from "../plugin.ts";
import { wholeCountConflicts, type CountWord, type CountWords, type MarkWord, type WholeCountConflict } from "../facts/whole-counts.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const countWordsAt = (doc: ProseDocument, id: string): CountWord[] =>
  (doc.lexicons[id] ?? []).map((entry): CountWord => ({ pattern: entry.pattern, group: entry.group ?? "" }));

const markWordsAt = (doc: ProseDocument, id: string): MarkWord[] =>
  (doc.lexicons[id] ?? []).map((entry): MarkWord => ({ pattern: entry.pattern, position: entry.position ?? "before" }));

const countWordsOf = (doc: ProseDocument): CountWords => ({
  columns: countWordsAt(doc, "fact-count-column"),
  counters: countWordsAt(doc, "fact-count-counter"),
  separateRows: patternsOf(doc, "fact-count-separate-rows"),
  wholeMarks: markWordsAt(doc, "fact-count-whole"),
  notWhole: markWordsAt(doc, "fact-count-not-whole"),
  restating: patternsOf(doc, "fact-count-restating"),
  totalLabels: (doc.lexicons["total-label"] ?? []).filter((entry) => entry.group !== "subtotal").map((entry) => entry.pattern),
  subtotalLabels: (doc.lexicons["total-label"] ?? []).filter((entry) => entry.group === "subtotal").map((entry) => entry.pattern),
});

const wholeCountFinding =
  (doc: ProseDocument) =>
  (conflict: WholeCountConflict): Finding => {
    const value = doc.source.slice(conflict.start, conflict.end);
    return {
      rule: "fact-conflict",
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, conflict.start),
      variant: conflict.table.sum ? "whole-count-sum" : "whole-count",
      values: {
        label: conflict.heading,
        value,
        other: `${String(conflict.table.count)}${value.slice(conflict.written.length)}`,
        offset: conflict.start,
      },
    };
  };

/** 文が全体として書いた数（合計4枚）と、表のその数を数える列の全体の数。 */
export const wholeCountFindings = (doc: ProseDocument): Finding[] => {
  const sentences = doc.sentences.map((sentence) => ({ ...sentence.span, text: doc.source.slice(sentence.span.start, sentence.span.end) }));
  return wholeCountConflicts(doc.source, sentences, countWordsOf(doc)).map(wholeCountFinding(doc));
};
