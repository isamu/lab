import type { Sentence, Token } from "./plugin.ts";
import { kanjiSkeleton } from "./kana-spelling.ts";

const ALL_KANJI = /^[\p{Script=Han}々]+$/u;
/** A bound noun that is kanji and then kana (込み): the okurigana half of a word the tokenizer cut (申 and 込み). */
const KANJI_THEN_KANA = /^[\p{Script=Han}々]+[ぁ-ゖ]+$/u;

const isTouching = (head: Token, tail: Token): boolean => head.span.end === tail.span.start;

const isKanjiNoun = (token: Token): boolean => token.pos === "NOUN" && ALL_KANJI.test(token.surface);

/** 申 and 込み: a kanji noun and a bound noun of kanji and kana written onto it. */
const isCutAtKanji = (head: Token, tail: Token): boolean =>
  isKanjiNoun(head) && tail.pos === "NOUN" && tail.features?.["Bound"] === "Yes" && KANJI_THEN_KANA.test(tail.surface) && isTouching(head, tail);

/**
 * 申立 and て, the noun's reading already ending in テ (モウシタテ): its last kana cut off as a particle. て never follows a noun as
 * a particle; other kana (の after 長野, ナガノ) do, so only て is read back.
 */
const isCutBeforeTe = (head: Token, tail: Token): boolean =>
  isKanjiNoun(head) && tail.surface === "て" && (tail.pos === "ADP" || tail.pos === "SCONJ") && head.reading?.endsWith("テ") === true && isTouching(head, tail);

/** The one reading the document gives a noun of these kanji (申込|モウシコミ for 申込); undefined for none or for two. */
const readingAmong = (kanji: string, nouns: ReadonlySet<string>): string | undefined => {
  const readings = [...nouns].filter((key) => key.startsWith(`${kanji}|`)).map((key) => key.slice(kanji.length + 1));
  return readings.length === 1 ? readings[0] : undefined;
};

const readingOfJoined = (head: Token, tail: Token, nouns: ReadonlySet<string>): string | undefined => {
  if (isCutAtKanji(head, tail)) return readingAmong(kanjiSkeleton(head.surface + tail.surface), nouns);
  return isCutBeforeTe(head, tail) ? head.reading : undefined;
};

const joinedOf = (head: Token, tail: Token | undefined, nouns: ReadonlySet<string>): Token | undefined => {
  const reading = tail === undefined ? undefined : readingOfJoined(head, tail, nouns);
  if (tail === undefined || reading === undefined) return undefined;
  const surface = head.surface + tail.surface;
  return { span: { start: head.span.start, end: tail.span.end }, surface, pos: "NOUN", lemma: surface, reading };
};

const joinedTokens = (tokens: readonly Token[], nouns: ReadonlySet<string>): Token[] =>
  tokens.reduce<{ readonly out: Token[]; readonly skip: boolean }>(
    ({ out, skip }, token, at) => {
      if (skip) return { out, skip: false };
      const joined = joinedOf(token, tokens[at + 1], nouns);
      out.push(joined ?? token);
      return { out, skip: joined !== undefined };
    },
    { out: [], skip: false },
  ).out;

/**
 * The sentence with a noun the tokenizer cut in two read whole: a kanji noun and a bound noun of kanji and kana written onto it
 * (申 and 込み at the head of a sentence) are one noun (申込み) when the document writes a noun of the same kanji elsewhere
 * (申し込み, 申込|モウシコミ in nouns), which gives the reading. With no such noun, or two readings for it, the tokens stay as cut.
 * A kanji noun read with its last kana and that kana cut off as て (申立 and て) is one noun too (申立て).
 * nouns holds the document's nouns (documentNounKeys).
 */
export const withCutNounsJoined = (sentence: Sentence, nouns: ReadonlySet<string>): Sentence => {
  const tokens = sentence.tokens ?? [];
  const joined = joinedTokens(tokens, nouns);
  return joined.length === tokens.length ? sentence : { ...sentence, tokens: joined };
};
