// due-before-issue: the reading half. The issue-date and due-date words come from the language's lexicons
// (issue-date-label, due-date-label); the dates are the structure tree's, and the lines are read with code masked.
import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import { dueBeforeIssue, type DueWords } from "../structure/due-date.ts";
import { proseAndTablesOf } from "../table-text.ts";
import { datedPoints, quoteAt } from "./structure-tree.ts";

const patternsOf = (doc: ProseDocument, lexicon: string): string[] => (doc.lexicons[lexicon] ?? []).map((entry) => entry.pattern);

const wordsOf = (doc: ProseDocument): DueWords => ({ issue: patternsOf(doc, "issue-date-label"), due: patternsOf(doc, "due-date-label") });

export const dueDate: Detector = (doc): Finding[] =>
  doc.structure === undefined
    ? []
    : dueBeforeIssue(proseAndTablesOf(doc), datedPoints(doc.structure), wordsOf(doc)).map((issue) => ({
        rule: "due-before-issue",
        severity: "error",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
      }));
