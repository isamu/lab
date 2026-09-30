import type { Lexicon, Token } from "../plugin.ts";
import type { TokenRange } from "./lexicon-match.ts";

/** 名詞の後ろにこれが続けば、その名詞は句の頭ではない。解析器は形容詞を名詞と読むことがある（the most frigid weather・the most cost-effective）。 */
const JOINED = new Set(["NOUN", "PROPN", "ADJ", "X"]);

const listed = (tokens: readonly Token[], range: TokenRange, amounts: Lexicon): boolean => {
  const words = tokens
    .slice(range.start, range.end)
    .map((token) => token.surface.toLowerCase())
    .join(" ");
  return amounts.some((entry) => entry.pattern.toLowerCase() === words);
};

/**
 * 量も言う最上級に、句の頭になる名詞がそのまま続くか（the most work・the most students・for the most part）。
 * それは一番多いものを言っていて、何かが一番良いという主張ではない。形容詞を挟めば（the most powerful tool）主張のまま。
 * どの最上級が量を言うかは言語パッケージの語彙表 superlative-amount が持つ。
 */
export const namesAmount = (tokens: readonly Token[], range: TokenRange, amounts: Lexicon): boolean => {
  const noun = tokens[range.end];
  const after = tokens[range.end + 1];
  return listed(tokens, range, amounts) && noun?.pos === "NOUN" && (after === undefined || !JOINED.has(after.pos));
};
