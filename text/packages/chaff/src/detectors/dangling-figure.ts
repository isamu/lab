import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { danglingFigures, type LabelWords } from "../figure-references.ts";
import { quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** The language's words for figures, tables and appendices, and for a number that points elsewhere or counts. */
export const labelWordsOf = (doc: ProseDocument): LabelWords => ({
  labels: (doc.lexicons["figure-label"] ?? []).map((entry) => ({ word: entry.pattern, kind: entry.instead_of ?? entry.pattern })),
  elsewhere: patternsOf(doc, "figure-elsewhere"),
  counters: patternsOf(doc, "count-counter"),
});

/** 本文が指す図・表・付録の番号が、キャプションにも見出しにも無い。 */
export const danglingFigure: Detector = (doc): Finding[] =>
  danglingFigures(doc.source, doc.prose ?? doc.source, labelWordsOf(doc), doc.links).map((dangling) => ({
    rule: "dangling-figure-reference",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, dangling.offset),
    values: { label: dangling.label, offset: dangling.offset },
  }));
