// A stated capacity smaller than a stated number registered, invited or attending (count-over-capacity). The words come
// from the language package: capacity-label, headcount-label, headcount-unit and capacity-exception.
import { countsOverCapacity, type CapacityWords, type CountMark } from "../structure/capacity-count.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const marksOf = (doc: ProseDocument, lexicon: string): CountMark[] =>
  (doc.lexicons[lexicon] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position, group: entry.group }));

const exceptionsOf = (doc: ProseDocument, group: string): string[] =>
  (doc.lexicons["capacity-exception"] ?? []).filter((entry) => entry.group === group).map((entry) => entry.pattern);

const capacityWords = (doc: ProseDocument): CapacityWords => ({
  capacities: marksOf(doc, "capacity-label"),
  counts: marksOf(doc, "headcount-label"),
  units: marksOf(doc, "headcount-unit"),
  overflows: exceptionsOf(doc, "overflow"),
  perSession: exceptionsOf(doc, "per-session"),
  otherOccasions: exceptionsOf(doc, "other-occasion"),
  negations: exceptionsOf(doc, "negation"),
});

/** The prose with its tables put back, so code is not read; offsets are the source's. */
export const countOverCapacity: Detector = (doc): Finding[] =>
  countsOverCapacity(
    proseAndTablesOf(doc),
    capacityWords(doc),
    doc.sections.map((section) => section.span),
  ).map((issue) => ({
    rule: "count-over-capacity",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
