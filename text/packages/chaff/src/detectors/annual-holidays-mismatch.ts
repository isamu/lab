// annual-holidays-mismatch: annual days off fewer than the weekly days off give over a year (structure/annual-holidays.ts).
// The labels are annual-holidays-label, the weekly phrases weekly-days-off, the other words annual-holidays-word,
// approximate-marker, range-connector and amount-range-word.
import type { Detector, Finding, Lexicon, ProseDocument } from "../plugin.ts";
import { annualHolidaysMismatches, type AnnualHolidaysWords, type PositionedWord } from "../structure/annual-holidays.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { quoteAround } from "./quote-around.ts";

const entriesOf = (doc: ProseDocument, lexicon: string, group?: string): Lexicon =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => group === undefined || entry.group === group);

const patternsOf = (doc: ProseDocument, lexicon: string, group?: string): string[] => entriesOf(doc, lexicon, group).map((entry) => entry.pattern);

const positionedOf = (doc: ProseDocument, lexicon: string, group?: string): PositionedWord[] =>
  entriesOf(doc, lexicon, group).map((entry) => ({ word: entry.pattern, position: entry.position === "after" ? "after" : "before" }));

const weeklyOf = (doc: ProseDocument): AnnualHolidaysWords["weekly"] =>
  entriesOf(doc, "weekly-days-off").map((entry) => ({ word: entry.pattern, minimum: entry.group === "every-week" ? entry.weight : undefined }));

const wordsOf = (doc: ProseDocument): AnnualHolidaysWords => ({
  labels: positionedOf(doc, "annual-holidays-label"),
  days: patternsOf(doc, "annual-holidays-word", "day"),
  links: patternsOf(doc, "annual-holidays-word", "link"),
  weekly: weeklyOf(doc),
  negations: positionedOf(doc, "annual-holidays-word", "negation"),
  exceptions: patternsOf(doc, "annual-holidays-word", "exception"),
  markers: [...positionedOf(doc, "approximate-marker"), ...positionedOf(doc, "annual-holidays-word", "open")],
  connectors: [...patternsOf(doc, "range-connector"), ...patternsOf(doc, "amount-range-word")],
});

export const annualHolidaysMismatch: Detector = (doc): Finding[] => {
  const text = proseAndTablesOf(doc);
  return annualHolidaysMismatches(text, wordsOf(doc)).map((issue) => ({
    rule: "annual-holidays-mismatch",
    severity: "warning",
    line: 0,
    column: 0,
    quote: quoteAround(text, issue.offset),
    values: { ...issue.values, offset: issue.offset },
  }));
};
