import type { Span } from "../plugin.ts";
import { linesOf } from "../structure/lines.ts";
import { cellsOf, tablesOf, type Cell } from "../facts/table-facts.ts";
import { columnOf, hasHeadingNote, onlyTime } from "../structure/shift-times.ts";
import { rangeReading } from "../structure/time-range.ts";
import type { Mark, TimeSpan } from "../structure/time-marks.ts";
import type { ClockRange } from "./working-hours.ts";

/**
 * 勤務表の行の実働（始業 | 終業 | 休憩 | 実働、Start | End | Break | Hours）を、終わりから始まりと休憩を引いた長さと比べる。
 * 列は見出しの名前で読む（語彙表 shift-column）。始まりと終わりの列が無ければ、一つの升に書いた範囲（9:30〜18:30）を読む。
 * 休憩の列と実働の列が両方ある表だけを読み、どれかの升が読めない行は言わない（休憩が勤務より長い行は実働を読まずに言う）。休憩の升の単位の無い数（30）は分か時間か
 * 分からないので読まない。片方にだけ午前・午後を書いた行も読まない。終わりが始まりより前の行は、文書に夜をまたぐ勤務の印が
 * あるときだけ日をまたいで読み、無ければ言わない（time-range-reversed が見る）。Pure.
 */

const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_DAY = 24 * 60;
/** 実働を小数の時間で書いたときの丸め（8.33 は 499.8 分）。 */
const ROUNDING_MINUTES = 3;

export type TimesheetInputs = {
  readonly text: string;
  readonly times: readonly TimeSpan[];
  /** 一つの升に書いた時刻の範囲（9:30〜18:30）。 */
  readonly ranges: readonly ClockRange[];
  readonly columns: readonly Mark[];
  readonly overnight: boolean;
  /** 升に書いた長さを分で。bareHours なら単位の無い数（8.00）も時間と読む。 */
  readonly lengthOf: (text: string, bareHours: boolean) => number | undefined;
};

export type TimesheetMismatch = {
  readonly start: Span;
  readonly end: Span;
  readonly break: Span;
  /** 休憩が勤務より長い行では読まない。 */
  readonly total?: Span & { readonly minutes: number };
  /** 終わりから始まりと休憩を引いた分。負なら休憩が勤務より長い。 */
  readonly expected: number;
};

type Columns = { readonly start: number; readonly end: number; readonly hours: number; readonly break: number; readonly bareHours: boolean };

const trimmed = (cell: Cell): Span & { readonly text: string } => {
  const text = cell.text.trim();
  const start = cell.start + cell.text.indexOf(text);
  return { start, end: start + text.length, text };
};

/** 始まりと終わりの列の時刻。十二時間制の片方にだけ午前・午後を書いた組は読まない。 */
const columnTimes = (cells: readonly Cell[], columns: Columns, inputs: TimesheetInputs) => {
  const [from, to] = [onlyTime(cells[columns.start], inputs.times, inputs.text), onlyTime(cells[columns.end], inputs.times, inputs.text)];
  if (from === undefined || to === undefined) return undefined;
  const reading = rangeReading(inputs.text, from, to);
  return reading.borrowed ? undefined : { from, to, minutes: (reading.to - reading.from) / SECONDS_PER_MINUTE };
};

/** 一つの升に範囲だけを書いた行の、その範囲。実働と休憩の列のほかに、そういう升が一つだけのときに読む。 */
const rangeTimes = (cells: readonly Cell[], columns: Columns, inputs: TimesheetInputs) => {
  const others = cells.filter((_cell, index) => index !== columns.hours && index !== columns.break);
  const found = others.flatMap((cell) => {
    const within = trimmed(cell);
    return inputs.ranges.filter((range) => range.start === within.start && range.end === within.end);
  });
  const range = found.length === 1 ? found[0] : undefined;
  if (range === undefined || rangeReading(inputs.text, range.from, range.to).borrowed) return undefined;
  return { from: range.from, to: range.to, minutes: range.minutes ?? (range.to.seconds - range.from.seconds) / SECONDS_PER_MINUTE };
};

/** 勤務の長さ。日をまたぐ行は、夜をまたぐ勤務の印のある文書でだけ読む。 */
const shiftMinutes = (minutes: number, overnight: boolean): number | undefined => {
  if (minutes > 0) return minutes;
  return overnight && minutes < 0 ? minutes + MINUTES_PER_DAY : undefined;
};

const lengthCell = (cell: Cell | undefined, inputs: TimesheetInputs, bareHours: boolean) => {
  if (cell === undefined) return undefined;
  const span = trimmed(cell);
  const minutes = inputs.lengthOf(span.text, bareHours);
  return minutes === undefined ? undefined : { ...span, minutes };
};

const rowMismatch = (cells: readonly Cell[], columns: Columns, inputs: TimesheetInputs): TimesheetMismatch | undefined => {
  const times = columns.start === -1 ? rangeTimes(cells, columns, inputs) : columnTimes(cells, columns, inputs);
  const shift = times === undefined ? undefined : shiftMinutes(times.minutes, inputs.overnight);
  const breakLength = lengthCell(cells[columns.break], inputs, false);
  const total = lengthCell(cells[columns.hours], inputs, columns.bareHours);
  if (times === undefined || shift === undefined || breakLength === undefined) return undefined;
  const expected = shift - breakLength.minutes;
  if (expected < 0) return { start: times.from, end: times.to, break: breakLength, expected };
  if (total === undefined || Math.abs(expected - total.minutes) <= ROUNDING_MINUTES) return undefined;
  return { start: times.from, end: times.to, break: breakLength, total, expected };
};

const columnsOf = (header: readonly Cell[], marks: readonly Mark[]): Columns | undefined => {
  const [start, end, hours, rest] = (["start", "end", "hours", "break"] as const).map((side) => columnOf(header, marks, side));
  if (start === undefined || end === undefined || hours === undefined || rest === undefined || hours === -1 || rest === -1) return undefined;
  if ((start === -1) !== (end === -1)) return undefined;
  return { start, end, hours, break: rest, bareHours: !hasHeadingNote(header[hours]?.text ?? "") };
};

/** 勤務表の行で、実働が終わり − 始まり − 休憩と合わないもの、休憩が勤務より長いもの。 */
export const timesheetHoursMismatches = (inputs: TimesheetInputs): TimesheetMismatch[] =>
  tablesOf(linesOf(inputs.text)).flatMap((table) => {
    const columns = columnsOf(cellsOf(table.header), inputs.columns);
    if (columns === undefined) return [];
    return table.rows.flatMap((line) => {
      const mismatch = rowMismatch(cellsOf(line), columns, inputs);
      return mismatch === undefined ? [] : [mismatch];
    });
  });
