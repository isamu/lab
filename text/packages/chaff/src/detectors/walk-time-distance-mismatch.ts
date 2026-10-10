// A walking time that does not match the stated distance at the document's walking speed (walk-time-distance-mismatch).
// The words come from the language package (walk-word, walk-rate, unit-length, unit-time, unit-equivalent-hedge); the speed
// used when the document states none comes from its profile (profiles/listing.yaml).
import { walkTimeMismatches, type WalkMark, type WalkRate, type WalkWords } from "../structure/walk-time.ts";
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
});

/** The speed the document's profile walks at when the document states none (a real-estate listing: 80 m a minute, rounded up). */
const profileRate = (doc: ProseDocument): WalkRate | undefined => {
  const rate = doc.profile?.walkRate;
  return rate === undefined ? undefined : { metresPerMinute: rate.metresPerMinute, rounding: rate.roundUp ? "up" : "any" };
};

/** The prose with its tables put back, so code is not read; offsets are the source's. */
export const walkTimeDistanceMismatch: Detector = (doc): Finding[] =>
  walkTimeMismatches(proseAndTablesOf(doc), walkWords(doc), profileRate(doc)).map((issue) => ({
    rule: "walk-time-distance-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
