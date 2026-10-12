import type { StructureIssue } from "./issues.ts";
import { labelPairsOf, pointsOutOfOrder, type OrderLabel, type PointOf, type PointPair } from "./labelled-order.ts";
import { dayShiftOf, SECONDS_PER_DAY, type DateSpan, type TimeSpan, type TimeWords } from "./time-marks.ts";

/**
 * Two labelled times of one day that must come in order: doors open before the show starts (開場 before 開演), check-in
 * opens before departure. A line (or a list item, or a table's first column) starting with an earlier-time word and one
 * starting with a later-time word, each with one time on it. Times of different days are not compared: a date written
 * between the two lines starts another day, and a later time more than half a day back is past midnight (23:30 then
 * 0:15). A time marked as the next day (翌 1:00, +1) counts a day on; one marked as the day before is not read. Pure.
 */

/** How many lines from the earlier time a later time may be and still be read as the same event's. */
const MAX_LINE_GAP = 10;
/** A later time further back than this is read as past midnight, as time-order reads a day's schedule. */
const HALF_DAY = SECONDS_PER_DAY / 2;
/** Digits enough for a few days of seconds, so the values sort as text. */
const PADDED = 8;

const sortable = (seconds: number): string => String(seconds).padStart(PADDED, "0");

type Inputs = { readonly source: string; readonly times: readonly TimeSpan[]; readonly dates: readonly DateSpan[]; readonly words: TimeWords };

/** The line's one time, counted from the day's start: a next-day mark adds a day. A line with two times states a range. */
const timeOf =
  ({ source, times, words }: Inputs): PointOf =>
  (line) => {
    const end = line.start + line.text.length;
    const onLine = times.filter((time) => time.start >= line.start && time.end <= end);
    const time = onLine.length === 1 ? onLine[0] : undefined;
    if (time === undefined) return undefined;
    const shift = dayShiftOf(source.slice(line.start, time.start), source, time.end, words);
    return shift < 0 ? undefined : { point: { offset: time.start, value: sortable(shift * SECONDS_PER_DAY + time.seconds) }, span: false };
  };

/** Whether the two times are of one day: no date between them, and the later one not more than half a day back. */
const sameDay =
  (dates: readonly DateSpan[]) =>
  ({ earlier, later }: PointPair): boolean => {
    const [first, second] = earlier.point.offset < later.point.offset ? [earlier, later] : [later, earlier];
    const between = dates.some((date) => date.start > first.point.offset && date.end <= second.point.offset);
    return !between && Number(earlier.point.value) - Number(later.point.value) <= HALF_DAY;
  };

const writtenAt = (source: string, times: readonly TimeSpan[], offset: number): string => {
  const time = times.find((candidate) => candidate.start === offset);
  return time === undefined ? "" : source.slice(time.start, time.end);
};

/**
 * Every pair of a timed-pair lexicon (group, position before and after, as dated-pair-label) whose later-labelled time is
 * before its earlier-labelled one on the same day. The issue is on the earlier-labelled time (doors open at 18:45): the
 * later one is the event's own time, the one a reader plans around and the one most often written again elsewhere.
 */
export const pairedTimesOutOfOrder = (inputs: Inputs, labels: readonly OrderLabel[]): StructureIssue[] =>
  labelPairsOf(labels).flatMap((pair) =>
    pointsOutOfOrder(inputs.source, { ...pair, passed: [], maxLineGap: MAX_LINE_GAP }, timeOf(inputs), sameDay(inputs.dates)).map(({ earlier, later }) => ({
      offset: earlier.point.offset,
      values: {
        time: writtenAt(inputs.source, inputs.times, earlier.point.offset),
        later: writtenAt(inputs.source, inputs.times, later.point.offset),
        earlier_label: earlier.label,
        later_label: later.label,
      },
    })),
  );
