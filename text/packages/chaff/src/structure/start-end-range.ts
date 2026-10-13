import { escapeRegExp } from "../orthography.ts";
import { bare, withoutTrailingWeekday, type DatedSpan } from "./date-range.ts";

/**
 * 始まりの語と終わりの語で書いた期間（The term starts on 1 April 2026 and ends on 31 March 2027、2026年4月1日から開始し、2027年3月31日に終了する）。
 * 一つ目の日付に始まりの語が、二つ目の日付に終わりの語が付き、二つの日付の間は付いた語とつなぎの語だけ。
 * 文に始まりの語か終わりの語が二つあれば、どの日付がどの期間のものか決まらないので読まない。語は語彙表（range-start-end）から受け取る。
 */
export type StartEndWord = { readonly word: string; readonly position: "before" | "after" };

export type StartEndWords = {
  readonly starts: readonly StartEndWord[];
  readonly ends: readonly StartEndWord[];
  /** 始まりの語と終わりの語の間に立つ語（and、and shall、し、）。 */
  readonly joints: readonly string[];
  /**
   * 終わりの日付の後ろに付く終わりの語（に終了）の、さらに後ろに来てよい語（する、し、）。「、」で終わる語は文が続くので頭だけを照らし、
   * ほかは文の終わりまでがその語だけ。「に終了した旧契約」は名詞にかかる語で、期間の終わりではない。
   */
  readonly tails: readonly string[];
  readonly weekdays: readonly string[];
};

/** 文の終わり。英語は後ろが大文字のときだけ（"in Jan. 2026" は切らない）。段落の切れ目も文の終わり。 */
const SENTENCE_END = /[。！？]|[.!?]\s+(?=[A-Z])|\n\s*\n/gu;

const flat = (text: string): string => text.replace(/\s+/gu, " ").toLowerCase();

const LATIN = /[a-z]/u;

/** 英字の語は語の切れ目で照らす（ends が depends に当たらない）。英字で始まらない・終わらない語は、その側を照らさない。 */
const wordPattern = (word: string, flags: string): RegExp => {
  const head = LATIN.test(word.charAt(0)) ? "(?<![a-z])" : "";
  const tail = LATIN.test(word.at(-1) ?? "") ? "(?![a-z])" : "";
  return new RegExp(`${head}${escapeRegExp(word)}${tail}`, flags);
};

const endsWithWord = (text: string, word: string): boolean => new RegExp(`${wordPattern(word, "u").source}$`, "u").test(text);

const startsWithWord = (text: string, word: string): boolean => new RegExp(`^${wordPattern(word, "u").source}`, "u").test(text);

/** 文の中で、語のどれかに当たる所の数。重なる当たり（starts と starts on）は一つ。 */
export const occurrences = (text: string, words: readonly StartEndWord[]): number => {
  const spans = words
    .flatMap(({ word }) => [...text.matchAll(wordPattern(word, "gu"))].map((match) => ({ start: match.index, end: match.index + match[0].length })))
    .toSorted((left, right) => left.start - right.start || right.end - left.end);
  return spans.reduce(
    (acc, span) => (span.start >= acc.end ? { count: acc.count + 1, end: span.end } : { count: acc.count, end: Math.max(acc.end, span.end) }),
    {
      count: 0,
      end: -1,
    },
  ).count;
};

type Sentence = { readonly before: string; readonly between: string; readonly after: string; readonly whole: string };

/** 二つの日付を含む文を、始まりの日付の前、二つの日付の間、終わりの日付の後ろに分ける。間に文の終わりがあれば undefined。 */
const sentenceOf = (source: string, start: DatedSpan, end: DatedSpan): Sentence | undefined => {
  const between = source.slice(start.end, end.offset);
  if (new RegExp(SENTENCE_END.source, "u").test(between)) return undefined;
  const from = [...source.slice(0, start.offset).matchAll(SENTENCE_END)].map((match) => match.index + match[0].length).at(-1) ?? 0;
  const tail = source.slice(end.end);
  const to = end.end + ([...tail.matchAll(SENTENCE_END)][0]?.index ?? tail.length);
  const before = flat(source.slice(from, start.offset)).trimEnd();
  const after = bare(source.slice(end.end, to));
  return { before, between: bare(between), after, whole: flat(source.slice(from, to)) };
};

const beforeWord = (text: string, words: readonly StartEndWord[]): string | undefined =>
  words.find((entry) => entry.position === "before" && endsWithWord(text, entry.word))?.word;

const afterWord = (text: string, words: readonly StartEndWord[]): string | undefined =>
  words.find((entry) => entry.position === "after" && startsWithWord(text, entry.word))?.word;

const endsPredicate = (rest: string, tails: readonly string[]): boolean => tails.some((tail) => (tail.endsWith("、") ? rest.startsWith(tail) : rest === tail));

/** 終わりの日付の後ろの終わりの語で、その後ろが述語の終わり（に終了する。に終了し、）。 */
const endAfterWord = (after: string, words: StartEndWords): string | undefined => {
  const word = afterWord(after, words.ends);
  return word !== undefined && endsPredicate(after.slice(word.length).trim(), words.tails) ? word : undefined;
};

/** 間の語から、始まりの日付の後ろの語と終わりの日付の前の語を除いた残りが、つなぎの語か。 */
const joinedBetween = (between: string, words: StartEndWords, startAfter: string | undefined, endBefore: string | undefined): boolean => {
  const head = startAfter === undefined ? between : between.slice(startAfter.length).trimStart();
  const rest = endBefore === undefined ? head : head.slice(0, head.length - endBefore.length).trimEnd();
  return words.joints.some((joint) => joint.toLowerCase() === rest);
};

/** 二つの日付が、始まりの語と終わりの語で書いた一つの期間か。 */
export const isStartEndRange = (source: string, start: DatedSpan, end: DatedSpan, words: StartEndWords): boolean => {
  const sentence = sentenceOf(source, start, end);
  if (sentence === undefined) return false;
  if (occurrences(sentence.whole, words.starts) !== 1 || occurrences(sentence.whole, words.ends) !== 1) return false;
  const between = withoutTrailingWeekday(sentence.between, words.weekdays);
  const startBefore = beforeWord(withoutTrailingWeekday(sentence.before, words.weekdays), words.starts);
  const startAfter = afterWord(between, words.starts);
  const endBefore = beforeWord(between, words.ends);
  const endAfter = endAfterWord(sentence.after, words);
  if ((startBefore ?? startAfter) === undefined || (endBefore ?? endAfter) === undefined) return false;
  return joinedBetween(between, words, startAfter, endBefore);
};
