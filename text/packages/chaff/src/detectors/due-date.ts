// due-before-issue: the reading half. The issue-date and due-date words come from the language's lexicons
// (issue-date-label, due-date-label, deadline-passed-word), and so do the words of minutes (minutes-title-word, meeting-date-label,
// action-section-heading, earlier-section-word, action-due-label, item-done-word); the dates are the structure tree's, and the
// lines are read with code masked.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { actionDueBeforeMeeting, type ActionWords } from "../structure/action-due.ts";
import { dueBeforeIssue, type DueWords } from "../structure/due-date.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { datedPoints, quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): DueWords => ({
  issue: patternsOf(doc, "issue-date-label"),
  due: patternsOf(doc, "due-date-label"),
  passed: patternsOf(doc, "deadline-passed-word"),
});

const actionWordsOf = (doc: ProseDocument): ActionWords => ({
  meeting: patternsOf(doc, "meeting-date-label"),
  section: patternsOf(doc, "action-section-heading"),
  earlier: patternsOf(doc, "earlier-section-word"),
  due: patternsOf(doc, "action-due-label"),
  done: patternsOf(doc, "item-done-word"),
  minutes: patternsOf(doc, "minutes-title-word"),
});

const findingOf = (doc: ProseDocument, issue: StructureIssue, variant?: string): Finding => ({
  rule: "due-before-issue",
  severity: "error",
  line: 0,
  column: 0,
  quote: quoteAt(doc.source, issue.offset),
  values: { ...issue.values, offset: issue.offset },
  ...(variant === undefined ? {} : { variant }),
});

export const dueDate: Detector = (doc): Finding[] => {
  if (doc.structure === undefined) return [];
  const text = proseAndTablesOf(doc);
  const dates = datedPoints(doc.structure);
  return [
    ...dueBeforeIssue(text, dates, wordsOf(doc)).map((issue) => findingOf(doc, issue)),
    ...actionDueBeforeMeeting(text, dates, doc.markup?.headings ?? [], actionWordsOf(doc)).map((issue) => findingOf(doc, issue, "meeting")),
  ];
};
