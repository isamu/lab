import type { LexiconEntry, Token } from "../plugin.ts";

/** 語彙表の語が解析器で一語になったときの、その語。二語以上（「ございます」）は読みで照らさない。 */
const singleWord = (entry: LexiconEntry): Token | undefined => (entry.tokens?.length === 1 ? entry.tokens[0] : undefined);

/**
 * 読みと品詞が同じなら、表記が違っても同じ語の同じ形。解析器は「下さい」の原形を「下さる」、「ください」の原形を「くださる」と
 * 別の字で返すが、読み（クダサイ）と品詞は同じ。品詞も比べるのは、読みだけだと「升（マス）」が「ます」に当たるから。
 */
const sameReading = (token: Token, word: Token | undefined): boolean => word?.reading !== undefined && token.reading === word.reading && token.pos === word.pos;

/** 語が丁寧語の語彙表の語か。書いた形か原形が語彙表の語と同じか、語彙表の一語と読みと品詞が同じ。 */
export const isPoliteWord = (token: Token, entries: readonly LexiconEntry[]): boolean =>
  entries.some((entry) => token.surface === entry.pattern || token.lemma === entry.pattern || sameReading(token, singleWord(entry)));
