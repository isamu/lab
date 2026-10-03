import type { Detector, Finding, ProseDocument, Sentence, Token } from "../plugin.ts";
import { groupBy, oddSpellings, type KeyedWord, type OddSpelling } from "../spelling-variants.ts";
import { kanjiSkeleton, katakanaKey, lemmaReading } from "../kana-spelling.ts";
import { isKatakanaWord, stemOf } from "../long-vowel.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { nameSpans, touchesAny } from "../team-names.ts";

/** A word found in the document: where it is, which sentence it is in, its key and spelling, and how it is written when that differs. */
type Placed = KeyedWord & { readonly sentence: Sentence; readonly offset: number; readonly shown?: string };

type IsOpen = (start: number, end: number) => boolean;

/** Parts of speech that carry a word of their own. Particles and endings are written one way by the grammar. */
const CONTENT = new Set(["NOUN", "VERB", "ADJ", "ADV", "PRON", "CCONJ", "DET"]);
const JAPANESE_WORD = /^[\p{Script=Han}々ぁ-ゖァ-ヺー]+$/u;
/** A one-mora reading (木 and き, 気) is too short to say two spellings are one word. */
const MIN_READING = 2;
/** A katakana key shorter than this meets other words (ビル and ビール). */
const MIN_KATAKANA_KEY = 4;
const MIN_LATIN_KEY = 3;

/** Lexicons: readings and spellings whose kanji and kana forms mean different things (成る and なる, 者 and もの), and adverbs hiragana-fukushi reads. */
const DISTINCT = "orthographic-variant-distinct";
const FUKUSHI = "hiragana-fukushi";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/** Whether a stretch of the sentence is outside a quotation and outside the team's names, both of which keep their own spelling. */
const isOpenIn = (sentence: Sentence, names: readonly string[]): IsOpen => {
  const quoted = quotedSpans(sentence.text, QUOTATION_MARKS);
  const named = nameSpans(sentence.text, names);
  return (start, end) => !isWithinAny(quoted, { start, end }) && !touchesAny(named, start, end);
};

const isHelper = (token: Token, previous: Token | undefined): boolean =>
  token.features?.["Bound"] === "Yes" || (previous?.pos === "SCONJ" && (previous.surface === "て" || previous.surface === "で"));

/**
 * A helper verb or a dependent noun (見て下さい, その事) is written kana by many guides while the full word keeps its kanji (資料を下さい).
 * The two uses are compared apart, so a document that follows that convention is consistent. A suffix (業務用) is a third use:
 * it is not the dependent noun of the same reading (このように).
 */
const useOf = (token: Token, previous: Token | undefined): string => {
  if (!isHelper(token, previous)) return "free";
  return token.pos === "NOUN" && token.features?.["NounType"] !== "Dependent" ? "suffix" : "bound";
};

const readingKeyOf = (token: Token, previous: Token | undefined, skip: ReadonlySet<string>): string | undefined => {
  const lemma = token.lemma;
  if (!CONTENT.has(token.pos) || token.reading === undefined || lemma === undefined || !JAPANESE_WORD.test(lemma) || skip.has(lemma)) return undefined;
  const reading = lemmaReading(token.surface, lemma, token.reading);
  if (reading === undefined || [...reading].length < MIN_READING || skip.has(reading)) return undefined;
  return `${token.pos}|${useOf(token, previous)}|${reading}`;
};

/** Japanese words keyed by part of speech, use and the reading of the dictionary form, spelled as the dictionary form. */
const readingWords = (sentence: Sentence, isOpen: IsOpen, skip: ReadonlySet<string>): Placed[] => {
  const tokens = sentence.tokens ?? [];
  return tokens.flatMap((token, at): Placed[] => {
    const key = readingKeyOf(token, tokens[at - 1], skip);
    const local = token.span.start - sentence.span.start;
    if (key === undefined || token.lemma === undefined || !isOpen(local, local + token.surface.length)) return [];
    return [{ key, spelling: token.lemma, sentence, offset: token.span.start }];
  });
};

/**
 * Same reading is not yet same word: 書く and 描く are both カク. Spellings meet only when they keep the same kanji (引っ越し, 引越し)
 * or one is all kana. A kana spelling joins the kanji one only when the reading has a single kanji spelling in the document;
 * with two (橋 and 箸 beside はし) it cannot say which, and is left out.
 */
const byKanji = (words: readonly Placed[]): Placed[] =>
  [...groupBy(words, (word) => word.key).values()].flatMap((group) => {
    const skeletons = [...new Set(group.map((word) => kanjiSkeleton(word.spelling)).filter((skeleton) => skeleton !== ""))];
    return group.flatMap((word): Placed[] => {
      const own = kanjiSkeleton(word.spelling);
      if (own === "" && skeletons.length > 1) return [];
      return [{ ...word, key: `${word.key}|${own === "" ? (skeletons[0] ?? "") : own}` }];
    });
  });

