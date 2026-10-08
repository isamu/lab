import type { Detector, Finding, ProseDocument, Sentence, Token } from "../plugin.ts";
import { groupBy, oddSpellings, type KeyedWord, type OddSpelling } from "../spelling-variants.ts";
import { dropsOkurigana, kanjiSkeleton, katakanaKey, lemmaReading } from "../kana-spelling.ts";
import { isKatakanaWord, stemOf } from "../long-vowel.ts";
import { QUOTATION_MARKS, isWithinAny, quotedSpans } from "../quoted-span.ts";
import { nameSpans, touchesAny } from "../team-names.ts";
import { furiganaSpans } from "../furigana.ts";
import { acronymsIn, isCapitalsNotSpelling } from "../capitals-with-small.ts";
import { isPartOfAddress } from "./address-word.ts";

/**
 * A word found in the document: where it is, which sentence it is in, its key and spelling, how it is written when that differs, and
 * whether it is written onto the noun after it (取扱事業者).
 */
type Placed = KeyedWord & { readonly sentence: Sentence; readonly offset: number; readonly shown?: string; readonly compoundHead?: boolean };

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
/** Lexicon: idioms written as noun, particle and verb (気をつける). The verb there is compared apart from the verb on its own. */
const IDIOM = "orthographic-variant-idiom";

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

/**
 * Whether a stretch of the sentence is outside a quotation, the team's names and a reading in brackets (HTTP（えいちてぃーてぃーぴー）):
 * the first two keep their own spelling, and a reading is not a spelling at all.
 */
const isOpenIn = (sentence: Sentence, names: readonly string[]): IsOpen => {
  const closed = [...quotedSpans(sentence.text, QUOTATION_MARKS), ...furiganaSpans(sentence.text)];
  const named = nameSpans(sentence.text, names);
  return (start, end) => !isWithinAny(closed, { start, end }) && !touchesAny(named, start, end);
};

/** A word and the two words before it, in its sentence. */
type InContext = { readonly token: Token; readonly previous: Token | undefined; readonly before: Token | undefined };

/** A verb's て-form the tokenizer read as a conjunction (追って at the head of a sentence): a kanji stem and て or で. Connectives (そして, それで) are kana. */
const TE_FORM_CONJUNCTION = /^\p{Script=Han}.*[てで]$/u;

/** After a て-form (見てみる). The tokenizer reads the て as a joining word, or the whole て-form as a conjunction (追って / みる). */
const followsTeForm = (previous: Token | undefined): boolean =>
  (previous?.pos === "SCONJ" && (previous.surface === "て" || previous.surface === "で")) ||
  (previous?.pos === "CCONJ" && TE_FORM_CONJUNCTION.test(previous.surface));

/** は or も after a word ending in で, て or く: the ない after them negates (事実ではない, どれでもない, 高くはない); it is not 無い. */
const TOPIC_AFTER_LINK = new Set(["は", "も"]);
const LINK_END = /[でてく]$/u;
const NEGATION = new Set(["ない", "無い"]);

/** では and でも read as one word after a space (2 ではなく). */
const LINK_AND_TOPIC = new Set(["では", "でも"]);

const followsLinkAndTopic = (previous: Token | undefined, before: Token | undefined): boolean =>
  LINK_AND_TOPIC.has(previous?.surface ?? "") || (previous?.pos === "ADP" && TOPIC_AFTER_LINK.has(previous.surface) && LINK_END.test(before?.surface ?? ""));

const negatesAfterTopic = ({ token, previous, before }: InContext): boolean =>
  token.pos === "ADJ" && NEGATION.has(token.lemma ?? "") && followsLinkAndTopic(previous, before);

const isHelper = (word: InContext): boolean => word.token.features?.["Bound"] === "Yes" || followsTeForm(word.previous) || negatesAfterTopic(word);

const isTouching = (left: Token | undefined, right: Token): boolean => left !== undefined && left.span.end === right.span.start;

