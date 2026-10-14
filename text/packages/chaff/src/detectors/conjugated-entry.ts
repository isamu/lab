import type { LexiconEntry, Sentence, Span, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { entryRanges } from "./lexicon-match.ts";

/**
 * チームが辞書形の動詞で書いた語か（巻き取る・握っておく・utilize）。最後の語が動詞の原形のときだけ。
 * 名詞（巻き取り・onboarding）や活用した形（握った）は書いた形のまま照らす。動詞の名詞形まで当てると、チームが並べていない語を指摘する。
 */
export const isDictionaryVerb = (entry: LexiconEntry): boolean => {
  const last = entry.tokens?.at(-1);
  return last?.pos === "VERB" && last.lemma?.toLowerCase() === last.surface.toLowerCase();
};

/** 直前に動詞が詰めて書いてある（受け|取ります）。そこは別の複合動詞の後ろ半分で、並べた動詞ではない。 */
const tailOfCompound = (tokens: readonly Token[], start: number): boolean => {
  const before = tokens[start - 1];
  return before?.pos === "VERB" && before.span.end === tokens[start]?.span.start;
};

/**
 * 辞書形の動詞で書いた語が、活用した形で文のどこに出たか（文の中の字の範囲）。複合動詞は語に割れる（巻き/取り）ので、語の並びで照らす。
 * 品詞が無い文書、動詞でない語には何も返さない。字で探す側がそのまま当たる。
 */
export const conjugatedSpans = (sentence: Sentence, entry: LexiconEntry): Span[] => {
  const tokens = sentence.tokens;
  if (tokens === undefined || !isDictionaryVerb(entry)) return [];
  return entryRanges(sentence, entry).flatMap((range) => {
    const first = tokens[range.start];
    const last = tokens[range.end - 1];
    if (first === undefined || last === undefined || tailOfCompound(tokens, range.start)) return [];
    return [{ start: first.span.start - sentence.span.start, end: last.span.end - sentence.span.start }];
  });
};

const occurrencesOf = (text: string, word: string): Span[] =>
  word === ""
    ? []
    : [...text.matchAll(new RegExp(escapeRegExp(word), "giu"))].map((match) => ({
        start: match.index,
        end: match.index + match[0].length,
      }));

/**
 * prefer の「使わない書き方」が動詞のとき、活用した形の始まり（文の中の字の位置）。「使う書き方」の中に出たものは除く。
 * 大文字小文字だけ違う組（Javascript・JavaScript）は語で照らすと区別が消えるので、字で探す側に任せる。
 */
export const conjugatedStartsOutside = (sentence: Sentence, entry: LexiconEntry, use: string): number[] => {
  if (entry.pattern.toLowerCase() === use.toLowerCase()) return [];
  const covered = occurrencesOf(sentence.text, use);
  return conjugatedSpans(sentence, entry)
    .filter((span) => !covered.some((cover) => cover.start <= span.start && span.end <= cover.end))
    .map((span) => span.start);
};
