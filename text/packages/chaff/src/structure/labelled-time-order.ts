import type { StructureIssue } from "./issues.ts";
import { labelPairsOf, pointsOutOfOrder, type OrderLabel, type PointOf, type PointPair } from "./labelled-order.ts";
import { crossesZones, dayShiftOf, withoutDayShiftBefore, zonesIn, SECONDS_PER_DAY, type DateSpan, type TimeSpan, type TimeWords } from "./time-marks.ts";

/**
 * Two labelled times of one day that must come in order: doors open before the show starts (開場 before 開演), the group
 * meets before it departs. A line (or a list item, or a table's first column) starting with an earlier-time word and one
 * starting with a later-time word, each with one time on it; each later time is compared with the earlier time written
 * closest to it, so a programme of two shows pairs each start with its own doors. Times of different days are not
 * compared: the date in force on each line (the last date written before its end) must be the same, and a later time
 * more than half a day back is past midnight (23:30 then 0:15). Two lines with different time-zone marks are not
 * compared. A time marked as the next day (翌 1:00, +1) counts a day on; one marked as the day before is not read. Pure.
 */

/** How many lines from the earlier time a later time may be and still be read as the same event's. */
const MAX_LINE_GAP = 10;
/** A later time further back than this is read as past midnight, as time-order reads a day's schedule. */
const HALF_DAY = SECONDS_PER_DAY / 2;
/** Digits enough for a few days of seconds, so the values sort as text. */
const PADDED = 8;

const sortable = (seconds: number): string => String(seconds).padStart(PADDED, "0");

type Inputs = { readonly source: string; readonly times: readonly TimeSpan[]; readonly dates: readonly DateSpan[]; readonly words: TimeWords };

/**
 * The line's one time, counted from the day's start: a next-day mark adds a day. A line with two times states a range.
 * The point starts at a next-day mark written before the time (翌0:30), so the message quotes it.
 */
const timeOf =
  ({ source, times, words }: Inputs): PointOf =>
  (line) => {
    const end = line.start + line.text.length;
    const onLine = times.filter((time) => time.start >= line.start && time.end <= end);
    const time = onLine.length === 1 ? onLine[0] : undefined;
    if (time === undefined) return undefined;
    const head = source.slice(line.start, time.start);
    const shift = dayShiftOf(head, source, time.end, words);
    const offset = line.start + withoutDayShiftBefore(head, words).length;
    return shift < 0 ? undefined : { point: { offset, value: sortable(shift * SECONDS_PER_DAY + time.seconds) }, span: false };
  };

const lineEndAt = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

const lineTextAt = (source: string, offset: number): string => source.slice(source.lastIndexOf("\n", offset - 1) + 1, lineEndAt(source, offset));

/** The date in force on a time's line: the last date written before the line ends, or "" before any date. */
const dayOf = (source: string, dates: readonly DateSpan[], offset: number): string => {
  const end = lineEndAt(source, offset);
  return dates.findLast((date) => date.start < end)?.value ?? "";
};

/** The line's time-zone marks, or undefined when the line crosses zones (two zones, 現地時間). */
const zoneOf = (text: string, words: TimeWords): string | undefined => {
  const zones = zonesIn(text, words);
  return crossesZones(zones) ? undefined : (zones[0]?.text ?? "");
};

/** Whether the two times can be compared: one date in force, one time zone, and the later time not more than half a day back. */
const comparable =
  ({ source, dates, words }: Inputs) =>
  ({ earlier, later }: PointPair): boolean => {
    const zone = zoneOf(lineTextAt(source, earlier.point.offset), words);
    return (
      dayOf(source, dates, earlier.point.offset) === dayOf(source, dates, later.point.offset) &&
      zone !== undefined &&
      zone === zoneOf(lineTextAt(source, later.point.offset), words) &&
      Number(earlier.point.value) - Number(later.point.value) <= HALF_DAY
    );
  };

/** The text of a point: from its start (a next-day mark, or the time) to the end of the time. */
const writtenAt = (source: string, times: readonly TimeSpan[], offset: number): string => {
  const time = times.find((candidate) => candidate.start >= offset);
  return time === undefined ? "" : source.slice(offset, time.end);
};

/**
 * Every pair of a timed-pair lexicon (group, position before and after, as dated-pair-label) whose later-labelled time is
 * before its earlier-labelled one on the same day. The issue is on the earlier-labelled time (doors open at 18:45): the
 * later one is the event's own time, the one a reader plans around and the one most often written again elsewhere.
 */
export const pairedTimesOutOfOrder = (inputs: Inputs, labels: readonly OrderLabel[]): StructureIssue[] =>
  labelPairsOf(labels).flatMap((pair) =>
    pointsOutOfOrder(inputs.source, { ...pair, passed: [], maxLineGap: MAX_LINE_GAP }, timeOf(inputs), {
      anchor: "nearest",
      related: comparable(inputs),
    }).map(({ earlier, later }) => ({
      offset: earlier.point.offset,
      values: {
        time: writtenAt(inputs.source, inputs.times, earlier.point.offset),
        later: writtenAt(inputs.source, inputs.times, later.point.offset),
        earlier_label: earlier.label,
        later_label: later.label,
      },
    })),
  );
