// A walking time that does not match the stated distance at the document's walking speed (walk-time-distance-mismatch).
// The words and the default speed come from the language package: walk-word, walk-rate, unit-length, unit-time and
// unit-equivalent-hedge.
import { walkTimeMismatches, type WalkMark, type WalkWords } from "../structure/walk-time.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAt } from "./structure-tree.ts";
import type { Detector, Finding, ProseDocument } from "../plugin.ts";

const marksOf = (doc: ProseDocument, lexicon: string, group?: string): WalkMark[] =>
  (doc.lexicons[lexicon] ?? [])
    .filter((entry) => group === undefined || entry.group === group)
    .map((entry) => ({ pattern: entry.pattern, position: entry.position, weight: entry.weight }));

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] => marksOf(doc, lexicon, group).map((mark) => mark.pattern);

const walkWords = (doc: ProseDocument): WalkWords => ({
  walks: marksOf(doc, "walk-word", "walk"),
  gaps: patternsOf(doc, "walk-word", "gap"),
  bounds: marksOf(doc, "walk-word", "bound"),
  ranges: patternsOf(doc, "walk-word", "range"),
  fillers: patternsOf(doc, "walk-word", "filler"),
  lengths: marksOf(doc, "unit-length"),
  times: marksOf(doc, "unit-time"),
  hedges: patternsOf(doc, "unit-equivalent-hedge"),
  perTimes: marksOf(doc, "walk-rate", "per"),
  roundUps: patternsOf(doc, "walk-rate", "round-up"),
  notRoundUps: patternsOf(doc, "walk-rate", "not-round-up"),
  defaultRate: marksOf(doc, "walk-rate", "default")[0]?.weight,
});

/** The prose with its tables put back, so code is not read; offsets are the source's. */
export const walkTimeDistanceMismatch: Detector = (doc): Finding[] =>
  walkTimeMismatches(proseAndTablesOf(doc), walkWords(doc)).map((issue) => ({
    rule: "walk-time-distance-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