const HIRAGANA_ONLY = /^[ぁ-ゖー]+$/u;

/** A kana noun written onto a noun (全員ぶん): a suffix, which may not be the free noun of the same reading (文). */
const isKanaSuffix = ({ token, previous }: InContext): boolean =>
  token.pos === "NOUN" && previous?.pos === "NOUN" && isTouching(previous, token) && HIRAGANA_ONLY.test(token.surface);

/** The verb of an idiom (気をつける): the noun, the particle and the verb's dictionary form are in the idiom lexicon. */
const isIdiomVerb = ({ token, previous, before }: InContext, idioms: ReadonlySet<string>): boolean =>
  token.pos === "VERB" && previous?.pos === "ADP" && before !== undefined && idioms.has(`${before.surface}${previous.surface}${token.lemma ?? token.surface}`);

/**
 * A helper verb or a dependent noun (見て下さい, その事) is written kana by many guides while the full word keeps its kanji (資料を下さい).
 * The two uses are compared apart, so a document that follows that convention is consistent. A suffix (業務用, 全員ぶん) is a third use:
 * it is not the dependent noun of the same reading (このように). The verb of an idiom (気をつける) is a fourth.
 */
const useOf = (word: InContext, idioms: ReadonlySet<string>): string => {
  if (isIdiomVerb(word, idioms)) return "idiom";
  if (isKanaSuffix(word)) return "suffix";
  if (!isHelper(word)) return "free";
  return word.token.pos === "NOUN" && word.token.features?.["NounType"] !== "Dependent" ? "suffix" : "bound";
};

/** One katakana and then kana that is not katakana (スる): no verb stem is one katakana long, as サボる and ググる are two. */
const ONE_KATAKANA_HEAD = /^\p{Script=Katakana}(?!\p{Script=Katakana})/u;
const KATAKANA_END = /\p{Script=Katakana}$/u;

/** A piece the tokenizer cut out of a katakana run (ミスっ read as ミ and スる): not a word of its own. */
const isCutFromKatakana = ({ token, previous }: InContext): boolean =>
  ONE_KATAKANA_HEAD.test(token.surface) && token.surface.length > 1 && isTouching(previous, token) && KATAKANA_END.test(previous?.surface ?? "");

/**
 * で read as the verb 出る right after a word with no particle between (JSON でない): the copula's で, which the tokenizer
 * misreads after a space or a name. 出る after a particle (結果がでない) or at the head of a sentence (でない音) is the verb.
 */
const isCopulaReadAsVerb = ({ token, previous }: InContext): boolean =>
  token.pos === "VERB" && token.surface === "で" && previous !== undefined && previous.pos !== "ADP";

type Skips = { readonly skip: ReadonlySet<string>; readonly idioms: ReadonlySet<string> };

const readingKeyOf = (word: InContext, { skip, idioms }: Skips): string | undefined => {
  const { token } = word;
  const lemma = token.lemma;
  if (!CONTENT.has(token.pos) || token.reading === undefined || lemma === undefined || !JAPANESE_WORD.test(lemma) || skip.has(lemma)) return undefined;
  const reading = lemmaReading(token.surface, lemma, token.reading);
  if (reading === undefined || [...reading].length < MIN_READING || skip.has(reading) || isCutFromKatakana(word) || isCopulaReadAsVerb(word)) return undefined;
  return `${token.pos}|${useOf(word, idioms)}|${reading}`;
};

/** Japanese words keyed by part of speech, use and the reading of the dictionary form, spelled as the dictionary form. */
const readingWords = (sentence: Sentence, isOpen: IsOpen, skips: Skips): Placed[] => {
  const tokens = sentence.tokens ?? [];
  return tokens.flatMap((token, at): Placed[] => {
    const key = readingKeyOf({ token, previous: tokens[at - 1], before: tokens[at - 2] }, skips);
    const local = token.span.start - sentence.span.start;
    if (key === undefined || token.lemma === undefined || !isOpen(local, local + token.surface.length)) return [];
    const next = tokens[at + 1];
    const compoundHead = token.pos === "NOUN" && next?.pos === "NOUN" && isTouching(token, next);
    return [{ key, spelling: token.lemma, sentence, offset: token.span.start, compoundHead }];
  });
};

