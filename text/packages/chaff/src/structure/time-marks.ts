import { escapeRegExp } from "../orthography.ts";

/**
 * 時刻のまわりに書く印を読む。発・着（departs、arr）、翌日（翌、+1、next day）、時間帯（JST、現地時間）。
 * 語は言語パッケージの語彙表（leg-mark、leg-column、day-shift-mark、time-zone、local-time-mark）から来る。ここは字面を照らすだけで、語を知らない。
 */

/** 語彙表の一語。position は時刻のどちら側に書くか、group は語の組（departure と arrival、next と previous、local）。 */
export type Mark = { readonly pattern: string; readonly position?: "before" | "after" | undefined; readonly group?: string | undefined };

/** 時刻と、その原文の範囲。seconds は 0 時からの秒。 */
export type TimeSpan = { readonly start: number; readonly end: number; readonly seconds: number };

/** 日付と、その原文の範囲。value は年月日、年月、月日のいずれか（2026-04-01、04-01）。 */
export type DateSpan = { readonly start: number; readonly end: number; readonly value: string };

/** legs は時刻の前後に書く発着の印、columns は表の発着の列の名前、dayShifts は翌日・前日の印、zones は時間帯の印。 */
export type TimeWords = {
  readonly legs: readonly Mark[];
  readonly columns: readonly Mark[];
  readonly dayShifts: readonly Mark[];
  readonly zones: readonly Mark[];
};

export const SECONDS_PER_DAY = 86_400;
const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_MINUTE = 60;

/** 「09:30」「21:05:10」の鍵を 0 時からの秒にする。 */
export const secondsOf = (key: string): number => {
  const [hour = 0, minute = 0, second = 0] = key.split(":").map(Number);
  return hour * SECONDS_PER_HOUR + minute * SECONDS_PER_MINUTE + second;
};

/** 語の端の字の種類。英字は英字と、数字は数字と続けば一つの語（dep と department、+1 と +10）。 */
const KINDS = [/[A-Za-z]/u, /[0-9０-９]/u];

const joins = (edge: string, beside: string): boolean => KINDS.some((kind) => kind.test(edge) && kind.test(beside));

/** text の at から pattern が、前後の字と続かない一語として書かれているか。 */
export const isWordAt = (text: string, at: number, pattern: string): boolean => {
  if (pattern === "" || !text.startsWith(pattern, at)) return false;
  return !joins(pattern.charAt(0), text.charAt(at - 1)) && !joins(pattern.charAt(pattern.length - 1), text.charAt(at + pattern.length));
};

/** text の中で pattern が語として書かれた位置。 */
export const wordOffsets = (text: string, pattern: string): number[] =>
  [...text.matchAll(new RegExp(escapeRegExp(pattern), "gu"))].flatMap((match) => (isWordAt(text, match.index, pattern) ? [match.index] : []));

const sidesOf = (marks: readonly Mark[], side: "before" | "after"): Mark[] => marks.filter((mark) => mark.position === side);

/** 長い語から照らす（「翌日」を「翌」より先に）。 */
const longestFirst = (marks: readonly Mark[]): Mark[] => marks.toSorted((left, right) => right.pattern.length - left.pattern.length);

/** 時刻のすぐ後ろ（間を空けない）に書いた印。「08:00発」の「発」。 */
export const markRightAfter = (text: string, end: number, marks: readonly Mark[]): Mark | undefined =>
  longestFirst(sidesOf(marks, "after")).find((mark) => isWordAt(text, end, mark.pattern));

/** 時刻の前の、間に letters 字までしか挟まない印。「departs Boston 7:30」の departs、「翌 0:15」の翌。 */
export const markBefore = (head: string, marks: readonly Mark[], letters: number): Mark | undefined => {
  const found = longestFirst(sidesOf(marks, "before")).flatMap((mark) =>
    wordOffsets(head, mark.pattern).map((at) => ({ mark, gap: head.length - at - mark.pattern.length })),
  );
  const nearest = found.filter((entry) => entry.gap >= 0 && entry.gap <= letters).toSorted((left, right) => left.gap - right.gap)[0];
  return nearest?.mark;
};

