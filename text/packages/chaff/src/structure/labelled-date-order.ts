import { namesDocumentKind } from "./document-context.ts";
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
 * period's end is its date, or its start for a span word in fromStart. Pure.
 */
export type DateOrderWords = PairWords & {
  /** The words whose line states a period rather than one date (labels), with the range signs and names to read it. */
  readonly spans?: PeriodWords | undefined;
  /** The span words whose period's start is the date: the later date may fall anywhere in the period (a pay date in its pay period). */
  readonly fromStart?: readonly string[] | undefined;
};

/** A date from the tree; end is where its text ends, needed only to read a period. */
export type OrderDate = DatedPoint & { readonly end?: number | undefined };

/** A labelled date: the word that labels it, as the lexicon writes it. span is set when the date ends a stated period. */
export type LabelledDate = { readonly label: string; readonly date: DatedPoint; readonly line: number; readonly span: boolean };

export type OutOfOrder = { readonly earlier: LabelledDate; readonly later: LabelledDate };

const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;

const mentionsOf = (dates: readonly OrderDate[]): DateMention[] => dates.flatMap((date) => (date.end === undefined ? [] : [{ ...date, end: date.end }]));

/**
 * The start or the end of the period a span word's line states (対象期間：2026年4月1日〜9月30日 starts 2026-04-01 and
 * ends 2026-09-30), with its year. A period without a year, or a line that states no period, gives undefined. tableOf gives
 * the table the line is a row of (| 対象期間 | 2026年4月1日〜9月30日 |), read when the row is the table's only row labelled
 * with any span word: a table with both Reporting period and Period covered rows lists periods. A row's label cell is the
 * span word itself, so all of them are passed.
 */
const periodBoundOf = (
  bound: "start" | "end",
  line: Line,
  label: string,
  dates: readonly OrderDate[],
  spans: PeriodWords,
  tableOf: () => readonly string[] = () => [],
): DatedPoint | undefined => {
  const labels = TABLE_ROW.test(line.text) ? spans.labels : [label];
  const period = statedPeriod(line.text, line.start, mentionsOf(dates), { ...spans, labels }, tableOf);
  return period === undefined || !FULL_DATE.test(period[bound]) ? undefined : { offset: line.start, value: period[bound] };
};

/** The end of the period a span word's line states. */
export const periodEndOf = (
  line: Line,
  label: string,
  dates: readonly OrderDate[],
  spans: PeriodWords,
  tableOf?: () => readonly string[],
): DatedPoint | undefined => periodBoundOf("end", line, label, dates, spans, tableOf);

/** The start of the period a span word's line states. */
export const periodStartOf = (
  line: Line,
  label: string,
  dates: readonly OrderDate[],
  spans: PeriodWords,
  tableOf?: () => readonly string[],
): DatedPoint | undefined => periodBoundOf("start", line, label, dates, spans, tableOf);

const oneDateOf = (line: Line, dates: readonly OrderDate[]): DatedPoint | undefined => {
  const end = line.start + line.text.length;
  const onLine = dates.filter((date) => date.offset >= line.start && date.offset <= end && FULL_DATE.test(date.value));
  return onLine.length === 1 ? onLine[0] : undefined;
};

const dateOf =
  (dates: readonly OrderDate[], spans: PeriodWords | undefined, fromStart: readonly string[]): PointOf =>
  (line, label, tableOf) => {
    if (spans === undefined || !spans.labels.includes(label)) {
      const date = oneDateOf(line, dates);
      return date === undefined ? undefined : { point: date, span: false };
    }
    const bound = fromStart.includes(label) ? periodStartOf(line, label, dates, spans, tableOf) : periodEndOf(line, label, dates, spans, tableOf);
    return bound === undefined ? undefined : { point: bound, span: true };
  };

/**
 * A later date before the first earlier date. When both sides are written more than once (a history listing one record
 * per row, newest first), the later date must also be before the earlier date written closest to it: that is its own
 * record's. A later date written once (an issue date below the records) belongs to the whole document and keeps the first.
 */
