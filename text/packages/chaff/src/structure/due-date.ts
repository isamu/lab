import { datesOutOfOrder } from "./labelled-date-order.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * A due date before the issue date. A line (or a list item, or a table's first column) starting with an issue-date word
 * (発行日, Issued) and one starting with a due-date word (お支払期限, Payment due), each with a full date on it: a due date
 * earlier than the first issue date, and written near it (the header block of an invoice or a quote), is reported. A due
 * line that says its deadline has passed (期限切れ, overdue) reports on a deadline rather than setting one. Pure.
 */
export type DueWords = { readonly issue: readonly string[]; readonly due: readonly string[]; readonly passed: readonly string[] };

/** A date of the structure tree: where it starts and its value (2026-11-25). */
export type DatedPoint = { readonly offset: number; readonly value: string };

/** How many lines from the issue date a due date may be and still be read as the same document's deadline. */
const MAX_LINE_GAP = 8;

export const dueBeforeIssue = (source: string, dates: readonly DatedPoint[], words: DueWords): StructureIssue[] =>
  datesOutOfOrder(source, dates, { earlier: words.issue, later: words.due, passed: words.passed, maxLineGap: MAX_LINE_GAP }).map(({ earlier, later }) => ({
    offset: later.date.offset,
    values: { due: later.date.value, issued: earlier.date.value },
  }));