/**
 * Same reading is not yet same word: 書く and 描く are both カク. Spellings meet only when they keep the same kanji (引っ越し, 引越し)
 * or one is all kana. A kana spelling joins the kanji one only when the reading has a single kanji spelling in the document;
 * with two (橋 and 箸 beside はし) it cannot say which, and is left out. Official Japanese drops okurigana at the head of a compound
 * (取扱事業者 beside 個人情報の取扱い), so where the document writes a word both ways, its compound heads are compared apart.
 */
const byKanji = (words: readonly Placed[]): Placed[] =>
  [...groupBy(words, (word) => word.key).values()].flatMap((group) => {
    const skeletons = [...new Set(group.map((word) => kanjiSkeleton(word.spelling)).filter((skeleton) => skeleton !== ""))];
    const spellings = [...new Set(group.map((word) => word.spelling))];
    const apart = spellings.some((spelling) => dropsOkurigana(spelling, spellings)) ? "|compound" : "";
    return group.flatMap((word): Placed[] => {
      const own = kanjiSkeleton(word.spelling);
      if (own === "" && skeletons.length > 1) return [];
      const use = word.compoundHead === true ? apart : "";
      return [{ ...word, key: `${word.key}|${own === "" ? (skeletons[0] ?? "") : own}${use}` }];
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

/**
 * Latin words keyed without hyphens and case (e-mail and email, GitHub and Github). A word in capitals only (TEAMS, MAY) is
 * emphasis or an acronym, not a spelling of the word, and is left out; so are a name in capitals with an ending (SENDs) and
 * the letters of an acronym of the sentence picked out (CLImatology for CLIPER).
 */
const latinWords = (sentence: Sentence, isOpen: IsOpen, skip: ReadonlySet<string>): Placed[] => {
  const acronyms = acronymsIn(sentence.text);
  return [...sentence.text.matchAll(LATIN_WORD)].flatMap((match): Placed[] => {
    const word = match[0];
    const plain = word.toLowerCase().replaceAll("-", "");
    const end = match.index + word.length;
    if (plain.length < MIN_LATIN_KEY || !LOWER.test(word) || isCapitalsNotSpelling(word, acronyms) || skip.has(word.toLowerCase())) return [];
    if (isPartOfAddress(sentence.text, match.index, end) || !isOpen(match.index, end)) return [];
    return [{ key: `latin|${plain}`, spelling: latinSpelling(word), shown: word, sentence, offset: sentence.span.start + match.index }];
  });
};

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
  const skips: Skips = { skip: new Set([...patternsOf(doc, DISTINCT), ...patternsOf(doc, FUKUSHI)]), idioms: new Set(patternsOf(doc, IDIOM)) };
  const placed = doc.sentences.map((sentence) => ({ sentence, isOpen: isOpenIn(sentence, doc.names ?? []) }));
  const reading = byKanji(placed.flatMap(({ sentence, isOpen }) => readingWords(sentence, isOpen, skips)));
  const katakana = placed.flatMap(({ sentence, isOpen }) => katakanaWords(sentence, isOpen));
  const latin = placed.flatMap(({ sentence, isOpen }) => latinWords(sentence, isOpen, skips.skip));
  const odd = [reading, katakana, latin].flatMap((words) => oddSpellings(words, options.limit));
  const all = [...reading, ...katakana, ...latin];
  // A word can be odd by its reading and by its katakana key at once; one place is said once.
  return [...new Map(odd.map((entry) => [entry.word.offset, entry])).values()].map((entry) => findingOf(all, entry));
};
