import type { StructureIssue } from "./issues.ts";
import { runsOf, type Line } from "./runs.ts";
import { longestInOrder, outOfPlace } from "./date-order.ts";
import { crossesZones, dayShiftOf, withoutDayShiftBefore, zonesIn, SECONDS_PER_DAY, type DateSpan, type TimeSpan, type TimeWords } from "./time-marks.ts";

/**
 * 一日の予定として並べた時刻の順番。箇条書きの続いた項目と表の続いた行のうち、頭に時刻を書いたもの（「- 09:00 集合」
 * 「| 2月9日 09:30 | 受付 |」）を並びとして読む。一日の予定は早い順に並ぶので、向きは決めずに早い順と見る。
 * 日付の見出しが変われば並びは切れる。行の頭に書いた日付が変わるところ（表の日付の列）、時間帯の印が変わるところでも切る。
 * 23:30 の次の 0:15 は、翌日の印（翌、+1、next day）があれば翌日の時刻と読む。印が無くても、半日より大きく戻る時刻は
 * 夜をまたいだものと読み、言わない。打ち間違いの多くは数時間の戻りで、半日を超えて戻る予定は夜通しの予定のほうが多い。
 * 早い順に並ぶ時刻が半分以下の並びは、時刻で並べた一覧ではないとして何も言わない。
 */

/** 頭に時刻を書いた項目。seconds は 0 時からの秒、shift は翌日の印（1）か無印（0）。 */
type Stop = {
  readonly offset: number;
  readonly written: string;
  readonly seconds: number;
  readonly shift: number;
  readonly date: string | undefined;
  readonly zone: string;
  /** 「09:00–10:30」のように範囲で書いた時刻の終わり。範囲でなければ無い。 */
  readonly until: number | undefined;
};

/** 並びとして言うのに要る時刻の数。二つでは、どちらが外れたかも、並べたものかどうかも決められない。 */
const MIN_STOPS = 3;
/** 印の無い戻りを夜をまたいだと読む幅。 */
const HALF_DAY = SECONDS_PER_DAY / 2;
/** 頭の日付と時刻の間に挟んでよい字（曜日「Monday,」「（火）」）。 */
const LEAD_BESIDE_DATE = 12;

const ITEM_OPENER = /^[ \t]*(?:(?:[-*+]|\d{1,3}[.)])[ \t]+|\|)?/u;
const MARKS_ONLY = /^[\s\p{P}\p{S}]*$/u;
const DIGIT = /[0-9０-９]/u;

/** 頭に書いた日付を除いた残り。日付があれば短い曜日まで、無ければ記号と空白だけなら、時刻が項目の頭にある。 */
const leadsWithTime = (lead: string, leadStart: number, dates: readonly DateSpan[]): boolean => {
  if (lead.includes("|")) return false;
  const inLead = dates.filter((date) => date.start >= leadStart && date.end <= leadStart + lead.length);
  const rest = inLead.reduceRight((text, date) => text.slice(0, date.start - leadStart) + text.slice(date.end - leadStart), lead).trim();
  if (inLead.length === 0) return MARKS_ONLY.test(rest);
  return !DIGIT.test(rest) && rest.length <= LEAD_BESIDE_DATE;
};

const zoneKeyOf = (text: string, words: TimeWords): string | undefined => {
  const zones = zonesIn(text, words);
  if (zones.length >= 2) return undefined;
  return crossesZones(zones) ? `local:${zones[0]?.text ?? ""}` : (zones[0]?.text ?? "");
};

type Inputs = { readonly source: string; readonly times: readonly TimeSpan[]; readonly dates: readonly DateSpan[]; readonly words: TimeWords };

/** 時刻と時刻の間が範囲の印だけなら、後ろの時刻は範囲の終わり。 */
const RANGE_GAP = /^\s?[-–—~〜～]\s?$/u;

const rangeEndOf = (source: string, time: TimeSpan, times: readonly TimeSpan[]): number | undefined => {
  const next = times.find((candidate) => candidate.start >= time.end);
  return next !== undefined && RANGE_GAP.test(source.slice(time.end, next.start)) ? next.seconds : undefined;
};

