import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import type { Mark } from "../structure/time-marks.ts";
import { linesOf, type Line } from "../structure/lines.ts";
import { cellsOf, tablesOf } from "../facts/table-facts.ts";
import type { TimeLength } from "./time-lengths.ts";
import {
  asciiDigits,
  isLimited,
  lastIndexAtOrBefore,
  periodCounts,
  windowStart,
  type LimitWords,
  type PeriodCount,
  type PeriodCountWords,
  type PeriodWord,
} from "./period-counts.ts";

/**
 * A minimum interval between uses and a maximum count of uses in a period that cannot both hold, and a maximum count that
 * differs from the times a day of the dosing table in the same section. Read in one paragraph holding exactly one
 * minimum interval (4時間以上あけ, at least 4 hours between doses) and exactly one count with a limit (1日6回を超えて,
 * no more than 6 doses a day). n uses at least h hours apart take (n - 1) × h hours from the first to the last; when
 * that reaches the length of the period, the n-th use falls outside it. Pure.
 */
export type IntervalWords = PeriodCountWords &
  LimitWords & {
    /** What makes a length a minimum: before it (at least 4 hours) or right after it (4時間以上). */
    readonly minimum: readonly Mark[];
    /** What makes a minimum length an interval between uses, in the same sentence (間隔, between). */
    readonly cues: readonly string[];
    /** Table headings of a count of uses in a period (1日の服用回数, Times a day), with the period's hours. */
    readonly columns: readonly PeriodWord[];
  };

export type IntervalMismatch =
  | { readonly kind: "interval"; readonly count: PeriodCount; readonly interval: TimeLength; readonly neededHours: number }
  | { readonly kind: "table"; readonly count: PeriodCount; readonly column: string; readonly tableCount: number };

const MINUTES_PER_HOUR = 60;

const lower = (text: string): string => text.toLowerCase();

const SENTENCE_END = /[。．！？!?\n]|\.(?=\s|$)/u;

/** How far after a length its sentence is read, in characters. */
const SENTENCE_REACH = 120;

const sentenceAround = (text: string, span: Span): Span => {
  const end = SENTENCE_END.exec(text.slice(span.end, span.end + SENTENCE_REACH));
  return { start: windowStart(text, span.start, []), end: end === null ? Math.min(text.length, span.end + SENTENCE_REACH) : span.end + end.index };
};

const hasWord = (text: string, word: string): boolean => new RegExp(`(?<![a-z])${escapeRegExp(lower(word))}(?![a-z])`, "u").test(lower(text));

/** 4時間以上, at least 4 hours: a length with a minimum mark beside it and an interval word in its sentence. */
const isMinimumInterval = (text: string, length: TimeLength, words: IntervalWords): boolean => {
  const sentence = sentenceAround(text, length);
  const before = lower(text.slice(sentence.start, length.start)).trimEnd();
  const after = lower(text.slice(length.end, sentence.end)).trimStart();
  const marked = words.minimum.some((mark) =>
    (mark.position ?? "after") === "after" ? after.startsWith(lower(mark.pattern)) : before.endsWith(lower(mark.pattern)),
  );
  return marked && words.cues.some((cue) => hasWord(text.slice(sentence.start, sentence.end), cue));
};

const inside = (scope: Span) => (span: Span) => span.start >= scope.start && span.end <= scope.end;

type Statement = { readonly count: PeriodCount; readonly interval: TimeLength };

const statementIn = (scope: Span, counts: readonly PeriodCount[], intervals: readonly TimeLength[]): Statement | undefined => {
  const [inCounts, inIntervals] = [counts.filter(inside(scope)), intervals.filter(inside(scope))];
  const [count, interval] = [inCounts[0], inIntervals[0]];
  return inCounts.length === 1 && inIntervals.length === 1 && count !== undefined && interval !== undefined ? { count, interval } : undefined;
};

const HEADING = /^ {0,3}#{1,6}\s/u;

