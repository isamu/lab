import type { DatedPoint } from "./due-date.ts";
import type { StructureIssue } from "./issues.ts";
import { linesOf } from "./lines.ts";
import { isTotalLabel } from "./total.ts";

/**
 * Two labelled dates that must come in order: a line (or a list item, or a table's first column) starting with an
 * earlier-date word and one starting with a later-date word, each with one full date on it. A later date before the
 * first earlier date, and written near it, is out of order. A line with a passed word (期限切れ, overdue) reports on a
 * date rather than setting one and is not read. Pure.
 */
export type DateOrderWords = {
  readonly earlier: readonly string[];
  readonly later: readonly string[];
  readonly passed: readonly string[];
  /** How many lines from the earlier date a later date may be and still be read as the same record's. */
  readonly maxLineGap: number;
};

/** A labelled date: the word that labels it, as the lexicon writes it. */
export type LabelledDate = { readonly label: string; readonly date: DatedPoint; readonly line: number };

export type OutOfOrder = { readonly earlier: LabelledDate; readonly later: LabelledDate };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

type Read = LabelledDate & { readonly kind: "earlier" | "later" };

const labelOf = (text: string, words: readonly string[]): string | undefined => words.find((word) => isTotalLabel(text, [word]));

const kindOf = (text: string, words: DateOrderWords): Pick<Read, "kind" | "label"> | undefined => {
  const earlier = labelOf(text, words.earlier);
  if (earlier !== undefined) return { kind: "earlier", label: earlier };
  const later = labelOf(text, words.later);
  return later === undefined ? undefined : { kind: "later", label: later };
};

const labelledDates = (source: string, dates: readonly DatedPoint[], words: DateOrderWords): Read[] =>
  linesOf(source).flatMap((line) => {
    const passed = words.passed.some((word) => line.text.toLowerCase().includes(word.toLowerCase()));
    const kind = passed ? undefined : kindOf(line.text, words);
    const end = line.start + line.text.length;
    const onLine = dates.filter((date) => date.offset >= line.start && date.offset <= end && FULL_DATE.test(date.value));
    const [date] = onLine;
    return kind === undefined || date === undefined || onLine.length > 1 ? [] : [{ ...kind, date, line: line.number }];
  });

export const datesOutOfOrder = (source: string, dates: readonly DatedPoint[], words: DateOrderWords): OutOfOrder[] => {
  if (words.earlier.length === 0 || words.later.length === 0) return [];
  const labelled = labelledDates(source, dates, words);
  const earlier = labelled.find((entry) => entry.kind === "earlier");
  if (earlier === undefined) return [];
  return labelled
    .filter((entry) => entry.kind === "later" && entry.date.value < earlier.date.value && Math.abs(entry.line - earlier.line) < words.maxLineGap)
    .map((later) => ({ earlier, later }));
};

/** A lexicon entry naming its pair (group) and its side: before for the earlier date, after for the later one. */
export type OrderLabel = { readonly pattern: string; readonly group?: string | undefined; readonly position?: "before" | "after" | undefined };

const groupsOf = (labels: readonly OrderLabel[]): string[] => [...new Set(labels.flatMap((label) => (label.group === undefined ? [] : [label.group])))];

const sideOf = (labels: readonly OrderLabel[], group: string, position: "before" | "after"): string[] =>
  labels.filter((label) => label.group === group && label.position === position).map((label) => label.pattern);

/**
 * Every pair of a dated-pair lexicon: the entries of one group with position before label the earlier date, those with
 * position after the later one. The values name both labels, so the message can quote them.
 */
export const pairedDatesOutOfOrder = (
  source: string,
  dates: readonly DatedPoint[],
  labels: readonly OrderLabel[],
  passed: readonly string[],
  maxLineGap: number,
): StructureIssue[] =>
  groupsOf(labels).flatMap((group) =>
    datesOutOfOrder(source, dates, { earlier: sideOf(labels, group, "before"), later: sideOf(labels, group, "after"), passed, maxLineGap }).map(
      ({ earlier, later }) => ({
        offset: later.date.offset,
        values: { later: later.date.value, earlier: earlier.date.value, later_label: later.label, earlier_label: earlier.label },
      }),
    ),
  );
