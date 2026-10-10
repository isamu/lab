import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { withoutTrailingWeekday, type RangeWords } from "../structure/date-range.ts";

/**
 * 日付が三つ以上ある文で、始まりと終わりを語で印した二つ（「お買い上げ日が7月1日の場合、7月1日から12か月（7月31日まで）」）。
 * 始まりの印は、日付の後ろの開きの語（から）か、前の枠の前の語（from）。終わりの印は、後ろの閉じの語（まで）か、前のつなぎの語
 * （〜、until）や枠の間の語（to）、または期間のすぐ後ろで開いた括弧。語は語彙表（range-opener、range-closer、range-connector、
 * range-frame）から受け取る。
 */
export type MarkText = { readonly source: string; readonly range: RangeWords };

/** 印の語を探す、日付の前後の字数。印の語はこれより短い。 */
const MARK_REACH = 40;
const OPEN_BRACKETS: readonly string[] = ["（", "("];
const CLOSE_BRACKETS: readonly string[] = ["）", ")"];
const LATIN = /\p{Script=Latin}/u;

/** 語が書いてあるか。ラテン文字の端は、隣がラテン文字でないときだけ（"from" は "therefrom" の終わりではない）。 */
const hasWord = (text: string, word: string, where: "start" | "end" | "anywhere"): boolean => {
  if (word === "") return false;
  const head = LATIN.test(word.charAt(0)) ? "(?<!\\p{Script=Latin})" : "";
  const tail = LATIN.test(word.at(-1) ?? "") ? "(?!\\p{Script=Latin})" : "";
  const body = `${head}${escapeRegExp(word)}${tail}`;
  const anchored = { start: `^${body}`, end: `${body}$`, anywhere: body }[where];
  return new RegExp(anchored, "iu").test(text);
};

const before = (text: MarkText, date: Span): string =>
  withoutTrailingWeekday(text.source.slice(Math.max(0, date.start - MARK_REACH), date.start).trimEnd(), text.range.weekdays ?? []);

const after = (text: MarkText, date: Span): string => text.source.slice(date.end, date.end + MARK_REACH).trimStart();

const isStart = (text: MarkText, date: Span): boolean =>
  text.range.openers.some((word) => hasWord(after(text, date), word, "start")) ||
  text.range.frames.some((frame) => hasWord(before(text, date), frame.lead, "end"));

/** 期間のすぐ後ろの括弧が、日付だけを囲む（12か月（2027年6月30日））。日付で始まる注（(May 15, 2026 billing notice)）は終わりではない。 */
const bracketAfterLength = (text: MarkText, date: Span, length: Span): boolean =>
  length.end <= date.start &&
  OPEN_BRACKETS.includes(text.source.slice(length.end, date.start).trim()) &&
  CLOSE_BRACKETS.some((bracket) => after(text, date).startsWith(bracket));

/** 文に変更の語（moved、postponed）があれば、日付を動かした文で、期間ではない。 */
const isChange = (text: MarkText, sentence: Span): boolean =>
  text.range.changes.some((word) => hasWord(text.source.slice(sentence.start, sentence.end), word, "anywhere"));

const isEnd = (text: MarkText, date: Span, length: Span): boolean =>
  text.range.closers.some((word) => hasWord(after(text, date), word, "start")) ||
  [...text.range.connectors, ...text.range.frames.map((frame) => frame.joint)].some((word) => hasWord(before(text, date), word, "end")) ||
  bracketAfterLength(text, date, length);

/** 始まりの印の日付と終わりの印の日付が一つずつで、別の日付のときだけ、その組。 */
export const markedPair = <T extends Span>(text: MarkText, sentence: Span, dates: readonly T[], length: Span): readonly [T, T] | undefined => {
  if (isChange(text, sentence)) return undefined;
  const starts = dates.filter((date) => isStart(text, date));
  const ends = dates.filter((date) => isEnd(text, date, length));
  const [start] = starts;
  const [end] = ends;
  return starts.length === 1 && ends.length === 1 && start !== undefined && end !== undefined && start !== end ? [start, end] : undefined;
};
