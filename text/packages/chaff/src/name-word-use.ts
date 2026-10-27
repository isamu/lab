import type { Token } from "./plugin.ts";
import type { WordUse } from "./name-end-letter.ts";
import { isOrdinaryToken } from "./name-ordinary-word.ts";

// name-variant: how the document uses its Latin words, read from the tagger's tokens. Pure.

const LATIN_WORD = /^[A-Za-z]+$/u;
const LOWERCASE_WORD = /^[a-z]+$/u;

/** 文書が小文字で書くか、品詞解析が普通名詞と読む英字の語（文頭の Hurricane）。 */
const isCommonToken = (token: Token): boolean => LOWERCASE_WORD.test(token.surface) || (token.pos === "NOUN" && LATIN_WORD.test(token.surface));

/** 文書での英字の語の使い方。名前と読んだ語のうち小文字で書けばふつうの語と、普通名詞として書いた語。tokens は文書の語。 */
export const wordUseOf = (tokens: readonly Token[]): WordUse => ({
  ordinary: new Set(tokens.flatMap((token) => (isOrdinaryToken(token) ? [token.surface.toLowerCase()] : []))),
  common: new Set(tokens.flatMap((token) => (isCommonToken(token) ? [token.surface.toLowerCase()] : []))),
});