/** Katakana nouns keyed with small kana and ー evened out, spelled without the final ー that katakana-long-vowel reads. */
const katakanaWords = (sentence: Sentence, isOpen: IsOpen): Placed[] =>
  (sentence.tokens ?? []).flatMap((token): Placed[] => {
    const local = token.span.start - sentence.span.start;
    if (token.pos !== "NOUN" || !isKatakanaWord(token.surface) || !isOpen(local, local + token.surface.length)) return [];
    const key = katakanaKey(token.surface);
    return [...key].length < MIN_KATAKANA_KEY ? [] : [{ key: `kana|${key}`, spelling: stemOf(token.surface), sentence, offset: token.span.start }];
  });

const LATIN_WORD = /[A-Za-z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*/gu;
const LOWER = /\p{Ll}/u;

/**
 * The case of the first letter of each part is left out of the spelling: a sentence, a title or a name gives it (Email and email,
 * Long-Term and long-term), the writer does not. Capitals after it are the spelling (GitHub and Github).
 */
const latinSpelling = (word: string): string =>
  word
    .split("-")
    .map((part) => part.charAt(0).toLowerCase() + part.slice(1))
    .join("-");

/** A word joined to a dot, an at sign or a slash is part of an address or a file name (github.com, user@example), spelled as it must be. */
const ADDRESS_NEIGHBOUR = /[.@/\\_]/u;

const isPartOfAddress = (text: string, start: number, end: number): boolean =>
  ADDRESS_NEIGHBOUR.test(text.charAt(start - 1)) || (ADDRESS_NEIGHBOUR.test(text.charAt(end)) && /\w/u.test(text.charAt(end + 1)));

/**
 * Latin words keyed without hyphens and case (e-mail and email, GitHub and Github). A word in capitals only (TEAMS, MAY) is
 * emphasis or an acronym, not a spelling of the word, and is left out.
 */
const latinWords = (sentence: Sentence, isOpen: IsOpen, skip: ReadonlySet<string>): Placed[] =>
  [...sentence.text.matchAll(LATIN_WORD)].flatMap((match): Placed[] => {
    const word = match[0];
    const plain = word.toLowerCase().replaceAll("-", "");
    const end = match.index + word.length;
    if (plain.length < MIN_LATIN_KEY || !LOWER.test(word) || skip.has(word.toLowerCase())) return [];
    if (isPartOfAddress(sentence.text, match.index, end) || !isOpen(match.index, end)) return [];
    return [{ key: `latin|${plain}`, spelling: latinSpelling(word), shown: word, sentence, offset: sentence.span.start + match.index }];
  });

/** How the usual spelling is written where it first appears (gitHub is shown GitHub). */
const shownUsual = (words: readonly Placed[], { word, usual }: OddSpelling<Placed>): string =>
  words.find((other) => other.key === word.key && other.spelling === usual)?.shown ?? usual;

const findingOf = (words: readonly Placed[], odd: OddSpelling<Placed>): Finding => ({
  rule: "",
  severity: "info",
  line: 0,
  column: 0,
  quote: odd.word.sentence.text.trim(),
  values: { written: odd.word.shown ?? odd.word.spelling, other: shownUsual(words, odd), count: odd.count, of: odd.of, offset: odd.word.offset },
});

/**
 * One word written two ways in one document (出来る and できる, 引っ越し and 引越し, ウィンドウ and ウインドウ, e-mail and email),
 * found without a list of words: the document's own words are grouped by reading or by an evened-out spelling, and the way the
 * document writes less is pointed at. No way is called right; limit is the largest share, in percent, the minority may have.
 */
export const orthographicVariant: Detector = (doc, options): Finding[] => {
  const skip = new Set([...patternsOf(doc, DISTINCT), ...patternsOf(doc, FUKUSHI)]);
  const placed = doc.sentences.map((sentence) => ({ sentence, isOpen: isOpenIn(sentence, doc.names ?? []) }));
  const reading = byKanji(placed.flatMap(({ sentence, isOpen }) => readingWords(sentence, isOpen, skip)));
  const katakana = placed.flatMap(({ sentence, isOpen }) => katakanaWords(sentence, isOpen));
  const latin = placed.flatMap(({ sentence, isOpen }) => latinWords(sentence, isOpen, skip));
  const odd = [reading, katakana, latin].flatMap((words) => oddSpellings(words, options.limit));
  const all = [...reading, ...katakana, ...latin];
  // A word can be odd by its reading and by its katakana key at once; one place is said once.
  return [...new Map(odd.map((entry) => [entry.word.offset, entry])).values()].map((entry) => findingOf(all, entry));
};
