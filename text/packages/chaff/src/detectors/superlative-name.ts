import type { Lexicon, Token } from "../plugin.ts";
import type { TokenRange } from "./lexicon-match.ts";

/** 記号（最高!）は名詞と付いても語を作らない。 */
const LETTER = /\p{L}/u;

const joinsAsNoun = (previous: Token, token: Token | undefined): token is Token =>
  token !== undefined && token.pos === "NOUN" && LETTER.test(token.surface) && previous.span.end === token.span.start;

/** 空白も助詞も挟まずに続く名詞の連なり（最大|瞬間|風速）の最後の語。連なりが無ければ undefined。 */
const lastJoined = (tokens: readonly Token[], at: number): Token | undefined => {
  const previous = tokens[at - 1];
  const token = tokens[at];
  if (previous === undefined || !joinsAsNoun(previous, token)) return undefined;
  return lastJoined(tokens, at + 1) ?? token;
};

const measures = (noun: Token, quantities: Lexicon): boolean => quantities.some((entry) => entry.pattern === noun.surface);

/**
 * 最上級の名詞がそのまま名詞と 1 語になり、その連なりが測る量の名詞で終わるか（最大風速・最高気温・最大値・最大駐車台数）。
 * これは量の名前で、何かが一番だという主張ではない。「最大の効果」「最も速い」は助詞や用言を挟むので当たらない。
 * ほかの名詞で終わる語（最高品質・最高精度・最大効果）は一番だという主張のまま。量の名詞は言語パッケージの語彙表が持つ。
 */
export const namesQuantity = (tokens: readonly Token[], range: TokenRange, quantities: Lexicon): boolean => {
  const superlative = tokens[range.start];
  const single = range.end - range.start === 1 && superlative?.pos === "NOUN";
  const last = single ? lastJoined(tokens, range.end) : undefined;
  return last !== undefined && measures(last, quantities);
};
