import type { StructureIssue } from "./issues.ts";
import { linesOf } from "./lines.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { isReversed, rangeReading } from "./time-range.ts";
import { dayShiftOf, wordOffsets, type Mark, type TimeSpan, type TimeWords } from "./time-marks.ts";

/**
 * 勤務表のように、始まりと終わりの時刻を別の列に書いた表（始業 | 終業、Start | End）。列は見出しの名前で読む（語彙表 shift-column の
 * 組 start、end、hours、break）。行の終わりが始まりより前なら、どちらかの書き間違いか夜をまたぐ勤務。
 * 文書に夜をまたぐ勤務の印（夜勤、night shift、翌 6:00、24 時を超える時刻）があれば言わない。両方に同じ午前・午後を書いた行は書き間違い。
 * 実働の列があれば、夜をまたいで読んだ長さ（と、十二時間制で読んだ長さ）が実働と合わず、戻りが半日未満の行だけを言う。
 * 実働が読めなければ、文の中の範囲と同じく打ち間違いの幅の戻りだけを言う。
 */

const MINUTES_PER_HOUR = 60;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
const MINUTES_PER_HALF_DAY = 12 * MINUTES_PER_HOUR;
const SECONDS_PER_HALF_DAY = MINUTES_PER_HALF_DAY * SECONDS_PER_MINUTE;
/** 実働を小数の時間で書いたときの丸め（8.33 は 499.8 分）。 */
const ROUNDING_MINUTES = 3;
/** 翌日の印（「翌日 」）を探す、時刻の前の字数。 */
const DAY_SHIFT_LOOK_BACK = 4;

export type ShiftSide = "start" | "end" | "hours" | "break";

export type ShiftInputs = {
  readonly source: string;
  readonly times: readonly TimeSpan[];
  /** 列の見出しの名前。group が start、end、hours、break のどれか。 */
  readonly columns: readonly Mark[];
  /** 文書に夜をまたぐ勤務の印があるか。 */
  readonly overnight: boolean;
  /** 升に書いた長さ（8.0時間、1:00、8.00）を分で。読めなければ undefined。 */
  readonly lengthOf: (text: string) => number | undefined;
};

/** 見出しの升の後ろの括弧書き（「始業（時刻）」「Start (local)」）。列の名前はその前まで。 */
const NOTE_OPENER = /[(（[［]/u;

const columnName = (heading: string): string => {
  const note = heading.search(NOTE_OPENER);
  return (note === -1 ? heading : heading.slice(0, note)).trim().toLowerCase();
};

const columnOf = (header: readonly Cell[], columns: readonly Mark[], side: ShiftSide): number =>
  header.findIndex((cell) => columns.some((mark) => mark.group === side && mark.pattern.toLowerCase() === columnName(cell.text)));

/** 升に時刻だけを書いたときの、その時刻。 */
const onlyTime = (cell: Cell | undefined, times: readonly TimeSpan[], source: string): TimeSpan | undefined => {
  if (cell === undefined) return undefined;
  const within = times.filter((time) => time.start >= cell.start && time.end <= cell.end);
  const only = within.length === 1 ? within[0] : undefined;
  return only !== undefined && source.slice(only.start, only.end) === cell.text.trim() ? only : undefined;
};

type Row = { readonly start: TimeSpan; readonly end: TimeSpan; readonly hours: number | undefined; readonly break: number | undefined };

/** 実働と休憩から見て、夜をまたぐ勤務でも十二時間制の書き方でもない行か。 */
const hoursContradictOvernight = (row: Row, hours: number, rest: number): boolean => {
  const span = (row.end.seconds - row.start.seconds) / SECONDS_PER_MINUTE;
  const overnight = span + MINUTES_PER_DAY - rest;
  const twelveHour = span + MINUTES_PER_HALF_DAY - rest;
  return [overnight, twelveHour].every((reading) => Math.abs(hours - reading) > ROUNDING_MINUTES);
};

/** 実働か休憩が読めない行は、文の中の範囲と同じく打ち間違いの幅の戻りだけを言う。 */
const isReversedRow = (row: Row, inputs: ShiftInputs): boolean => {
  const reading = rangeReading(inputs.source, row.start, row.end);
  const back = reading.from - reading.to;
  if (back <= 0) return false;
  if (reading.sameHalf === true) return true;
  if (inputs.overnight) return false;
  if (row.hours === undefined || row.break === undefined) return isReversed(reading);
  return back < SECONDS_PER_HALF_DAY && hoursContradictOvernight(row, row.hours, row.break);
};

/** 列の升の長さ。列が無ければ休憩は 0、実働は読まない。 */
const lengthIn = (cells: readonly Cell[], column: number, inputs: ShiftInputs, absent: number | undefined): number | undefined => {
  if (column === -1) return absent;
  const cell = cells[column];
  return cell === undefined ? undefined : inputs.lengthOf(cell.text.trim());
};

type Labels = { readonly start: string; readonly end: string };

const issueOf = (row: Row, labels: Labels, source: string): StructureIssue => {
  const [start, end] = [source.slice(row.start.start, row.start.end), source.slice(row.end.start, row.end.end)];
  return { offset: row.end.start, values: { range: `${start} | ${end}`, start, end, start_label: labels.start, end_label: labels.end } };
};

/** 始まりの列と終わりの列を見出しから読む表の、終わりが始まりより前の行。終わりの時刻を指す。 */
export const reversedShiftRows = (inputs: ShiftInputs): StructureIssue[] =>
  tablesOf(linesOf(inputs.source)).flatMap((table) => {
    const header = cellsOf(table.header);
    const [starts, ends, hours, breaks] = (["start", "end", "hours", "break"] as const).map((side) => columnOf(header, inputs.columns, side));
    if (starts === undefined || ends === undefined || starts === -1 || ends === -1) return [];
    const labels = { start: header[starts]?.text.trim() ?? "", end: header[ends]?.text.trim() ?? "" };
    return table.rows.flatMap((line) => {
      const cells = cellsOf(line);
      const [start, end] = [onlyTime(cells[starts], inputs.times, inputs.source), onlyTime(cells[ends], inputs.times, inputs.source)];
      if (start === undefined || end === undefined) return [];
      const row = { start, end, hours: lengthIn(cells, hours ?? -1, inputs, undefined), break: lengthIn(cells, breaks ?? -1, inputs, 0) };
      return isReversedRow(row, inputs) ? [issueOf(row, labels, inputs.source)] : [];
    });
  });

/** 24 時を超える時刻（25:30）。夜をまたぐ勤務を当日の続きで書く書き方。 */
const PAST_MIDNIGHT = /(?<![\d:])(?:2[4-9]|3\d|4[0-7]):[0-5]\d(?!\d)/u;

/** 文書に夜をまたぐ勤務の印があるか。語（夜勤、night shift。語彙表 overnight-work-mark）、翌日の印を付けた時刻、24 時を超える時刻。 */
export const showsOvernightWork = (source: string, times: readonly TimeSpan[], marks: readonly Mark[], words: TimeWords): boolean => {
  const lower = source.toLowerCase();
  if (marks.some((mark) => wordOffsets(lower, mark.pattern.toLowerCase()).length > 0)) return true;
  if (PAST_MIDNIGHT.test(source)) return true;
  return times.some((time) => dayShiftOf(source.slice(Math.max(0, time.start - DAY_SHIFT_LOOK_BACK), time.start), source, time.end, words) > 0);
};
