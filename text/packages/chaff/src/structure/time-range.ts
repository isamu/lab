import type { StructureIssue } from "./issues.ts";
import { isRange, type RangeWords } from "./date-range.ts";
import { dayShiftOf, type TimeSpan, type TimeWords } from "./time-marks.ts";

/**
 * 時刻の範囲の終わりが始まりより前（14:00〜13:30、2:00–1:30 pm、午後2時から午後1時半まで）。隣り合う二つの時刻の間が
 * 範囲の記号だけか、「から … まで」「from … to」のときを範囲と読む（date-range と同じ読み方）。変更の語のある文は読まない。
 * 終わりに翌日の印（翌、+1、next day）があれば日をまたぐ範囲で、言わない。印が無くても、三時間以上戻る終わりは
 * 夜をまたぐ範囲（22:00〜6:00 の夜勤、18:00〜9:00）か十二時間制の読み違い（9:00–5:00）と見て言わない。打ち間違いは一、二時間の戻り。
 * 片方にだけ午前・午後（a.m.、p.m.）を書いた範囲は、書いていない側も同じと読む（2:00–1:30 pm は 14:00 から 13:30）。
 * ただし正午をまたぐ書き方（8:00–6:00 pm）があるので、そのときは一時間未満の戻りだけを言う。
 */

const SECONDS_PER_HOUR = 3600;
/** 書いたまま読んだ範囲で、打ち間違いと見る戻りの上限。 */
const SLIP_SECONDS = 3 * SECONDS_PER_HOUR;
/** 午前・午後を片方から借りた範囲で、打ち間違いと見る戻りの上限。 */
const BORROWED_SLIP_SECONDS = SECONDS_PER_HOUR;
const NOON_SECONDS = 12 * SECONDS_PER_HOUR;
const ONE_OCLOCK_SECONDS = SECONDS_PER_HOUR;
const LAST_TWELVE_HOUR_SECONDS = 13 * SECONDS_PER_HOUR;

const MERIDIEM = /[ap]\.?m\b|午前|午後/iu;

const hasMeridiem = (source: string, time: TimeSpan): boolean => MERIDIEM.test(source.slice(time.start, time.end));

/** 午前・午後を書かず、十二時間制でも読める時刻（1:00〜12:59）。 */
const isTwelveHour = (time: TimeSpan): boolean => time.seconds >= ONE_OCLOCK_SECONDS && time.seconds < LAST_TWELVE_HOUR_SECONDS;

/** 午前・午後を書かない時刻を、もう片方の午前・午後で読む。 */
const borrowed = (bare: number, written: number): number => {
  const afternoon = written >= NOON_SECONDS;
  if (afternoon && bare < NOON_SECONDS) return bare + NOON_SECONDS;
  if (!afternoon && bare >= NOON_SECONDS) return bare - NOON_SECONDS;
  return bare;
};

type Reading = { readonly from: number; readonly to: number; readonly borrowed: boolean };

/** 範囲の二つの時刻を秒で。片方にだけ午前・午後があれば、もう片方もそれで読む。 */
export const rangeReading = (source: string, start: TimeSpan, end: TimeSpan): Reading => {
  const [startMarked, endMarked] = [hasMeridiem(source, start), hasMeridiem(source, end)];
  if (endMarked && !startMarked && isTwelveHour(start)) return { from: borrowed(start.seconds, end.seconds), to: end.seconds, borrowed: true };
  if (startMarked && !endMarked && isTwelveHour(end)) return { from: start.seconds, to: borrowed(end.seconds, start.seconds), borrowed: true };
  return { from: start.seconds, to: end.seconds, borrowed: false };
};

/** 終わりが始まりより前で、その戻りが打ち間違いの幅に収まるか。 */
export const isReversed = (reading: Reading): boolean => {
  const back = reading.from - reading.to;
  return back > 0 && back < (reading.borrowed ? BORROWED_SLIP_SECONDS : SLIP_SECONDS);
};

const asDated = (time: TimeSpan): { offset: number; end: number; value: string } => ({ offset: time.start, end: time.end, value: "" });

/** 隣り合う二つの時刻のうち、範囲をなし、終わりが始まりより前のもの。範囲の書き出しを指し、書いたままの範囲を見せる。 */
export const reversedTimeRanges = (source: string, times: readonly TimeSpan[], range: RangeWords, words: TimeWords): StructureIssue[] =>
  times.slice(1).flatMap((end, index) => {
    const start = times[index];
    if (start === undefined || !isRange(source, asDated(start), asDated(end), range, () => false)) return [];
    if (dayShiftOf(source.slice(start.end, end.start), source, end.end, words) !== 0 || !isReversed(rangeReading(source, start, end))) return [];
    const written = source.slice(start.start, end.end).replace(/\s+/gu, " ");
    return [{ offset: start.start, values: { range: written, start: source.slice(start.start, start.end), end: source.slice(end.start, end.end) } }];
  });
