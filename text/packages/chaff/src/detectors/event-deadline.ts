// deadline-after-event: the reading half. The event-date, registration, deadline and follow-up words come from the language's
// lexicons (event-date-label, event-registration-word, event-deadline-word, event-aside); the dates are the structure tree's,
// and the lines are read with code masked.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { deadlinesAfterEvent, type EventDeadlineWords } from "../structure/deadline-after-event.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { datedPoints, quoteAt } from "./structure-tree.ts";
import { readableDates, withReadableDates } from "./readable-dates.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): EventDeadlineWords => ({
  events: patternsOf(doc, "event-date-label"),
  registrations: patternsOf(doc, "event-registration-word"),
  deadlines: patternsOf(doc, "event-deadline-word"),
  asides: patternsOf(doc, "event-aside"),
});

export const eventDeadline: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const sentences = doc.sentences.map((sentence) => sentence.span);
  return deadlinesAfterEvent(proseAndTablesOf(doc), datedPoints(doc.structure), sentences, wordsOf(doc)).map((issue) => ({
    rule: "deadline-after-event",
    severity: "error",
    line: 0,
    column: 0,
    quote: quoteAt(doc.source, issue.offset),
    values: { ...withReadableDates(issue.values, ["deadline", "event"], readableDates(doc)), offset: issue.offset },
  }));
};
