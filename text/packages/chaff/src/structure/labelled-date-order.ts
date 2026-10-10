import type { DatedPoint } from "./due-date.ts";
import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { tableAround } from "./key-value-row.ts";
import { TABLE_ROW } from "./runs.ts";
import { statedPeriod, type DateMention, type PeriodWords } from "./stated-period.ts";
import { isTotalLabel } from "./total.ts";

/**
 * Two labelled dates that must come in order: a line (or a list item, or a table's first column) starting with an
 * earlier-date word and one starting with a later-date word, each with one full date on it. A later date before the
 * first earlier date, and written near it, is out of order. A line with a passed word (期限切れ, overdue) reports on a
 * date rather than setting one and is not read. A span word (対象期間, Reporting period) labels a period, and the
 * period's end is its date. Pure.
 */
export type DateOrderWords = {
  readonly earlier: readonly string[];
  readonly later: readonly string[];
  readonly passed: readonly string[];
  /** How many lines from the earlier date a later date may be and still be read as the same record's. */
  readonly maxLineGap: number;
  /** The words whose line states a period rather than one date (labels), with the range signs and names to read it. */
  readonly spans?: PeriodWords | undefined;
};

/** A date from the tree; end is where its text ends, needed only to read a period. */
export type OrderDate = DatedPoint & { readonly end?: number | undefined };

/** A labelled date: the word that labels it, as the lexicon writes it. span is set when the date ends a stated period. */
export type LabelledDate = { readonly label: string; readonly date: DatedPoint; readonly line: number; readonly span: boolean };

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

const mentionsOf = (dates: readonly OrderDate[]): DateMention[] => dates.flatMap((date) => (date.end === undefined ? [] : [{ ...date, end: date.end }]));

/**
 * The end of the period a span word's line states (対象期間：2026年4月1日〜9月30日 ends 2026-09-30), with its year.
 * A period without a year, or a line that states no period, gives undefined. tableOf gives the table the line is a row of
 * (| 対象期間 | 2026年4月1日〜9月30日 |), read when the row is the table's only row labelled with any span word: a table with
 * both Reporting period and Period covered rows lists periods. A row's label cell is the span word itself, so all of them are passed.
 */
export const periodEndOf = (
  line: Line,
  label: string,
  dates: readonly OrderDate[],
  spans: PeriodWords,
  tableOf: () => readonly string[] = () => [],
): DatedPoint | undefined => {
  const labels = TABLE_ROW.test(line.text) ? spans.labels : [label];
  const period = statedPeriod(line.text, line.start, mentionsOf(dates), { ...spans, labels }, tableOf);
  return period === undefined || !FULL_DATE.test(period.end) ? undefined : { offset: line.start, value: period.end };
};

const oneDateOf = (line: Line, dates: readonly OrderDate[]): DatedPoint | undefined => {
  const end = line.start + line.text.length;
  const onLine = dates.filter((date) => date.offset >= line.start && date.offset <= end && FULL_DATE.test(date.value));
  return onLine.length === 1 ? onLine[0] : undefined;
};

const dateOf = (
  line: Line,
  label: string,
  dates: readonly OrderDate[],
  spans: PeriodWords | undefined,
  tableOf: () => readonly string[],
): Pick<Read, "date" | "span"> | undefined => {
  if (spans === undefined || !spans.labels.includes(label)) {
    const date = oneDateOf(line, dates);
    return date === undefined ? undefined : { date, span: false };
  }
  const end = periodEndOf(line, label, dates, spans, tableOf);
  return end === undefined ? undefined : { date: end, span: true };
};

const labelledDates = (source: string, dates: readonly OrderDate[], words: DateOrderWords): Read[] => {
  const lines = linesOf(source);
  const texts = lines.map((line) => line.text);
  return lines.flatMap((line, index) => {
    const passed = words.passed.some((word) => line.text.toLowerCase().includes(word.toLowerCase()));
    const kind = passed ? undefined : kindOf(line.text, words);
    const dated = kind === undefined ? undefined : dateOf(line, kind.label, dates, words.spans, () => tableAround(texts, index));
    return kind === undefined || dated === undefined ? [] : [{ ...kind, ...dated, line: line.number }];
  });
};

export const datesOutOfOrder = (source: string, dates: readonly OrderDate[], words: DateOrderWords): OutOfOrder[] => {
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

/** An out-of-order pair; period is set when the earlier date is the end of a stated period. */
export type PairedIssue = StructureIssue & { readonly period: boolean };

/**
 * Every pair of a dated-pair lexicon: the entries of one group with position before label the earlier date, those with
 * position after the later one. The values name both labels, so the message can quote them.
 */
export const pairedDatesOutOfOrder = (
  source: string,
  dates: readonly OrderDate[],
  labels: readonly OrderLabel[],
  passed: readonly string[],
  maxLineGap: number,
  spans?: PeriodWords,
): PairedIssue[] =>
  groupsOf(labels).flatMap((group) =>
    datesOutOfOrder(source, dates, { earlier: sideOf(labels, group, "before"), later: sideOf(labels, group, "after"), passed, maxLineGap, spans }).map(
      ({ earlier, later }) => ({
        offset: later.date.offset,
        values: { later: later.date.value, earlier: earlier.date.value, later_label: later.label, earlier_label: earlier.label },
        period: earlier.span,
      }),
    ),
  );
