// Seeded contradictions for `yarn bench`: a document that disagrees with itself. Each plant is deterministic (the first
// candidate in the sample) and says on which line the rule should report it.
import { isListItem, linesOf, replaceLine, rewriteFirst, type Mutation, type Plant } from "./bench-text.ts";

// --- announced-count-mismatch ---

const ANNOUNCEMENT = /(?:次の|以下の|following )(?:\d+|[一二三四五]|two|three|four|five)/u;

/** The items of the list that starts at index, until the first line that is not an item. */
const itemsFrom = (lines: readonly string[], index: number): number[] => {
  const end = lines.findIndex((line, at) => at >= index && !isListItem(line));
  return Array.from({ length: (end < 0 ? lines.length : end) - index }, (_, offset) => index + offset);
};

/** 予告の文のすぐ下（空行を一つ挟んだ）箇条書きから、最後の項目を消す。予告の数は直さない。 */
const dropAnnouncedItem = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const announcement = lines.findIndex((line, at) => ANNOUNCEMENT.test(line) && lines[at + 1] === "" && isListItem(lines[at + 2] ?? ""));
  if (announcement < 0) return undefined;
  const last = itemsFrom(lines, announcement + 2).at(-1);
  return last === undefined ? undefined : { source: lines.filter((_, at) => at !== last).join("\n"), line: announcement + 1 };
};

// --- dangling-figure-reference ---

const CAPTION = /^(図|表|Figure |Table )(\d+)[\s:：]/u;
const REFERENCE = /(図|表|Figure |Table )(\d+)/u;

/** 本文の最初の参照の番号を、キャプションに無い番号（いちばん大きい番号の次）に書き換える。 */
const renumberReference = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const numbers = lines.flatMap((line) => {
    const caption = CAPTION.exec(line);
    return caption === null ? [] : [Number(caption[2])];
  });
  if (numbers.length === 0) return undefined;
  const missing = String(Math.max(...numbers) + 1);
  return rewriteFirst(
    source,
    (line) => !CAPTION.test(line) && REFERENCE.test(line),
    (line) => line.replace(REFERENCE, (_, label: string) => `${label}${missing}`),
  );
};

// --- date-range-reversed ---

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const DATE = `\\d{4}年\\d{1,2}月\\d{1,2}日|\\d{1,2} (?:${MONTHS}) \\d{4}`;
const PERIOD = new RegExp(`(${DATE})( ?[〜–] ?)(${DATE})`, "u");

/** 期間の始まりと終わりの日付を入れ替える。 */
const swapPeriod = (source: string): Plant | undefined =>
  rewriteFirst(
    source,
    (line) => PERIOD.test(line),
    (line) => line.replace(PERIOD, (_, start: string, joint: string, end: string) => `${end}${joint}${start}`),
  );

// --- percent-sum-mismatch ---

const SHARE_END = /(?<!\d)(\d{1,3})([%％])$/u;
const SHARE_SHIFT = 10;

const isShareItem = (line: string): boolean => isListItem(line) && SHARE_END.test(line);

/** 百分率の並ぶ箇条書きの最後の項目を 10 ポイント増やす。指摘は並びの最初の項目に出る。 */
const shiftShare = (source: string): Plant | undefined => {
  const lines = linesOf(source);
  const first = lines.findIndex((line, at) => isShareItem(line) && isShareItem(lines[at + 1] ?? ""));
  if (first < 0) return undefined;
  const last = itemsFrom(lines, first).at(-1);
  const line = last === undefined ? undefined : lines[last];
  if (last === undefined || line === undefined) return undefined;
  const shifted = line.replace(SHARE_END, (_, value: string, unit: string) => `${String(Number(value) + SHARE_SHIFT)}${unit}`);
  return { source: replaceLine(lines, last, shifted), line: first + 1 };
};

export const FACT_MUTATIONS: readonly Mutation[] = [
  { id: "announced-item-dropped", rule: "announced-count-mismatch", languages: ["ja", "en"], plant: dropAnnouncedItem },
  { id: "figure-renumbered", rule: "dangling-figure-reference", languages: ["ja", "en"], plant: renumberReference },
  { id: "period-swapped", rule: "date-range-reversed", languages: ["ja", "en"], plant: swapPeriod },
  { id: "share-shifted", rule: "percent-sum-mismatch", languages: ["ja", "en"], plant: shiftShare },
];