/** 時刻の後ろで、空白と開き括弧と発着の印を飛ばした所に書いた印。「0:15（翌日）」「9:50着 +1」。 */
const SKIPPED_AFTER = /^[\s(（[［]*/u;

export const markSoonAfter = (text: string, end: number, marks: readonly Mark[], skipped: readonly Mark[]): Mark | undefined => {
  const leg = markRightAfter(text, end, skipped);
  const from = end + (leg?.pattern.length ?? 0);
  const gap = SKIPPED_AFTER.exec(text.slice(from))?.[0].length ?? 0;
  return markRightAfter(text, from + gap, marks);
};

/** 日をまたぐ印の向き。翌日なら 1、前日なら -1、無ければ 0。 */
const shiftOf = (mark: Mark | undefined): number => {
  if (mark === undefined) return 0;
  return mark.group === "previous" ? -1 : 1;
};

/** 「翌 0:15」のように前に書く翌日は、間に空白一つまで。 */
const DAY_SHIFT_GAP = 1;

/** 時刻の前置きから、時刻の直前に書いた翌日・前日の印（「翌 」）を除いたもの。印が無ければそのまま。 */
export const withoutDayShiftBefore = (head: string, words: TimeWords): string => {
  const mark = markBefore(head, words.dayShifts, DAY_SHIFT_GAP);
  return mark === undefined ? head : head.slice(0, head.lastIndexOf(mark.pattern));
};

/** 時刻に付けた翌日・前日の印。head は時刻の前の原文、text と end は時刻の後ろを読むため。 */
export const dayShiftOf = (head: string, text: string, end: number, words: TimeWords): number =>
  shiftOf(markBefore(head, words.dayShifts, DAY_SHIFT_GAP) ?? markSoonAfter(text, end, words.dayShifts, words.legs));

/** 時間帯の印に続けて書いた時差（UTC+9、GMT-5:00）。時差まで含めて一つの時間帯と読む。 */
const ZONE_OFFSET = /^[+\-−＋]\d{1,2}(?::?\d{2})?/u;

/** 書かれた時間帯。text は時差まで含めた字面。 */
export type Zone = { readonly text: string; readonly group?: string | undefined };

type ZoneSpan = Zone & { readonly start: number; readonly end: number };

const zoneSpansOf = (text: string, mark: Mark): ZoneSpan[] =>
  wordOffsets(text, mark.pattern).map((start) => {
    const after = start + mark.pattern.length;
    const offset = ZONE_OFFSET.exec(text.slice(after))?.[0] ?? "";
    return { start, end: after + offset.length, text: mark.pattern + offset, group: mark.group };
  });

/** text に書かれた時間帯の印（JST、UTC+9、現地時間）。同じ字面は一度だけ。長い語から照らし、短い語が長い語の中で重ねて読まれない。 */
export const zonesIn = (text: string, words: TimeWords): Zone[] => {
  const spans = longestFirst(words.zones).reduce<ZoneSpan[]>(
    (taken, mark) => [...taken, ...zoneSpansOf(text, mark).filter((span) => !taken.some((other) => span.start < other.end && other.start < span.end))],
    [],
  );
  return spans
    .filter((span, index) => spans.findIndex((other) => other.text === span.text) === index)
    .map(({ text: written, group }) => ({ text: written, group }));
};

/**
 * 時間帯をまたぐ行か。違う時間帯の印が二つ以上あるか、「現地時間」のように時間帯がどこかを言わない印（組 local）があれば、
 * 時刻をそのまま比べられない。
 */
export const crossesZones = (zones: readonly Zone[]): boolean => zones.length >= 2 || zones.some((mark) => mark.group === "local");