/** 行の頭の時刻。頭に時刻が無い行、時間帯の印が二つある行、前日の印の付いた時刻は並びに入れない。 */
const stopOf = (line: Line, inputs: Inputs): Stop | undefined => {
  const { source, times, dates, words } = inputs;
  const text = source.slice(line.start, line.end);
  const time = times.find((candidate) => candidate.start >= line.start && candidate.end <= line.end);
  const leadStart = line.start + (ITEM_OPENER.exec(text)?.[0].length ?? 0);
  if (time === undefined || !leadsWithTime(withoutDayShiftBefore(source.slice(leadStart, time.start), words), leadStart, dates)) return undefined;
  const zone = zoneKeyOf(text, words);
  const shift = dayShiftOf(source.slice(line.start, time.start), source, time.end, words);
  if (zone === undefined || shift < 0) return undefined;
  const date = dates.filter((span) => span.start >= leadStart && span.end <= time.start).at(-1)?.value;
  const until = rangeEndOf(source, time, times);
  return { offset: time.start, written: source.slice(time.start, time.end), seconds: time.seconds, shift, date, zone, until };
};

/** 一日の並びを切る所: 頭の日付が前と違う、時間帯の印が前と違う。 */
const startsNewDay = (stop: Stop, day: readonly Stop[]): boolean => {
  const last = day.at(-1);
  if (last === undefined) return false;
  const lastDate = day.findLast((earlier) => earlier.date !== undefined)?.date;
  return (stop.date !== undefined && lastDate !== undefined && stop.date !== lastDate) || stop.zone !== last.zone;
};

const daysOf = (stops: readonly Stop[]): Stop[][] =>
  stops.reduce<Stop[][]>((days, stop) => {
    const day = days.at(-1) ?? [];
    return startsNewDay(stop, day) ? [...days, [stop]] : [...days.slice(0, -1), [...day, stop]];
  }, []);

/**
 * 並びの中の、日をまたいだ秒。翌日の印のある時刻は翌日、印の無い時刻は前の時刻と同じ日。
 * 前の時刻より半日を超えて戻る無印の時刻は、夜をまたいだ翌日の時刻。
 */
export const elapsedSeconds = (stops: readonly { readonly seconds: number; readonly shift: number }[]): number[] =>
  stops
    .reduce<{ day: number; seconds: number }[]>((placed, stop) => {
      const previous = placed.at(-1);
      const rolled = previous !== undefined && previous.seconds - stop.seconds > HALF_DAY ? previous.day + 1 : (previous?.day ?? 0);
      return [...placed, { day: stop.shift > 0 ? Math.max(rolled, stop.shift) : rolled, seconds: stop.seconds }];
    }, [])
    .map((placed) => placed.day * SECONDS_PER_DAY + placed.seconds);

/** 文字の並びで比べられるよう、秒を桁をそろえた文字にする。 */
const PADDED = 8;
const sortable = (seconds: number): string => String(seconds).padStart(PADDED, "0");

/** 外れた時刻に、前の時刻を添える。先頭の時刻には前が無いので、次の時刻を添える。 */
const issueAt = (day: readonly Stop[], at: number): StructureIssue[] => {
  const stop = day[at];
  if (stop === undefined) return [];
  const neighbour = at === 0 ? { next: day[1]?.written ?? "" } : { previous: day[at - 1]?.written ?? "" };
  return [{ offset: stop.offset, values: { time: stop.written, ...neighbour } }];
};

/**
 * 範囲で書いた時刻の並びで、前の範囲が終わる前に次が始まる一歩が半分を超えるもの。曜日ごとの営業時間（9:00–18:00 が続く）
 * のように時刻で並べたものではない一覧で、一日の予定ではない。
 */
export const isOverlappingRanges = (ranges: readonly { readonly seconds: number; readonly until: number | undefined }[]): boolean => {
  const steps = ranges.slice(1).map((range, index) => ranges[index]?.until !== undefined && range.seconds < (ranges[index]?.until ?? 0));
  return steps.length > 0 && steps.filter(Boolean).length * 2 > steps.length;
};

/** 早い順に逆らう一歩ごとに、並びから外れた時刻を指す。早い順に並ぶ時刻が半分以下の並びと、重なる範囲の並びは言わない。 */
const breaksIn = (day: readonly Stop[]): StructureIssue[] => {
  const values = elapsedSeconds(day).map(sortable);
  if (values.length < MIN_STOPS || longestInOrder(values, 1) * 2 <= values.length || isOverlappingRanges(day)) return [];
  return values.slice(1).flatMap((value, index) => (value < (values[index] ?? "") ? issueAt(day, outOfPlace(values, index + 1, 1)) : []));
};

/** 一日の予定の時刻のうち、早い順から外れたもの。 */
export const timeOrderBreaks = (source: string, times: readonly TimeSpan[], dates: readonly DateSpan[], words: TimeWords): StructureIssue[] => {
  const inputs = { source, times, dates, words };
  return runsOf(source).flatMap((run) => {
    const stops = run.flatMap((line) => stopOf(line, inputs) ?? []);
    return daysOf(stops).flatMap(breaksIn);
  });
};
