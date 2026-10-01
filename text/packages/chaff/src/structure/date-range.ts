import { escapeRegExp } from "../orthography.ts";
import type { StructureIssue } from "./issues.ts";

/**
 * 期間の終わりが始まりより前。二つの日付の間が範囲の記号（〜、–、through）だけか、開きの語（から）で終わりの日付に閉じの語（まで）が続くときを期間と読む。
 * 比べるのは、両方が年月日か、両方が年月のときだけ。年の無い期間（12月28日〜1月4日）は年をまたぐかもしれない。
 * 言語の知識（範囲の記号と語）は語彙表から受け取る。
 */
export type DatedSpan = { readonly offset: number; readonly end: number; readonly value: string };

export type RangeWords = {
  /** それだけで期間を作る記号と語。 */
  readonly connectors: readonly string[];
  /** 終わりの日付に閉じの語が続くときだけ期間を作る語（から）。 */
  readonly openers: readonly string[];
  readonly closers: readonly string[];
  /** 始まりの日付の前の語と、二つの日付の間の語の組で期間を作るもの（from … to、between … and）。 */
  readonly frames: readonly RangeFrame[];
  /** 同じ文にあれば、組を期間ではなく日付の変更と読む語（moved from … to、… was postponed）。 */
  readonly changes: readonly string[];
};

export type RangeFrame = { readonly lead: string; readonly joint: string };

/** 語彙表の「from … to」を、前の語と間の語に分ける。「…」の無い語は組ではない。 */
export const rangeFrameOf = (pattern: string): RangeFrame | undefined => {
  const [lead, joint, ...rest] = pattern.split("…").map((part) => part.trim().toLowerCase());
  return lead === undefined || joint === undefined || lead === "" || joint === "" || rest.length > 0 ? undefined : { lead, joint };
};

const COMPARABLE = [/^\d{4}-\d{2}-\d{2}$/u, /^\d{4}-\d{2}$/u];

const comparable = (start: string, end: string): boolean => COMPARABLE.some((pattern) => pattern.test(start) && pattern.test(end));

/** 日付に添えた曜日（（水））と時刻（10:00）は、期間のつなぎ目ではないので読み飛ばす。 */
const ASIDES = /[（(][^（()）\n]{1,6}[）)]|\d{1,2}[:：]\d{2}/gu;

const bare = (text: string): string => text.replace(ASIDES, "").trim().toLowerCase();

const isOneOf = (text: string, words: readonly string[]): boolean => words.some((word) => word.toLowerCase() === text);

/** 行の終わりまでの、終わりの日付の後ろ。曜日と時刻を除いてから閉じの語を探す。 */
const closedAfter = (source: string, end: DatedSpan, closers: readonly string[]): boolean => {
  const lineEnd = source.indexOf("\n", end.end);
  const after = source
    .slice(end.end, lineEnd === -1 ? source.length : lineEnd)
    .replace(ASIDES, "")
    .trimStart();
  return closers.some((closer) => after.startsWith(closer));
};

/**
 * 二つの日付の間のつなぎ。行をまたぐなら、つなぎは前の行の終わりにあり、次の行は終わりの日付から始まるときだけ（期間は2026年4月1日〜↵2026年3月31日）。
 * 次の行の頭の「- 」は箇条書きの印で、範囲の記号ではない（日付を並べた一覧）。
 */
const jointOf = (source: string, start: DatedSpan, end: DatedSpan): string | undefined => {
  const [first = "", ...next] = source.slice(start.end, end.offset).split("\n");
  return next.every((line) => line.trim() === "") ? bare(first) : undefined;
};

/** 英字の語は語の切れ目で照らす（from が therefrom に当たらず、moved が removed に当たらない）。 */
const wordPattern = (word: string, tail: string): RegExp => new RegExp(`(?<![a-z])${escapeRegExp(word)}(?![a-z])${tail}`, "u");

const endsWithWord = (text: string, word: string): boolean => wordPattern(word, "$").test(text);

const hasWord = (text: string, word: string): boolean => wordPattern(word, "").test(text);

/** 段落の切れ目（空行）。 */
const PARAGRAPH_BREAK = "\n\n";

/** 文の終わり。後ろが大文字のときだけ切る（"in Jan. from" は切らない）。切りそこねると文が長くなり、変更の語を見つけやすくなるだけ。 */
const SENTENCE_BREAK = /[.!?]\s+(?=[A-Z])/gu;

/** 二つの日付を含む文（小文字、空白は一つに）と、その中の始まりの日付の位置。行の折り返しをまたいで読む。 */
const sentenceAround = (source: string, start: DatedSpan, end: DatedSpan): { readonly text: string; readonly before: string } => {
  const previousBreak = source.lastIndexOf(PARAGRAPH_BREAK, start.offset);
  const paragraphStart = previousBreak === -1 ? 0 : previousBreak + PARAGRAPH_BREAK.length;
  const paragraphEnd = source.indexOf(PARAGRAPH_BREAK, end.end);
  const head = source.slice(paragraphStart, start.offset);
  const tail = source.slice(end.end, paragraphEnd === -1 ? source.length : paragraphEnd);
  const from = [...head.matchAll(SENTENCE_BREAK)].map((match) => match.index + match[0].length).at(-1) ?? 0;
  const to = [...tail.matchAll(SENTENCE_BREAK)][0]?.index ?? tail.length;
  const flat = (text: string): string => text.replace(/\s+/gu, " ").toLowerCase();
  return { text: flat(source.slice(paragraphStart + from, end.end + to)), before: flat(head.slice(from)).trimEnd() };
};

/** 前の語と間の語の組（from … to）。同じ文のどこかに変更の語（moved、postponed）があれば、日付を動かした文で、期間ではない。 */
const framed = (source: string, start: DatedSpan, end: DatedSpan, joint: string, words: RangeWords): boolean => {
  const sentence = sentenceAround(source, start, end);
  const frame = words.frames.find((candidate) => candidate.joint === joint && endsWithWord(sentence.before, candidate.lead));
  return frame !== undefined && !words.changes.some((change) => hasWord(sentence.text, change.toLowerCase()));
};

const isRange = (source: string, start: DatedSpan, end: DatedSpan, words: RangeWords): boolean => {
  const joint = jointOf(source, start, end);
  if (joint === undefined) return false;
  return (
    isOneOf(joint, words.connectors) || (isOneOf(joint, words.openers) && closedAfter(source, end, words.closers)) || framed(source, start, end, joint, words)
  );
};

/** 書いたままの期間。行をまたいだ期間は一行にする。 */
const writtenPeriod = (source: string, start: DatedSpan, end: DatedSpan): string =>
  source
    .slice(start.offset, end.end)
    .split("\n")
    .map((part) => part.trim())
    .join(" ");

/** 隣り合う二つの日付のうち、期間をなし、終わりが始まりより前のもの。期間の書き出しを指し、書いたままの期間を見せる。 */
export const reversedRanges = (source: string, dates: readonly DatedSpan[], words: RangeWords): StructureIssue[] =>
  dates.slice(1).flatMap((end, index) => {
    const start = dates[index];
    if (start === undefined || !comparable(start.value, end.value) || end.value >= start.value) return [];
    if (!isRange(source, start, end, words)) return [];
    return [{ offset: start.offset, values: { start: start.value, end: end.value, period: writtenPeriod(source, start, end) } }];
  });
