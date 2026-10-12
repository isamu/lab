import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { clockTimes } from "../compare/clock-time.ts";
import { secondsOf, type DateSpan, type Mark, type TimeSpan, type TimeWords } from "../structure/time-marks.ts";
import { scheduleDays, timeOrderBreaks } from "../structure/time-order.ts";
import { arrivalOffsets, arrivalsBeforeDeparture } from "../structure/leg-times.ts";
import { shortConnections, type TravelLength, type TravelWords } from "../structure/connection-times.ts";
import { timeLengths } from "../derived/time-lengths.ts";
import { reversedTimeRanges } from "../structure/time-range.ts";
import { cellMinutes, reversedShiftRows, showsOvernightWork } from "../structure/shift-times.ts";
import { pairedTimesOutOfOrder } from "../structure/labelled-time-order.ts";
import { quoteAt, rangeWordsOf } from "./structure-tree.ts";

// 一日の予定の時刻の順番と、語の決まった二つの時刻の順番（time-order）、発より前の着（arrival-before-departure）、移動の時間より短い乗り継ぎ（connection-time-short）。時刻は compare/clock-time.ts が読み、
// 発着・翌日・時間帯の語は言語パッケージの語彙表（leg-mark、leg-column、day-shift-mark、time-zone、local-time-mark）から取る。

const marksOf = (doc: ProseDocument, lexicon: string): Mark[] =>
  (doc.lexicons[lexicon] ?? []).map((entry) => ({ pattern: entry.pattern, position: entry.position, group: entry.group }));

const timeWordsOf = (doc: ProseDocument): TimeWords => ({
  legs: marksOf(doc, "leg-mark"),
  columns: marksOf(doc, "leg-column"),
  dayShifts: marksOf(doc, "day-shift-mark"),
  zones: [...marksOf(doc, "time-zone"), ...marksOf(doc, "local-time-mark").map((mark) => ({ ...mark, group: "local" }))],
});

const datesOf = (doc: ProseDocument): DateSpan[] =>
  doc.structure === undefined
    ? []
    : inDocumentOrder(doc.structure).flatMap((node) =>
        node.kind === "date" ? [{ start: node.span.start, end: node.span.end, value: String(node.attrs["value"]) }] : [],
      );

const timesOf = (text: string): TimeSpan[] => clockTimes(text).map((time) => ({ start: time.start, end: time.end, seconds: secondsOf(time.key) }));

type Finder = (source: string, times: readonly TimeSpan[], dates: readonly DateSpan[], words: TimeWords, doc: ProseDocument) => StructureIssue[];

/** 先頭の時刻を次の時刻と比べたもの（first）、勤務表の始まりと終わりの列（columns）。それ以外は variant のまま。 */
const variantOf = (issue: StructureIssue, variant: string | undefined): string | undefined => {
  if (variant !== undefined) return variant;
  if ("next" in issue.values) return "first";
  return "end_label" in issue.values ? "columns" : undefined;
};

/** 表と箇条書きを行のまま読むので、原文を渡す（doc.prose は表を覆う）。 */
const detectorOf =
  (rule: string, find: Finder, variant?: string): Detector =>
  (doc): Finding[] =>
    find(doc.source, timesOf(doc.source), datesOf(doc), timeWordsOf(doc), doc).map((issue) => {
      const named = variantOf(issue, variant);
      return {
        rule,
        severity: "warning",
        line: 0,
        column: 0,
        quote: quoteAt(doc.source, issue.offset),
        values: { ...issue.values, offset: issue.offset },
        ...(named === undefined ? {} : { variant: named }),
      };
    });

const timeOrderInList: Detector = detectorOf("time-order", timeOrderBreaks);
/** 語の決まった二つの時刻（開場と開演）。語は語彙表 timed-pair-label から取る。 */
const timeOrderInPair: Detector = detectorOf(
  "time-order",
  (source, times, dates, words, doc) => pairedTimesOutOfOrder({ source, times, dates, words }, doc.lexicons["timed-pair-label"] ?? []),
  "pair",
);

export const timeOrder: Detector = (doc, options) => [...timeOrderInList(doc, options), ...timeOrderInPair(doc, options)];
export const arrivalBeforeDeparture: Detector = detectorOf("arrival-before-departure", arrivalsBeforeDeparture);
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

const patternsOf = (doc: ProseDocument, lexicon: string, weight?: number): string[] =>
  (doc.lexicons[lexicon] ?? []).filter((entry) => weight === undefined || entry.weight === weight).map((entry) => entry.pattern);

/** 時間と分の長さ（約10分、about 40 minutes）。単位は unit-time の重さ（秒）で時間と分に分ける。 */
const lengthsIn = (doc: ProseDocument, text: string): TravelLength[] =>
  timeLengths(text, {
    hourUnits: patternsOf(doc, "unit-time", SECONDS_PER_HOUR),
    minuteUnits: patternsOf(doc, "unit-time", SECONDS_PER_MINUTE),
    halves: patternsOf(doc, "length-half"),
    numberWords: patternsOf(doc, "count-number"),
  });

/** 升に書いた長さを分で。単位付き（8.0時間、9時間30分、8 hours）、時と分（1:00）、単位の無い時間（8.00）。 */
const cellLength = (doc: ProseDocument, text: string): number | undefined => cellMinutes(text, lengthsIn(doc, text), true);

/** 範囲に書いた時刻と、勤務表の始まりと終わりの列（語彙表 shift-column）。同じ時刻を両方から読んでも一度だけ言う。 */
export const timeRangeReversed: Detector = detectorOf("time-range-reversed", (source, times, _dates, words, doc) => {
  const inline = reversedTimeRanges(source, times, rangeWordsOf(doc), words);
  const rows = reversedShiftRows({
    source,
    times,
    columns: marksOf(doc, "shift-column"),
    overnight: showsOvernightWork(source, times, marksOf(doc, "overnight-work-mark"), words),
    lengthOf: (text) => cellLength(doc, text),
  }).filter((row) => !inline.some((issue) => issue.offset <= row.offset && row.offset < issue.offset + String(issue.values["range"]).length));
  return [...inline, ...rows].toSorted((left, right) => left.offset - right.offset);
});

const travelLengthsOf = (doc: ProseDocument): TravelLength[] => lengthsIn(doc, doc.source);

const travelWordsOf = (doc: ProseDocument): TravelWords => {
  const marks = marksOf(doc, "travel-time-word");
  return { cues: marks.filter((mark) => mark.group === "travel"), bounds: marks.filter((mark) => mark.group === "bound") };
};

export const connectionTimeShort: Detector = detectorOf("connection-time-short", (source, times, dates, words, doc) =>
  shortConnections({
    source,
    times,
    dates,
    words,
    travel: travelWordsOf(doc),
    lengths: travelLengthsOf(doc),
    arrivals: arrivalOffsets(source, times, dates, words),
    days: scheduleDays(source, times, dates, words),
  }),
);
