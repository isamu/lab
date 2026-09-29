import type { LexiconEntry, Sentence, Token } from "../plugin.ts";
import { proseText } from "../measure.ts";

/** 活用する品詞。"best" を "good" と同じ語にはしない。 */
const INFLECTING = new Set(["VERB", "AUX"]);

/**
 * 語彙表が原形で書いた語（いただく）だけが、活用した形（いただきます・いただいた）に当たる。
 * 活用した形で書いた語（could・かもしれません）はその形だけ。"could" は "can" と言っていることが違う。
 */
const sameWord = (written: Token, entry: Token): boolean => {
  const surface = entry.surface.toLowerCase();
  if (written.surface.toLowerCase() === surface) return true;
  const inflects = INFLECTING.has(written.pos) && INFLECTING.has(entry.pos);
  return inflects && entry.lemma?.toLowerCase() === surface && written.lemma?.toLowerCase() === surface;
};

const runsAt = (tokens: readonly Token[], entry: readonly Token[], start: number): boolean =>
  entry.every((word, offset) => {
    const written = tokens[start + offset];
    return written !== undefined && sameWord(written, word);
  });

/**
 * 語彙の語が文の中にあるか。品詞が付いていれば語の並びで照らし、活用する語は原形で比べる（「させていただく」が「させていただきました」に当たる）。
 * 語の途中には当たらない（「また」は「またいで」に当たらない）。品詞が無ければ、空白をまとめた文字列で照らす。
 */
export const entryIn = (sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens;
  const words = entry.tokens;
  if (tokens === undefined || words === undefined || words.length === 0) return proseText(sentence).toLowerCase().includes(entry.pattern.toLowerCase());
  return tokens.some((_token, start) => runsAt(tokens, words, start));
};

export type TokenRange = { readonly start: number; readonly end: number };

/** 語彙の語が文のどの語の並びに当たったか（始まりと、終わった次の位置）。品詞が無ければ位置を言えないので空。 */
export const entryRanges = (sentence: Sentence, entry: LexiconEntry): TokenRange[] => {
  const tokens = sentence.tokens;
  const words = entry.tokens;
  if (tokens === undefined || words === undefined || words.length === 0) return [];
  return tokens.flatMap((_token, start) => (runsAt(tokens, words, start) ? [{ start, end: start + words.length }] : []));
};

const LEADING_MARK = new Set(["PUNCT", "SYM"]);

/** 語彙の語で文が始まるか。文頭の記号は飛ばす。品詞が無ければ文字列の前方一致。 */
export const entryOpens = (sentence: Sentence, entry: LexiconEntry): boolean => {
  const tokens = sentence.tokens;
  const words = entry.tokens;
  if (tokens === undefined || words === undefined || words.length === 0) return proseText(sentence).toLowerCase().startsWith(entry.pattern.toLowerCase());
  const first = tokens.findIndex((token) => !LEADING_MARK.has(token.pos));
  return runsAt(tokens, words, first);
};
