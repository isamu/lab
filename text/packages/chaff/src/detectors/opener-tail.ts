import type { LexiconEntry, Sentence, Token } from "../plugin.ts";

/** 文の頭の記号（飛ばして読む）。 */
const LEADING_MARK = new Set(["PUNCT", "SYM"]);
/** 文の終わりに残ってよい語: 助動詞と記号。 */
const TAIL = new Set(["AUX", "PUNCT", "SYM"]);

/**
 * 文頭の語の後ろが助動詞と記号だけの文（だからである。）。前の文の終わり（〜というべき／だからである。）が改行で切れたもので、
 * 文を始める接続詞ではない。品詞が無ければ言えないので false。
 */
export const isSentenceTail = (sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens;
  const words = entry.tokens;
  if (tokens === undefined || words === undefined || words.length === 0) return false;
  const first = tokens.findIndex((token) => !LEADING_MARK.has(token.pos));
  const rest: readonly Token[] = first === -1 ? [] : tokens.slice(first + words.length);
  return rest.some((token) => token.pos === "AUX") && rest.every((token) => TAIL.has(token.pos));
};
