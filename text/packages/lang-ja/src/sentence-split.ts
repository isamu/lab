import { DefaultAbbrMarkerOptions, split, SentenceSplitterSyntax } from "sentence-splitter";
import type { Span } from "chaffjs/plugin";

/**
 * sentence-splitter に長い段落を一度に渡すと、文の数の 2 乗で遅くなる。
 * 文を閉じるたびに、それまでに閉じた括弧を全部並べ直すため。
 *
 * そこで分割器の状態が空に戻る所（文が閉じ、括弧も開いていない所）で切り、切れ目ごとに渡す。
 * 切ってよいかは分割器の規則を写して決める。写し方が狂うと文が変わるので、迷う所では切らない。
 */

// PairMaker と同じ組。開き括弧を鍵にする。
const PAIRS: readonly (readonly [string, string])[] = [
  ['"', '"'],
  ["[", "]"],
  ["(", ")"],
  ["{", "}"],
  ["「", "」"],
  ["（", "）"],
  ["『", "』"],
  ["｛", "｝"],
  ["［", "］"],
  ["〚", "〛"],
  ["【", "】"],
  ["《", "》"],
];
const KEY_OF = new Map<string, string>(
  PAIRS.flatMap(([open, close]): [string, string][] => [
    [close, open],
    [open, open],
  ]),
);
const CLOSE_OF = new Map<string, string>(PAIRS.map(([open, close]): [string, string] => [open, close]));

// AbbrMarker の語の区切り。分割器は UTF-16 の 1 単位ずつ読むので、こちらも 1 単位で判定する。
const CJK = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;
const isCJK = (unit: string | undefined): boolean => unit !== undefined && CJK.test(unit);
const isSpace = (unit: string | undefined): boolean => unit !== undefined && /\s/.test(unit);

// 和文の句点の並び。直前が仮名・漢字なら、略語の判定がこの句点に掛かることはない。
const JAPANESE_STOPS = /[。．？！]+/g;
// 英語は「空白の後の英字だけの語 + ピリオド + 空白」。略語の一覧に無い語だけを切れ目にする。
const ENGLISH_STOP = /(?<=^|\s)[A-Za-z]{2,}\.(?=\s)/g;
const { language } = DefaultAbbrMarkerOptions;
const ABBREVIATIONS = new Set(
  [...language.ABBREVIATIONS, ...language.PREPOSITIVE_ABBREVIATIONS, ...language.EXCLAMATION_WORDS].map((word) => word.toLowerCase()),
);
// 「J. Smith」のような語は前の語を見て略語か決まる。前の語が切れ目の向こうにあると判定が変わる。
const CAPITAL_DOT = /\p{Lu}\./gu;

/** 各位置の手前で、開いたままの括弧があるか。PairMaker と同じく種類ごとに 1 つまで開く。 */
const pairOpenBefore = (text: string): boolean[] => {
  const open = new Set<string>();
  const before = [false];
  text.split("").forEach((unit) => {
    const key = KEY_OF.get(unit);
    if (key !== undefined && !open.has(key) && unit === key) open.add(key);
    else if (key !== undefined && open.has(key) && unit === CLOSE_OF.get(key)) open.delete(key);
    before.push(open.size > 0);
  });
  return before;
};

/** sorted の中で from 以上の最初の値。無ければ fallback。 */
const firstAtOrAfter = (sorted: readonly number[], from: number, fallback: number): number => {
  const search = (low: number, high: number): number => {
    if (low >= high) return sorted[low] ?? fallback;
    const middle = Math.floor((low + high) / 2);
    return (sorted[middle] ?? fallback) >= from ? search(low, middle) : search(middle + 1, high);
  };
  return search(0, sorted.length);
};

const indexesOf = (text: string, pattern: RegExp): number[] => [...text.matchAll(pattern)].map((match) => match.index);

/** 句点の並びの直後。和文は直前が仮名・漢字の句点、英文は略語でない語のピリオド。 */
const stopEnds = (text: string): number[] => {
  const japanese = [...text.matchAll(JAPANESE_STOPS)].filter((match) => isCJK(text[match.index - 1]));
  const english = [...text.matchAll(ENGLISH_STOP)].filter((match) => !ABBREVIATIONS.has(match[0].toLowerCase()));
  return [...japanese, ...english].map((match) => match.index + match[0].length).sort((a, b) => a - b);
};

const skipSpaces = (text: string, from: number): number => {
  const spaces = /\s*/y;
  spaces.lastIndex = from;
  return from + (spaces.exec(text)?.[0].length ?? 0);
};

/**
 * 句点の直後から次の文の頭へ。空白を挟むか、仮名・漢字が続くときだけ切れる。
 * それ以外の文字が続くと、分割器はその文字を前の語の続きとして読む。
 */
const chunkStart = (text: string, stopEnd: number): number | undefined => {
  const next = text[stopEnd];
  if (isSpace(next)) return skipSpaces(text, stopEnd);
  return isCJK(next) ? stopEnd : undefined;
};

type Landmarks = { readonly open: readonly boolean[]; readonly spaces: readonly number[]; readonly capitalDots: readonly number[] };

/**
 * 切れ目の後ろ、最初の 2 つの語の塊に「J.」の形が無いこと。
 * 分割器はその形の語だけ、空白を越えて前の語を読み返す。
 */
const noLookBack = (text: string, start: number, marks: Landmarks): boolean => {
  const secondRun = skipSpaces(text, firstAtOrAfter(marks.spaces, start, text.length));
  return firstAtOrAfter(marks.capitalDots, start, Infinity) > secondRun;
};

const cutPoints = (text: string): number[] => {
  const marks: Landmarks = { open: pairOpenBefore(text), spaces: indexesOf(text, /\s/g), capitalDots: indexesOf(text, CAPITAL_DOT) };
  return stopEnds(text).flatMap((stopEnd) => {
    if (marks.open[stopEnd] === true) return [];
    const start = chunkStart(text, stopEnd);
    return start !== undefined && start < text.length && noLookBack(text, start, marks) ? [start] : [];
  });
};

const spansOf = (text: string, offset: number): Span[] =>
  split(text)
    .filter((node) => node.type === SentenceSplitterSyntax.Sentence)
    .map((node) => ({ start: offset + node.range[0], end: offset + node.range[1] }));

/** 分割器に別々に渡してよい区間。つなぐと text 全体になる。 */
export const chunksOf = (text: string): Span[] => {
  const starts = [0, ...cutPoints(text)];
  return starts.map((start, index) => ({ start, end: starts[index + 1] ?? text.length }));
};

/** split(text) の文の span と同じものを返す。区間ごとに分けて渡すだけ。 */
export const sentenceSpans = (text: string): Span[] => chunksOf(text).flatMap((chunk) => spansOf(text.slice(chunk.start, chunk.end), chunk.start));
