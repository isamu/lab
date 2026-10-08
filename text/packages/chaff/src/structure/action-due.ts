import type { MarkupHeading } from "../plugin.ts";
import { CELL_SEPARATOR } from "./bare-numbers.ts";
import type { DatedPoint } from "./due-date.ts";
import type { StructureIssue } from "./issues.ts";
import { linesOf, type Line } from "./lines.ts";
import { TABLE_RULE } from "./runs.ts";
import { isTotalLabel } from "./total.ts";

/**
 * An action item due before the meeting it was set in. Only minutes are read (a title with 議事録 or Minutes). The meeting
 * date is the first date on a line starting with a meeting-date word (日時, Date) near the top; the deadlines are those of the action sections (a heading with 宿題 or
 * Action items): the cell under a due column (期限, Due) of a table, or a date right after a due word in a list item
 * (（期限 11月2日）, (due Oct 3)). An item marked done, and a section on earlier items (前回の宿題), are not read. Pure.
 */
export type ActionWords = {
  readonly meeting: readonly string[];
  readonly section: readonly string[];
  readonly earlier: readonly string[];
  readonly due: readonly string[];
  readonly done: readonly string[];
  readonly minutes: readonly string[];
};

/** How far from the top the meeting date may be and still be the date of the meeting the minutes record. */
const MEETING_HEAD_LINES = 12;

/** A deadline without a year this many days or fewer after the meeting, read in the next year, is taken as next year's. */
const MAX_WRAP_DAYS = 92;

const MS_PER_DAY = 86_400_000;
const FULL_DATE = /^\d{4}-\d{2}-\d{2}$/u;
const MONTH_DAY = /^(?:\d{4}-)?(\d{2})-(\d{2})$/u;
const LIST_ITEM = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]/u;
const LATIN_WORD = /^[A-Za-z ]+$/u;

const escaped = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

const hasWord = (text: string, word: string): boolean => (LATIN_WORD.test(word) ? new RegExp(`\\b${escaped(word)}\\b`, "iu").test(text) : text.includes(word));

const hasAny = (text: string, words: readonly string[]): boolean => words.some((word) => hasWord(text, word));

const CHECKED_BOX = /^[ \t]*(?:[-*+]|\d{1,3}[.)])[ \t]+\[[xX]\]/u;
const BRACKETED = /[(（【[][^()（）【】[\]]*[)）】\]]/gu;
const TRAIL_SEPARATOR = /[ \t—–:：、,]/u;
const LINE_CLOSERS = new Set(["|", "。", ".", " ", "\t"]);

/** The last word of a line, without a closing table bar or a full stop. */
const lastWord = (text: string): string =>
  (
    text
      .slice(0, text.split("").findLastIndex((unit) => !LINE_CLOSERS.has(unit)) + 1)
      .split(TRAIL_SEPARATOR)
      .at(-1) ?? ""
  ).toLowerCase();

const cellTexts = (text: string): string[] =>
  text.split(CELL_SEPARATOR).map((cell) =>
    cell
      .replace(/[*_✔✓]/gu, "")
      .trim()
      .toLowerCase(),
  );

/**
 * An item marked done: a checked box, a cell that is a done word alone, a done word in brackets (（済）, (done, June 3)),
 * or one ending the line. A done word inside the task (Complete the review) does not mark it.
 */
const isMarkedDone = (text: string, words: readonly string[]): boolean => {
  if (CHECKED_BOX.test(text)) return true;
  const alone = new Set(words.map((word) => word.toLowerCase()));
  return cellTexts(text).some((cell) => alone.has(cell)) || alone.has(lastWord(text)) || [...text.matchAll(BRACKETED)].some((match) => hasAny(match[0], words));
};

/** Whether the title (the first top-level heading, or else the first line with text) names minutes. */
const isMinutes = (lines: readonly Line[], headings: readonly MarkupHeading[], words: readonly string[]): boolean =>
  hasAny(headings.find((heading) => heading.depth === 1)?.text ?? lines.find((line) => line.text.trim() !== "")?.text ?? "", words);

const datesIn = (dates: readonly DatedPoint[], start: number, end: number): DatedPoint[] => dates.filter((date) => date.offset >= start && date.offset <= end);

const meetingDate = (lines: readonly Line[], dates: readonly DatedPoint[], words: readonly string[]): DatedPoint | undefined =>
  lines
    .slice(0, MEETING_HEAD_LINES)
    .filter((line) => isTotalLabel(line.text, words))
    .map((line) => datesIn(dates, line.start, line.start + line.text.length)[0])
    .find((date) => date !== undefined);

type Range = { readonly start: number; readonly end: number };

/** Where a heading's section ends: the next heading at its depth or above. */
const sectionOf = (headings: readonly MarkupHeading[], index: number, end: number): Range => {
  const heading = headings[index];
  const next = headings.slice(index + 1).find((later) => heading !== undefined && later.depth <= heading.depth);
  return { start: heading?.start ?? end, end: next?.start ?? end };
};

