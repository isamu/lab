import type { Detector, Finding, ProseDocument } from "../plugin.ts";
import type { StructureIssue } from "../structure/issues.ts";
import { inDocumentOrder } from "../structure/issues.ts";
import { clockTimes } from "../compare/clock-time.ts";
import { secondsOf, type DateSpan, type Mark, type TimeSpan, type TimeWords } from "../structure/time-marks.ts";
import { timeOrderBreaks } from "../structure/time-order.ts";
import { arrivalsBeforeDeparture } from "../structure/leg-times.ts";
import { quoteAt } from "./structure-tree.ts";

// 一日の予定の時刻の順番（time-order）と、発より前の着（arrival-before-departure）。時刻は compare/clock-time.ts が読み、
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

type Finder = (source: string, times: readonly TimeSpan[], dates: readonly DateSpan[], words: TimeWords) => StructureIssue[];

/** 表と箇条書きを行のまま読むので、原文を渡す（doc.prose は表を覆う）。 */
const detectorOf =
  (rule: string, find: Finder): Detector =>
  (doc): Finding[] =>
    find(doc.source, timesOf(doc.source), datesOf(doc), timeWordsOf(doc)).map((issue) => ({
      rule,
      severity: "warning",
      line: 0,
      column: 0,
      quote: quoteAt(doc.source, issue.offset),
      values: { ...issue.values, offset: issue.offset },
      ...("next" in issue.values ? { variant: "first" } : {}),
    }));

export const timeOrder: Detector = detectorOf("time-order", timeOrderBreaks);
export const arrivalBeforeDeparture: Detector = detectorOf("arrival-before-departure", arrivalsBeforeDeparture);