const plain = (cell: string): string => lower(asciiDigits(cell).normalize("NFKC").replace(/[*_`]/gu, "").trim());

const COUNT_CELL = /^(\d+)(?:\s*[〜~\-–]\s*(\d+))?$/u;

/** A cell that holds only a count: 3, 3回, 2〜3回, three, twice. The larger end of a range. */
const cellCount = (cell: string, words: PeriodCountWords): number | undefined => {
  const text = plain(cell);
  const counter = words.counters.find((word) => text.endsWith(lower(word)));
  const bare = counter === undefined ? text : text.slice(0, -counter.length).trim();
  const digits = COUNT_CELL.exec(bare);
  if (digits !== null) return Number(digits[2] ?? digits[1]);
  return words.numberWords.find((word) => lower(word.pattern) === bare)?.value;
};

type TableCount = { readonly at: number; readonly column: string; readonly count: number; readonly hours: number };

/** The largest count of each counted column, in every table. */
const tableCountsOf = (lines: readonly Line[], words: IntervalWords): TableCount[] =>
  tablesOf(lines).flatMap(({ header, rows }) =>
    cellsOf(header).flatMap((cell, index): TableCount[] => {
      const column = words.columns.find((word) => plain(word.pattern) === plain(cell.text));
      const values = rows.flatMap((row) => {
        const value = cellCount(cellsOf(row)[index]?.text ?? "", words);
        return value === undefined ? [] : [value];
      });
      if (column === undefined || values.length === 0) return [];
      return [{ at: header.start, column: cell.text.trim(), count: Math.max(...values), hours: column.hours }];
    }),
  );

type Layout = { readonly headings: readonly number[]; readonly tables: readonly TableCount[]; readonly length: number };

const layoutOf = (text: string, words: IntervalWords): Layout => {
  const lines = linesOf(text);
  return { headings: lines.filter((line) => HEADING.test(line.text)).map((line) => line.start), tables: tableCountsOf(lines, words), length: text.length };
};

/** The heading-delimited section that holds at. */
const sectionOf = (layout: Layout, at: number): Span => {
  const index = lastIndexAtOrBefore(layout.headings, at);
  return { start: layout.headings[index] ?? 0, end: layout.headings[index + 1] ?? layout.length };
};

const tableMismatch = (layout: Layout, count: PeriodCount): IntervalMismatch | undefined => {
  const section = sectionOf(layout, count.start);
  const tables = layout.tables.filter((table) => table.at >= section.start && table.at < section.end && table.hours === count.hours);
  const table = tables[0];
  if (tables.length !== 1 || table === undefined || table.count === count.amount) return undefined;
  return { kind: "table", count, column: table.column, tableCount: table.count };
};

const mismatchOf = (layout: Layout, statement: Statement): IntervalMismatch | undefined => {
  const { count, interval } = statement;
  const neededMinutes = (count.amount - 1) * interval.minutes;
  if (neededMinutes >= count.hours * MINUTES_PER_HOUR) return { kind: "interval", count, interval, neededHours: neededMinutes / MINUTES_PER_HOUR };
  return tableMismatch(layout, count);
};

/** Limited counts that a minimum interval in the same paragraph, or the table of the section, contradicts. */
export const intervalCountMismatches = (written: string, scopes: readonly Span[], lengths: readonly TimeLength[], words: IntervalWords): IntervalMismatch[] => {
  const text = asciiDigits(written);
  const all = periodCounts(text, words);
  const takenEnds = all.map((count) => count.end);
  const counts = all.filter((count) => isLimited(text, count, windowStart(text, count.start, takenEnds), words));
  const intervals = lengths.filter((length) => isMinimumInterval(text, length, words));
  if (counts.length === 0 || intervals.length === 0) return [];
  const layout = layoutOf(text, words);
  return scopes.flatMap((scope) => {
    const statement = statementIn(scope, counts, intervals);
    const found = statement === undefined ? undefined : mismatchOf(layout, statement);
    return found === undefined ? [] : [found];
  });
};
