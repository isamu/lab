import type { StructureIssue } from "./issues.ts";
import { linesOf } from "./lines.ts";
import { isTotalLabel } from "./total.ts";

/**
 * A due date before the issue date. A line (or a list item, or a table's first column) starting with an issue-date word
 * (発行日, Issued) and one starting with a due-date word (お支払期限, Payment due), each with a full date on it: a due date
 * earlier than the first issue date is reported. Pure.
 */
export type DueWords = { readonly issue: readonly string[]; readonly due: readonly string[] };

/** A date of the structure tree: where it starts and its value (2026-11-25). */
export type DatedPoint = { readonly offset: number; readonly value: string };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

type Labelled = { readonly kind: "issue" | "due"; readonly date: DatedPoint };

const kindOf = (text: string, words: DueWords): Labelled["kind"] | undefined => {
  if (isTotalLabel(text, words.issue)) return "issue";
  return isTotalLabel(text, words.due) ? "due" : undefined;
};

const labelledDates = (source: string, dates: readonly DatedPoint[], words: DueWords): Labelled[] =>
  linesOf(source).flatMap((line) => {
    const kind = kindOf(line.text, words);
    const end = line.start + line.text.length;
    const onLine = dates.filter((date) => date.offset >= line.start && date.offset <= end && FULL_DATE.test(date.value));
    const [date] = onLine;
    return kind === undefined || date === undefined || onLine.length > 1 ? [] : [{ kind, date }];
  });

export const dueBeforeIssue = (source: string, dates: readonly DatedPoint[], words: DueWords): StructureIssue[] => {
  if (words.issue.length === 0 || words.due.length === 0) return [];
  const labelled = labelledDates(source, dates, words);
  const issued = labelled.find((entry) => entry.kind === "issue");
  if (issued === undefined) return [];
  return labelled
    .filter((entry) => entry.kind === "due" && entry.date.value < issued.date.value)
    .map((entry) => ({ offset: entry.date.offset, values: { due: entry.date.value, issued: issued.date.value } }));
};
