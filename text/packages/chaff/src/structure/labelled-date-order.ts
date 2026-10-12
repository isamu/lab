import type { DatedPoint } from "./due-date.ts";
import type { StructureIssue } from "./issues.ts";
import type { Line } from "./lines.ts";
import { labelPairsOf, pointsOutOfOrder, type OrderLabel, type PairWords, type PointOf } from "./labelled-order.ts";
import { TABLE_ROW } from "./runs.ts";
import { statedPeriod, type DateMention, type PeriodWords } from "./stated-period.ts";

/**
 * Two labelled dates that must come in order: a line (or a list item, or a table's first column) starting with an
 * earlier-date word and one starting with a later-date word, each with one full date on it. A later date before the
 * first earlier date, and written near it, is out of order. A line with a passed word (期限切れ, overdue) reports on a
 * date rather than setting one and is not read. A span word (対象期間, Reporting period) labels a period, and the
 * period's end is its date. Pure.
 */
export type DateOrderWords = PairWords & {
  /** The words whose line states a period rather than one date (labels), with the range signs and names to read it. */
  readonly spans?: PeriodWords | undefined;
};

/** A date from the tree; end is where its text ends, needed only to read a period. */
export type OrderDate = DatedPoint & { readonly end?: number | undefined };

/** A labelled date: the word that labels it, as the lexicon writes it. span is set when the date ends a stated period. */
export type LabelledDate = { readonly label: string; readonly date: DatedPoint; readonly line: number; readonly span: boolean };

export type OutOfOrder = { readonly earlier: LabelledDate; readonly later: LabelledDate };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

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

const dateOf =
  (dates: readonly OrderDate[], spans: PeriodWords | undefined): PointOf =>
  (line, label, tableOf) => {
    if (spans === undefined || !spans.labels.includes(label)) {
      const date = oneDateOf(line, dates);
      return date === undefined ? undefined : { point: date, span: false };
    }
    const end = periodEndOf(line, label, dates, spans, tableOf);
    return end === undefined ? undefined : { point: end, span: true };
  };

/**
 * A later date before the first earlier date. When both sides are written more than once (a history listing one record
 * per row, newest first), the later date must also be before the earlier date written closest to it: that is its own
 * record's. A later date written once (an issue date below the records) belongs to the whole document and keeps the first.
 */
export const datesOutOfOrder = (source: string, dates: readonly OrderDate[], words: DateOrderWords): OutOfOrder[] =>
  pointsOutOfOrder(source, words, dateOf(dates, words.spans)).map(({ earlier, later }) => ({
    earlier: { label: earlier.label, date: earlier.point, line: earlier.line, span: earlier.span },
    later: { label: later.label, date: later.point, line: later.line, span: later.span },
  }));

/** An out-of-order pair; period is set when the earlier date is the end of a stated period. */
export type PairedIssue = StructureIssue & { readonly period: boolean };

/**
 * Every pair of a dated-pair lexicon: the entries of one group with position before label the earlier date, those with
 * position after the later one. The values name both labels, so the message can quote them. The issue is on whichever
 * of the two dates is written second: a reader meets the contradiction there (a cancellation deadline below check-in).
 */
export const pairedDatesOutOfOrder = (
  source: string,
  dates: readonly OrderDate[],
  labels: readonly OrderLabel[],
  passed: readonly string[],
  maxLineGap: number,
  spans?: PeriodWords,
): PairedIssue[] =>
  labelPairsOf(labels).flatMap((pair) =>
    datesOutOfOrder(source, dates, { ...pair, passed, maxLineGap, spans }).map(({ earlier, later }) => ({
      offset: Math.max(later.date.offset, earlier.date.offset),
      values: { later: later.date.value, earlier: earlier.date.value, later_label: later.label, earlier_label: earlier.label },
      period: earlier.span,
    })),
  );
