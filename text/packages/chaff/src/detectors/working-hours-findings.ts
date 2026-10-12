import type { Finding, ProseDocument, Span } from "../plugin.ts";
import { timeLengths, type LengthWords, type TimeLength } from "../derived/time-lengths.ts";
import { clockRanges, workingHoursMismatches, type WorkingHoursMismatch, type WorkingHoursWords } from "../derived/working-hours.ts";
import { timesheetHoursMismatches, type TimesheetMismatch } from "../derived/timesheet-hours.ts";
import { computedLength, type ComputedLength } from "../derived/hours-and-minutes.ts";
import { cellMinutes, showsOvernightWork } from "../structure/shift-times.ts";
import { clockTimes } from "../compare/clock-time.ts";
import { secondsOf, type TimeSpan } from "../structure/time-marks.ts";
import { marksOf } from "./use-count-words.ts";

// duration-mismatch の勤務時間: 文の中の「9:00〜17:30、休憩1時間、実働8時間」と、勤務表の行（始業 | 終業 | 休憩 | 実働）。

/** duration-mismatch の指摘を作る関数（derived-numbers.ts の finding）。 */
type FindingOf = (doc: ProseDocument, offset: number, values: Record<string, string | number>, variant?: string) => Finding;

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const sentencesOf = (doc: ProseDocument): Span[] => doc.sentences.map((sentence) => sentence.span);

const written = (doc: ProseDocument, span: Span): string => doc.source.slice(span.start, span.end);

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

/** The hour and minute units of unit-time, told apart by their weight in seconds. */
const unitsWeighing = (doc: ProseDocument, seconds: number): string[] =>
  (doc.lexicons["unit-time"] ?? []).filter((entry) => entry.weight === seconds).map((entry) => entry.pattern);

const lengthWords = (doc: ProseDocument): LengthWords => ({
  hourUnits: unitsWeighing(doc, SECONDS_PER_HOUR),
  minuteUnits: unitsWeighing(doc, SECONDS_PER_MINUTE),
  halves: patternsOf(doc, "length-half"),
  numberWords: patternsOf(doc, "count-number"),
});

export const lengthsOf = (doc: ProseDocument, text: string): TimeLength[] => timeLengths(text, lengthWords(doc));

/** The variant suffix for each way of writing the computed length: 4時間15分 takes none, 7時間 "-hours", 45分 "-minutes". */
const SHAPE_SUFFIX: Readonly<Record<ComputedLength["shape"], string>> = { "hours-minutes": "", hours: "-hours", minutes: "-minutes" };

const workingHoursFinding = (doc: ProseDocument, mismatch: WorkingHoursMismatch, finding: FindingOf): Finding[] => {
  const length = computedLength(mismatch.expected, mismatch.total.minutes);
  if (length === undefined) return [];
  const values = {
    start: written(doc, mismatch.start),
    end: written(doc, mismatch.end),
    break: written(doc, mismatch.break),
    total: written(doc, mismatch.total),
    ...length.values,
  };
  return [finding(doc, mismatch.total.start, values, `working-hours${SHAPE_SUFFIX[length.shape]}`)];
};

const workingHoursWords = (doc: ProseDocument): WorkingHoursWords => ({
  joiners: patternsOf(doc, "clock-range-joiner"),
  dayShifts: marksOf(doc, "day-shift-mark"),
  breaks: marksOf(doc, "working-hours-break"),
  totals: marksOf(doc, "working-hours-total"),
  approximate: marksOf(doc, "approximate-marker"),
});

const timesIn = (text: string): TimeSpan[] => clockTimes(text).map((time) => ({ start: time.start, end: time.end, seconds: secondsOf(time.key) }));

/** 始業から終業まで、休憩を除いた時間が、書いた実働と合わない。 */
const workingHoursOf = (doc: ProseDocument, text: string, finding: FindingOf): Finding[] =>
  workingHoursMismatches(text, doc.source, sentencesOf(doc), timesIn(text), lengthsOf(doc, text), workingHoursWords(doc)).flatMap((mismatch) =>
    workingHoursFinding(doc, mismatch, finding),
  );

const timesheetFinding = (doc: ProseDocument, mismatch: TimesheetMismatch, finding: FindingOf): Finding[] => {
  const times = { start: written(doc, mismatch.start), end: written(doc, mismatch.end), break: written(doc, mismatch.break) };
  if (mismatch.total === undefined) return [finding(doc, mismatch.break.start, times, "working-hours-break-longer")];
  const length = computedLength(mismatch.expected, mismatch.total.minutes);
  if (length === undefined) return [];
  return [
    finding(doc, mismatch.total.start, { ...times, total: written(doc, mismatch.total), ...length.values }, `working-hours${SHAPE_SUFFIX[length.shape]}`),
  ];
};

/** 勤務表の行（始業 | 終業 | 休憩 | 実働）の実働が、終わりから始まりと休憩を引いた長さと合わない。 */
const timesheetHoursOf = (doc: ProseDocument, text: string, finding: FindingOf): Finding[] => {
  const times = timesIn(text);
  const words = workingHoursWords(doc);
  const timeWords = { legs: [], columns: [], dayShifts: words.dayShifts, zones: [] };
  return timesheetHoursMismatches({
    text,
    times,
    ranges: clockRanges(text, times, words),
    columns: marksOf(doc, "shift-column"),
    overnight: showsOvernightWork(text, times, marksOf(doc, "overnight-work-mark"), timeWords),
    lengthOf: (cell, bareHours) => cellMinutes(cell, lengthsOf(doc, cell), bareHours),
  }).flatMap((mismatch) => timesheetFinding(doc, mismatch, finding));
};

/** 文の中の勤務時間と勤務表の行。同じ実働を両方から読んでも一度だけ言う。 */
export const workingHoursFindings = (doc: ProseDocument, text: string, finding: FindingOf): Finding[] => {
  const inline = workingHoursOf(doc, text, finding);
  const said = new Set(inline.map((found) => found.values?.["offset"]));
  return [...inline, ...timesheetHoursOf(doc, text, finding).filter((found) => !said.has(found.values?.["offset"]))];
};
