import type { Token } from "../plugin.ts";

const LETTER = /\p{L}/u;
const CAPITAL_HEAD = /^\p{Lu}/u;

/** 文字を含む語の添字。&、括弧、句読点は名前の並びを切らない（Learning & Development、Guide (PAPPG)）。 */
const wordIndexes = (tokens: readonly Token[]): number[] => tokens.flatMap((token, index) => (LETTER.test(token.surface) ? [index] : []));

/** 文の最初の語より後ろで、大文字で始まる語。文頭の大文字は位置のしるしで、名前のしるしではない。 */
const isCapitalisedAt = (tokens: readonly Token[], words: readonly number[], at: number): boolean => {
  const index = words[at];
  return at > 0 && index !== undefined && CAPITAL_HEAD.test(tokens[index]?.surface ?? "");
};

/**
 * 語（添字）が、大文字で書いた名前の一部か。文の途中で大文字で始まり、隣の語も文の途中の大文字（Procedures Guide、
 * the Location Object、Learning & Development）。解析器はこういう語を動詞と読むことがあるが、述語ではない。
 * 文頭の語は隣に数えない。Select Save (if applicable) の Save は述語のまま。
 */
export const isNamePart = (tokens: readonly Token[], index: number): boolean => {
  const words = wordIndexes(tokens);
  const at = words.indexOf(index);
  return isCapitalisedAt(tokens, words, at) && (isCapitalisedAt(tokens, words, at - 1) || isCapitalisedAt(tokens, words, at + 1));
};