export const datesOutOfOrder = (source: string, dates: readonly OrderDate[], words: DateOrderWords): OutOfOrder[] =>
  pointsOutOfOrder(source, words, dateOf(dates, words.spans, words.fromStart ?? [])).map(({ earlier, later }) => ({
    earlier: { label: earlier.label, date: earlier.point, line: earlier.line, span: earlier.span },
    later: { label: later.label, date: later.point, line: later.line, span: later.span },
  }));

/** An out-of-order pair; period is set when the earlier date is a stated period's end, or its start when fromStart is set. */
export type PairedIssue = StructureIssue & { readonly period: boolean; readonly fromStart?: boolean | undefined };

/** The span words with the range signs and names to read them, and the dated-span lexicon's entries they come from. */
export type PairSpans = PeriodWords & { readonly entries: readonly OrderLabel[] };

/**
 * The span words a dated-span lexicon reads by the period's start in one group: its entries naming that group with
 * position before. An entry without a group is read by the period's end in every group.
 */
export const spanStartsOf = (spanLabels: readonly OrderLabel[], group: string): string[] =>
  spanLabels.filter((label) => label.group === group && label.position === "before").map((label) => label.pattern);

/** The span words to read periods with, and the whole document (its headings too) to read the words naming its kind. */
export type PairedReading = { readonly spans?: PairSpans | undefined; readonly whole?: string | undefined };

/** The words a group names its kind of document with: the group's entries without a position (見積, Quote). */
const contextOf = (labels: readonly OrderLabel[], group: string): string[] =>
  labels.filter((label) => label.group === group && label.position === undefined).map((label) => label.pattern);

const sameDates = (one: PairedIssue, other: PairedIssue): boolean =>
  one.offset === other.offset && one.values["later"] === other.values["later"] && one.values["earlier"] === other.values["earlier"];

/**
 * The issues, two groups comparing one later date with the same earlier date reported once (a leaver's issue date before
 * both the leaving date and the end of the period covered, which is the same day). Different earlier dates are kept.
 */
const withoutRepeats = (issues: readonly PairedIssue[]): PairedIssue[] =>
  issues.filter((issue, index) => issues.findIndex((other) => sameDates(other, issue)) === index);

/**
 * Every pair of a dated-pair lexicon: the entries of one group with position before label the earlier date, those with
 * position after the later one. The values name both labels, so the message can quote them. The issue is on whichever
 * of the two dates is written second: a reader meets the contradiction there (a cancellation deadline below check-in).
 * A group with entries without a position is read only in a document whose title or a field's label names one of them
 * (namesDocumentKind, over reading.whole: the document with its headings, which source blanks out): ご利用日 before 有効期限 is a
 * quote's mistake and a points statement's normal order.
 * reading.spans.entries are the dated-span lexicon's entries, for the span words a group reads by the period's start.
 */
export const pairedDatesOutOfOrder = (
  source: string,
  dates: readonly OrderDate[],
  labels: readonly OrderLabel[],
  passed: readonly string[],
  maxLineGap: number,
  { spans, whole = source }: PairedReading = {},
): PairedIssue[] =>
  withoutRepeats(
    labelPairsOf(labels).flatMap((pair) => {
      const context = contextOf(labels, pair.group);
      if (context.length > 0 && !namesDocumentKind(whole, context)) return [];
      const fromStart = spanStartsOf(spans?.entries ?? [], pair.group);
      return datesOutOfOrder(source, dates, { ...pair, passed, maxLineGap, spans, fromStart }).map(({ earlier, later }) => ({
        offset: Math.max(later.date.offset, earlier.date.offset),
        values: { later: later.date.value, earlier: earlier.date.value, later_label: later.label, earlier_label: earlier.label },
        period: earlier.span,
        ...(earlier.span && fromStart.includes(earlier.label) ? { fromStart: true } : {}),
      }));
    }),
  );
