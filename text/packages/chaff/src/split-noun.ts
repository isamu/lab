import type { Sentence, Token } from "./plugin.ts";
import { kanjiSkeleton } from "./kana-spelling.ts";

const ALL_KANJI = /^[\p{Script=Han}々]+$/u;
/** A bound noun that is kanji and then kana (込み): the okurigana half of a word the tokenizer cut (申 and 込み). */
const KANJI_THEN_KANA = /^[\p{Script=Han}々]+[ぁ-ゖ]+$/u;

const isCutPair = (head: Token, tail: Token | undefined): tail is Token =>
  head.pos === "NOUN" &&
  ALL_KANJI.test(head.surface) &&
  tail?.pos === "NOUN" &&
  tail.features?.["Bound"] === "Yes" &&
  KANJI_THEN_KANA.test(tail.surface) &&
  head.span.end === tail.span.start;

/** The one reading the document gives a noun of these kanji (申込|モウシコミ for 申込); undefined for none or for two. */
const readingAmong = (kanji: string, nouns: ReadonlySet<string>): string | undefined => {
  const readings = [...nouns].filter((key) => key.startsWith(`${kanji}|`)).map((key) => key.slice(kanji.length + 1));
  return readings.length === 1 ? readings[0] : undefined;
};

const joinedOf = (head: Token, tail: Token, nouns: ReadonlySet<string>): Token | undefined => {
  const surface = head.surface + tail.surface;
  const reading = readingAmong(kanjiSkeleton(surface), nouns);
  return reading === undefined ? undefined : { span: { start: head.span.start, end: tail.span.end }, surface, pos: "NOUN", lemma: surface, reading };
};

const joinedTokens = (tokens: readonly Token[], nouns: ReadonlySet<string>): Token[] =>
  tokens.reduce<{ readonly out: Token[]; readonly skip: boolean }>(
    ({ out, skip }, token, at) => {
      if (skip) return { out, skip: false };
      const tail = tokens[at + 1];
      const joined = isCutPair(token, tail) ? joinedOf(token, tail, nouns) : undefined;
      out.push(joined ?? token);
      return { out, skip: joined !== undefined };
    },
    { out: [], skip: false },
  ).out;

/**
 * The sentence with a noun the tokenizer cut in two read whole: a kanji noun and a bound noun of kanji and kana written onto it
 * (申 and 込み at the head of a sentence) are one noun (申込み) when the document writes a noun of the same kanji elsewhere
 * (申し込み, 申込|モウシコミ in nouns), which gives the reading. With no such noun, or two readings for it, the tokens stay as cut.
 * nouns holds the document's nouns (documentNounKeys).
 */
export const withCutNounsJoined = (sentence: Sentence, nouns: ReadonlySet<string>): Sentence => {
  const tokens = sentence.tokens ?? [];
  const joined = joinedTokens(tokens, nouns);
  return joined.length === tokens.length ? sentence : { ...sentence, tokens: joined };
};