/** The action sections, without the parts under a heading on earlier items. */
const actionRanges = (headings: readonly MarkupHeading[], length: number, words: ActionWords): { take: Range[]; skip: Range[] } => {
  const ranges = headings.map((heading, index) => ({ heading, range: sectionOf(headings, index, length) }));
  return {
    take: ranges.filter(({ heading }) => hasAny(heading.text, words.section)).map(({ range }) => range),
    skip: ranges.filter(({ heading }) => hasAny(heading.text, words.earlier)).map(({ range }) => range),
  };
};

const inside = (offset: number, ranges: readonly Range[]): boolean => ranges.some((range) => offset >= range.start && offset < range.end);

/** The column of a table header that is a due word alone, if the line is a header (the next line is the table's rule). */
const dueColumn = (line: Line, next: Line | undefined, words: readonly string[]): number | undefined => {
  if (next === undefined || !TABLE_RULE.test(next.text) || !line.text.includes("|")) return undefined;
  const labels = new Set(words.map((word) => word.toLowerCase()));
  const column = cellTexts(line.text).findIndex((cell) => labels.has(cell));
  return column < 0 ? undefined : column;
};

const lineEnd = (line: Line): number => line.start + line.text.length;

const columnAt = (line: Line, offset: number): number => line.text.slice(0, offset - line.start).split(CELL_SEPARATOR).length - 1;

/** The deadline in a table row: the one date in the due column. */
const rowDeadline = (line: Line, column: number, dates: readonly DatedPoint[]): DatedPoint[] => {
  const inColumn = datesIn(dates, line.start, lineEnd(line)).filter((date) => columnAt(line, date.offset) === column);
  return inColumn.length === 1 ? inColumn : [];
};

/** A due word right before a date, with at most one word between (due Monday, November 2; 期限：11月2日). */
const dueWordBefore = (words: readonly string[]): RegExp =>
  new RegExp(`(?:^|[\\s(（、,;:：])(?:${words.map(escaped).join("|")})[ \\t\\u3000:：]*(?:\\p{L}+,?[ \\t]+)?$`, "iu");

/** The deadlines of a list item: the dates right after a due word. */
const listDeadlines = (line: Line, dates: readonly DatedPoint[], dueBefore: RegExp): DatedPoint[] =>
  LIST_ITEM.test(line.text) ? datesIn(dates, line.start, lineEnd(line)).filter((date) => dueBefore.test(line.text.slice(0, date.offset - line.start))) : [];

/** The deadlines of the tables with a due column and of the list items, outside items marked done. */
const deadlinesOf = (lines: readonly Line[], dates: readonly DatedPoint[], words: ActionWords): DatedPoint[] => {
  const found: DatedPoint[] = [];
  const dueBefore = dueWordBefore(words.due);
  lines.reduce<number | undefined>((column, line, index) => {
    const header = dueColumn(line, lines[index + 1], words.due);
    if (header !== undefined) return header;
    const inTable = line.text.includes("|") ? column : undefined;
    if (isMarkedDone(line.text, words.done)) return inTable;
    found.push(...(inTable === undefined ? listDeadlines(line, dates, dueBefore) : rowDeadline(line, inTable, dates)));
    return inTable;
  }, undefined);
  return found;
};

const REFERENCE_YEAR = 2001;

const dayNumber = (value: string, year: number): number | undefined => {
  const match = MONTH_DAY.exec(value);
  return match === null ? undefined : Date.UTC(year, Number(match[1]) - 1, Number(match[2])) / MS_PER_DAY;
};

/** Whether a deadline is before the meeting. Without a year on one of them, a deadline early in the next year is not. */
export const isBeforeMeeting = (due: string, meeting: string): boolean => {
  if (FULL_DATE.test(due) && FULL_DATE.test(meeting)) return due < meeting;
  const meetingDay = dayNumber(meeting, REFERENCE_YEAR);
  const dueDay = dayNumber(due, REFERENCE_YEAR);
  const dueNextYear = dayNumber(due, REFERENCE_YEAR + 1);
  if (meetingDay === undefined || dueDay === undefined || dueNextYear === undefined) return false;
  return dueDay < meetingDay && dueNextYear - meetingDay > MAX_WRAP_DAYS;
};

export const actionDueBeforeMeeting = (
  source: string,
  dates: readonly DatedPoint[],
  headings: readonly MarkupHeading[],
  words: ActionWords,
): StructureIssue[] => {
  if (words.meeting.length === 0 || words.due.length === 0 || words.section.length === 0) return [];
  const lines = linesOf(source);
  const meeting = meetingDate(lines, dates, words.meeting);
  const ranges = actionRanges(headings, source.length, words);
  if (meeting === undefined || ranges.take.length === 0 || !isMinutes(lines, headings, words.minutes)) return [];
  return deadlinesOf(lines, dates, words)
    .filter((due) => inside(due.offset, ranges.take) && !inside(due.offset, ranges.skip) && isBeforeMeeting(due.value, meeting.value))
    .map((due) => ({ offset: due.offset, values: { due: due.value, meeting: meeting.value } }));
};
