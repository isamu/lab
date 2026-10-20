import type { Lexicon, Token } from "../plugin.ts";
import { comparableWords, type TokenRange } from "./lexicon-match.ts";
import { isNamed } from "./superlative-scope.ts";

const SPACE = /\s+/gu;

/** 語の並びの字（空白を除き、照らす形に）。 */
const lettersOf = (text: string): string => comparableWords(text).replace(SPACE, "");

/** start 番目の語から、end 番目より手前で終わらずに、語の並びの字がちょうど phrase になるか。 */
const runsTo = (words: readonly string[], start: number, end: number, phrase: string): boolean => {
  let joined = words.slice(start, end).join("");
  for (let next = end; joined.length < phrase.length && next < words.length; next += 1) joined += words[next];
  return joined === phrase;
};

/** 最上級の始まりから前へ、言い方の字数に収まるだけ戻った始まりの候補。 */
const startsWithin = (words: readonly string[], range: TokenRange, length: number): number[] => {
  const starts: number[] = [];
  let joined = words.slice(range.start, range.end).join("").length;
  for (let start = range.start; start >= 0 && joined <= length; start -= 1) {
    starts.push(start);
    joined += words[start - 1]?.length ?? 0;
  }
  return starts;
};

/**
 * 言い方が、語の境目で始まり語の境目で終わる語の並びとして、最上級を包んでいるか。字で照らすので、言い方を単独で
 * 分けたとき（最高裁判所で 1 語）と文の中で分けたとき（最高|裁判所）とで語の切り方が違っても当たる。
 */
const wraps = (words: readonly string[], range: TokenRange, phrase: string): boolean =>
  startsWithin(words, range, phrase.length).some((start) => runsTo(words, start, range.end, phrase));

/**
 * 最上級を含む決まった言い方の中にあるか（even the best・in the best case・最高裁判所・最も近い）。譲歩や仮定、職名、
 * 場所からの近さを言っていて、何かが一番だという主張ではない。言い方は言語パッケージの語彙表 superlative-phrase が持つ。
 */
export const inPhrase = (tokens: readonly Token[], range: TokenRange, phrases: Lexicon): boolean => {
  if (phrases.length === 0) return false;
  const words = tokens.map((token) => lettersOf(token.surface));
  return phrases.some((entry) => wraps(words, range, lettersOf(entry.pattern)));
};

/**
 * 持ち主の名前と「の」が、空白を挟まずに最上級のすぐ前にあるか（芭蕉の最も有名な作品・国連の最も大事な目的）。
 * 何の中で最もなのか（芭蕉の作品の中で）を言っている。範囲の「で」と同じく、前の語が名前のときだけ。「そのあとの最大の山場」
 * 「大切なことの最大の理由」の「あと」「こと」は持ち主ではない。持ち主を受ける語は言語パッケージの語彙表 superlative-owner が持つ。
 */
export const ownedBefore = (tokens: readonly Token[], range: TokenRange, owners: Lexicon): boolean => {
  const owner = tokens[range.start - 2];
  const marker = tokens[range.start - 1];
  const first = tokens[range.start];
  if (owner === undefined || marker === undefined || first === undefined || !isNamed(owner)) return false;
  const joined = owner.span.end === marker.span.start && marker.span.end === first.span.start;
  return joined && owners.some((entry) => entry.pattern === marker.surface);
};
