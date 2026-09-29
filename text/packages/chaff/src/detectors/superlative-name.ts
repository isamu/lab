import type { Lexicon, Token } from "../plugin.ts";
import type { TokenRange } from "./lexicon-match.ts";

/** 記号（最高!）は名詞と付いても語を作らない。 */
const LETTER = /\p{L}/u;

const nameHead = (token: Token | undefined): token is Token => token !== undefined && token.pos === "NOUN" && LETTER.test(token.surface);

const isGrade = (token: Token, grades: Lexicon): boolean => grades.some((entry) => entry.pattern === token.surface);

/**
 * 最上級の名詞がそのまま次の名詞と 1 語になっているか（最大風速・最高気温・最大値、値を言う最大三人も）。
 * これは測る量の名前か値で、何かが一番だという主張ではない。「最大の効果」「最も速い」は助詞や用言を挟むので当たらない。
 * ただし次の名詞が等級そのもの（最高品質・最大規模）なら、一番の等級だと言っている主張。その語は言語パッケージの語彙表が持つ。
 */
export const namesQuantity = (tokens: readonly Token[], range: TokenRange, grades: Lexicon): boolean => {
  const superlative = tokens[range.start];
  const last = tokens[range.end - 1];
  const next = tokens[range.end];
  const single = range.end - range.start === 1 && superlative?.pos === "NOUN";
  return single && last !== undefined && nameHead(next) && last.span.end === next.span.start && !isGrade(next, grades);
};
