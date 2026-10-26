import type { Detector, Finding, Sentence, Span, TableCell, Token } from "../plugin.ts";
import { groupBy, oddSpellings, type KeyedWord, type OddSpelling } from "../spelling-variants.ts";
import { dropsOkurigana, kanjiKeyAmong, katakanaKey, lemmaReading } from "../kana-spelling.ts";
import { isKatakanaWord, stemOf } from "../long-vowel.ts";
import { withNounsAfterParticles } from "../nominal-stem.ts";
import { isWithinAny } from "../quoted-span.ts";
import { withCutNounsJoined } from "../split-noun.ts";
import { acronymsIn, isCapitalsNotSpelling, isNameInCapitals } from "../capitals-with-small.ts";
import { isPartOfAddress } from "./address-word.ts";
import { isInCapitalsPassage } from "../capitals-passage.ts";
import { withoutCoinedNames } from "../coined-hyphen-name.ts";
import { wholeWordRuns, type WholeWordRun } from "../whole-word-runs.ts";
import { entriesForGenre } from "../lexicon-genres.ts";
import { asNounWhereNominal, documentNounKeys } from "../nominal-stem.ts";
import { isCompoundHead } from "../compound-head.ts";
import { voiceAt, voiceStarts } from "../voice-parts.ts";
import {
  isCopulaReadAsVerb,
  isCutFromKatakana,
  isNumeral,
  isPieceOfKatakanaRun,
  isTouching,
  isWrittenOntoWord,
  useOf,
  type InContext,
  type Uses,
} from "../word-use.ts";
import { titleCaseNameRuns } from "../title-case-name.ts";
import { withoutQuotedSpellings, type Quoted } from "../quoted-spelling.ts";
import { citedSpans, isOpenIn, namesOf, patternsOf, type IsOpen, type Names } from "./orthographic-variant-open.ts";

/**
 * A word found in the document: where it is, which sentence it is in, its key and spelling, how it is written when that differs, and
 * whether it is written onto the noun after it (取扱事業者).
 */
type Placed = KeyedWord & {
  readonly sentence: Sentence;
  readonly offset: number;
  readonly shown?: string;
  readonly compoundHead?: boolean;
  /** Where a run of words ends (タイヤレバー). */
  readonly end?: number;
  /** Whether a Latin word stands in a name of capitalised words (the Interagency Group) or in a cited work. */
  readonly quoted?: Quoted | undefined;
  /** The name a word stands in, as written. */
  readonly name?: string | undefined;
};

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
/** Lexicon: verbs whose て-form opening a sentence before a comma is a conjunction (あわせて、). */
const CONJUNCTION = "orthographic-variant-conjunction";
/** Lexicon: verbs whose judging use (〜とみられる, 増加がみられる) is written in kana while the verb (資料を見る) keeps its kanji. */
const JUDGING = "orthographic-variant-judging";
/**
 * Lexicon: words whose kanji is also a person (方 as かた): compared only before が or で (早いほうが, 資料のほうで), where the
 * person is rare; before に, の or は (担当の方に) the kanji is mostly the person.
 */
const COMPARATIVE = "orthographic-variant-comparative";
const COMPARATIVE_PARTICLES = new Set(["が", "で"]);
/** Lexicon: katakana spellings of a word that name a sense of their own (モノ for goods, beside the formal noun もの). */
const SENSE = "orthographic-variant-katakana-sense";
/** Lexicon: sentences that open a separate voice (a justice's own opinion), as regular expressions. Each voice is compared on its own. */
const VOICE = "orthographic-variant-voice";
/** Lexicon: words the tokenizer cuts in one spelling and not the other (お客様, お客 and さま). Each is read whole, keyed by its group. */
const WHOLE_WORD = "orthographic-variant-whole-word";
/** Lexicon: suffixes written onto a word that do not make a compound of it (割当て等, 引受け後): the word keeps its okurigana there. */
const PHRASE_SUFFIX = "orthographic-variant-phrase-suffix";
/**
 * Lexicon: kanji spellings that read as two words, alone (行っ: 行く or 行う) or before the word written onto them (様を: さま,
 * where よう never takes を). Each entry's group is the reading the tokenizer may wrongly pick (イク, ヨウ): read that way, the
 * spelling is not compared with that reading's kana. Read the other way (行っ as 行う), it is compared as usual.
 */
const TWO_READINGS = "orthographic-variant-two-readings";
/** Lexicon: verbs whose て-form after を or で, with no verb after it, is 以て (決意をもって). Compared apart from the verb. */
const MEANS = "orthographic-variant-means";
/** Lexicon: the humble する (いたす), a helper after と (議題といたします) as it is written onto a noun. */
const LIGHT_VERB = "orthographic-variant-light-verb";
/** Lexicon shared with other rules: the small words inside a capitalised name (of, and). */
const NAME_JOINER = "name-joiner";

type Skips = Uses & {
  readonly skip: ReadonlySet<string>;
  readonly comparative: ReadonlySet<string>;
  readonly wholeWords: ReadonlyMap<string, string>;
  readonly phraseSuffixes: ReadonlySet<string>;
  readonly twoReadings: ReadonlyMap<string, string>;
  /** The document's nouns, as documentNounKeys keys them. */
  readonly nouns: ReadonlySet<string>;
};

/** A listed word outside the comparative frame (担当の方に): the kanji there may be the person of the same reading. */
const isOutsideComparative = ({ token, following }: InContext, comparative: ReadonlySet<string>): boolean =>
  comparative.has(token.lemma ?? "") && !COMPARATIVE_PARTICLES.has(following?.[0]?.surface ?? "");

/** A spelling listed as reading two ways, alone or with the word written onto it (様を), read as the reading in doubt. */
const readsTwoWays = ({ token, following }: InContext, reading: string, twoReadings: ReadonlyMap<string, string>): boolean => {
  const next = following?.[0];
  const withNext = next !== undefined && isTouching(token, next) ? twoReadings.get(`${token.surface}${next.surface}`) : undefined;
  return (twoReadings.get(token.surface) ?? withNext) === reading;
};

/** A piece the tokenizer cut from a word (ラオ|カイ, 誂ら|え), a pronoun's kana (私みたような) or a numeral (三十の三). */
const isNotAWordOfItsOwn = (word: InContext): boolean => isPieceOfKatakanaRun(word) || isNumeral(word.token) || isWrittenOntoWord(word);

const readingKeyOf = (word: InContext, skips: Skips): string | undefined => {
  const { skip } = skips;
  const { token } = word;
  const lemma = token.lemma;
  if (!CONTENT.has(token.pos) || token.reading === undefined || lemma === undefined || !JAPANESE_WORD.test(lemma) || skip.has(lemma)) return undefined;
  if (isOutsideComparative(word, skips.comparative)) return undefined;
  const reading = lemmaReading(token.surface, lemma, token.reading);
  if (reading === undefined || [...reading].length < MIN_READING || skip.has(reading) || isCutFromKatakana(word) || isCopulaReadAsVerb(word)) return undefined;
  if (readsTwoWays(word, reading, skips.twoReadings) || isNotAWordOfItsOwn(word)) return undefined;
  return `${token.pos}|${useOf(word, skips)}|${reading}`;
};

/**
 * A listed word keyed by its group, so its spellings meet however the tokenizer cut each one. Not by reading: お父様 is read
 * オ + トウサマ and お父さま オ + チチ + サマ.
 */
const wholeWordOf = (
  sentence: Sentence,
  tokens: readonly Token[],
  { first, last, word }: WholeWordRun,
  isOpen: IsOpen,
  groups: ReadonlyMap<string, string>,
): Placed[] => {
  const [head, tail] = [tokens[first], tokens[last]];
  if (head === undefined || tail === undefined || !isOpen(head.span.start - sentence.span.start, tail.span.end - sentence.span.start)) return [];
  return [{ key: `whole|${groups.get(word) ?? word}`, spelling: word, sentence, offset: head.span.start }];
};

/** Japanese words keyed by part of speech, use and the reading of the dictionary form, spelled as the dictionary form. */
const readingWords = (sentence: Sentence, isOpen: IsOpen, skips: Skips): Placed[] => {
  const tokens = withNounsAfterParticles(sentence.tokens ?? []);
  const runs = wholeWordRuns(tokens, skips.wholeWords);
  const inRun = new Set(runs.flatMap(({ first, last }) => Array.from({ length: last - first + 1 }, (_, extra) => first + extra)));
  const whole = runs.flatMap((run) => wholeWordOf(sentence, tokens, run, isOpen, skips.wholeWords));
  return [
    ...whole,
    ...tokens.flatMap((written, at): Placed[] => {
      if (inRun.has(at)) return [];
      const next = tokens[at + 1];
      const token = asNounWhereNominal(written, next, skips.phraseSuffixes, skips.nouns);
      const key = readingKeyOf({ token, previous: tokens[at - 1], before: tokens[at - 2], following: tokens.slice(at + 1, at + 3) }, skips);
      const local = token.span.start - sentence.span.start;
      if (key === undefined || token.lemma === undefined || !isOpen(local, local + token.surface.length)) return [];
      const compoundHead = isCompoundHead(token, tokens, at, skips.phraseSuffixes);
      return [{ key, spelling: token.lemma, sentence, offset: token.span.start, compoundHead }];
    }),
  ];
};

/**
 * Same reading is not yet same word: 書く and 描く are both カク. Spellings meet only when they keep the same kanji (引っ越し, 引越し)
 * or one is all kana. A kana spelling joins the kanji one only when the reading has a single kanji spelling in the document;
 * with two (橋 and 箸 beside はし) it cannot say which, and is left out. Official Japanese drops okurigana at the head of a compound
 * (取扱事業者 beside 個人情報の取扱い), so where the document writes a word both ways, its compound heads are compared apart. A head of
 * one kanji without its okurigana (曇 of 曇雨天, beside 曇り) is a Sino-Japanese element of the compound and is not compared at all.
 */
const ONE_KANJI = /^\p{Script=Han}$/u;

const isOneKanjiElement = (word: Placed, spellings: readonly string[]): boolean =>
  word.compoundHead === true && ONE_KANJI.test(word.spelling) && dropsOkurigana(word.spelling, spellings);

const byKanji = (words: readonly Placed[]): Placed[] =>
  [...groupBy(words, (word) => word.key).values()].flatMap((group) => {
    const spellings = [...new Set(group.map((word) => word.spelling))];
    const skeletonOf = (spelling: string): string => kanjiKeyAmong(spelling, spellings);
    const skeletons = [...new Set(spellings.map(skeletonOf).filter((skeleton) => skeleton !== ""))];
    const apart = spellings.some((spelling) => dropsOkurigana(spelling, spellings)) ? "|compound" : "";
    return group.flatMap((word): Placed[] => {
      const own = skeletonOf(word.spelling);
      if ((own === "" && skeletons.length > 1) || isOneKanjiElement(word, spellings)) return [];
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

const isKatakanaNoun = (token: Token): boolean => token.pos === "NOUN" && isKatakanaWord(token.surface);

/** Katakana nouns written onto each other (タイヤ and レバー in タイヤレバー), each run whole: one place may be cut into words another is not. */
const katakanaRuns = (tokens: readonly Token[]): Token[][] =>
  tokens.reduce<Token[][]>((runs, token, at) => {
    if (!isKatakanaNoun(token)) return runs;
    const last = runs.at(-1);
    if (last !== undefined && isTouching(tokens[at - 1], token) && last.at(-1) === tokens[at - 1]) last.push(token);
    else runs.push([token]);
    return runs;
  }, []);

/**
 * Katakana runs keyed like one katakana word, spelled as their words' stems joined: タイヤーレバー (one unknown word) meets
 * タイヤレバー read as タイヤ and レバー, while the final ー of a word inside the run (サーバーリスト and サーバリスト) stays katakana-long-vowel's.
 */
const katakanaRunWords = (sentence: Sentence, isOpen: IsOpen): Placed[] =>
  katakanaRuns(sentence.tokens ?? []).flatMap((run): Placed[] => {
    const [first, last] = [run[0], run.at(-1)];
    if (first === undefined || last === undefined) return [];
    const [start, end] = [first.span.start - sentence.span.start, last.span.end - sentence.span.start];
    const key = katakanaKey(run.map((token) => token.surface).join(""));
    if ([...key].length < MIN_KATAKANA_KEY || !isOpen(start, end)) return [];
    return [
      {
        key: `kana|${key}`,
        spelling: run.map((token) => stemOf(token.surface)).join(""),
        shown: run.map((token) => token.surface).join(""),
        sentence,
        offset: first.span.start,
        end: last.span.end,
      },
    ];
  });

/** Whether a run holds a place another key already points at: the word inside it is said, not the run around it. */
const coversOffset = (run: Placed, offset: number): boolean => offset >= run.offset && offset < (run.end ?? run.offset + 1);

const HASHTAG_MARK = "#";
const WORD_CHARACTER = /[\p{L}\p{N}_]/u;

/** A word written as a hashtag (#vimconf): spelled as the service matches it, like an address. */
const isHashtag = (text: string, start: number): boolean => text.charAt(start - 1) === HASHTAG_MARK && !WORD_CHARACTER.test(text.charAt(start - 2));

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
const latinWords = ({ sentence, isOpen, cited }: Place, skip: ReadonlySet<string>, joiners: readonly string[]): Placed[] => {
  const { text } = sentence;
  const acronyms = acronymsIn(text);
  const names = titleCaseNameRuns(text, joiners);
  const quotedAt = (start: number, end: number): Pick<Placed, "quoted" | "name"> => {
    if (isWithinAny(cited, { start, end })) return { quoted: "cited" };
    const run = names.find(({ name }) => name.start <= start && end <= name.end);
    if (run === undefined) return {};
    const name = text.slice(run.name.start, run.name.end);
    return run.quoted !== undefined && isWithinAny([run.quoted], { start, end }) ? { quoted: "name", name } : { name };
  };
  return [...text.matchAll(LATIN_WORD)].flatMap((match): Placed[] => {
    const word = match[0];
    const plain = word.toLowerCase().replaceAll("-", "");
    const [start, end] = [match.index, match.index + word.length];
    if (plain.length < MIN_LATIN_KEY || !LOWER.test(word) || isCapitalsNotSpelling(word, acronyms) || skip.has(word.toLowerCase())) return [];
    if (isPartOfAddress(text, start, end) || isHashtag(text, start) || !isOpen(start, end) || isInCapitalsPassage(text, start, end)) return [];
    if (isNameInCapitals(text, start, word)) return [];
    return [{ key: `latin|${plain}`, spelling: latinSpelling(word), shown: word, sentence, offset: sentence.span.start + start, ...quotedAt(start, end) }];
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

/** A cell that is one Latin word in lower case (openapi, contentType): a field name or a value, spelled by the data and not by the writer. */
const DATA_KEY_CELL = /^\p{Ll}[A-Za-z0-9]*$/u;

/** A sentence or a table cell, where its words are the writer's, whether its Latin words are read, and its cited works. */
type Place = { readonly sentence: Sentence; readonly isOpen: IsOpen; readonly readsLatin: boolean; readonly cited: readonly Span[] };

/** What the words of a document are read with besides the lexicons of uses: the dictionary, and the small words inside a name (of). */
type Reading = { readonly isWord: (word: string) => boolean; readonly nameJoiners: readonly string[] };

/** A link's brackets and where it goes (`[`, `](#contentType)`, `][ref]`). The prose hides them outside tables; a cell keeps the Markdown as written. */
const LINK_CHROME = /\]\([^)]*\)|\]\[[^\]]*\]|\[/gu;

const withoutLinkChrome = (text: string): string => text.replaceAll(LINK_CHROME, (chrome) => " ".repeat(chrome.length));

/** A body cell of a table read as a sentence of its own: the prose covers tables, so a cell's words (片栗粉 in a list of ingredients) are not in the sentences. Header rows stay out. */
const cellPlace = (cell: TableCell, names: Names): Place => {
  const text = withoutLinkChrome(cell.text);
  const sentence: Sentence = { span: { start: cell.start, end: cell.end }, text, tokens: cell.tokens ?? [] };
  return { sentence, isOpen: isOpenIn(sentence, names), readsLatin: !DATA_KEY_CELL.test(text.trim()), cited: citedSpans(sentence, names) };
};

/** The odd spellings among places that speak in one voice. */
const findingsIn = (placed: readonly Place[], skips: Skips, { isWord, nameJoiners }: Reading, limit: number): Finding[] => {
  const reading = byKanji(placed.flatMap(({ sentence, isOpen }) => readingWords(withCutNounsJoined(sentence, skips.nouns), isOpen, skips)));
  const katakana = placed.flatMap(({ sentence, isOpen }) => katakanaWords(sentence, isOpen));
  const runs = placed.flatMap(({ sentence, isOpen }) => katakanaRunWords(sentence, isOpen));
  const latin = withoutQuotedSpellings(
    withoutCoinedNames(
      placed.flatMap((place) => (place.readsLatin ? latinWords(place, skips.skip, nameJoiners) : [])),
      isWord,
    ),
    isWord,
  );
  const odd = [reading, katakana, latin].flatMap((words) => oddSpellings(words, limit));
  const oddRuns = oddSpellings(runs, limit).filter(({ word }) => !odd.some((other) => coversOffset(word, other.word.offset)));
  const all = [...reading, ...katakana, ...runs, ...latin];
  // A word can be odd by its reading and by its katakana key at once; one place is said once.
  return [...new Map([...odd, ...oddRuns].map((entry) => [entry.word.offset, entry])).values()].map((entry) => findingOf(all, entry));
};

/**
 * One word written two ways in one document (出来る and できる, 引っ越し and 引越し, ウィンドウ and ウインドウ, e-mail and email),
 * found without a list of words: the document's own words are grouped by reading or by an evened-out spelling, and the way the
 * document writes less is pointed at. No way is called right; limit is the largest share, in percent, the minority may have.
 */
export const orthographicVariant: Detector = (doc, options): Finding[] => {
  const names = namesOf(doc, options.genre);
  const placed: Place[] = [
    ...doc.sentences.map((sentence) => ({ sentence, isOpen: isOpenIn(sentence, names), readsLatin: true, cited: citedSpans(sentence, names) })),
    ...(doc.tableCells?.() ?? []).map((cell) => cellPlace(cell, names)),
  ];
  const phraseSuffixes = new Set(patternsOf(doc, PHRASE_SUFFIX, options.genre));
  const skips: Skips = {
    skip: new Set([...patternsOf(doc, DISTINCT, options.genre), ...patternsOf(doc, FUKUSHI, options.genre)]),
    idioms: new Set(patternsOf(doc, IDIOM, options.genre)),
    conjunctions: new Set(patternsOf(doc, CONJUNCTION, options.genre)),
    judging: new Set(patternsOf(doc, JUDGING, options.genre)),
    senses: new Set(patternsOf(doc, SENSE, options.genre)),
    means: new Set(patternsOf(doc, MEANS, options.genre)),
    lightVerbs: new Set(patternsOf(doc, LIGHT_VERB, options.genre)),
    comparative: new Set(patternsOf(doc, COMPARATIVE, options.genre)),
    wholeWords: new Map((doc.lexicons[WHOLE_WORD] ?? []).map((entry) => [entry.pattern, entry.group ?? entry.pattern])),
    phraseSuffixes,
    twoReadings: new Map(entriesForGenre(doc.lexicons[TWO_READINGS] ?? [], options.genre).map((entry) => [entry.pattern, entry.group ?? ""])),
    nouns: documentNounKeys(
      placed.map(({ sentence }) => sentence.tokens ?? []),
      phraseSuffixes,
    ),
  };
  const dictionary = doc.dictionary?.();
  const reading: Reading = {
    isWord: (word: string): boolean => dictionary?.has(word) ?? true,
    nameJoiners: (doc.lexicons[NAME_JOINER] ?? []).map((entry) => entry.pattern),
  };
  const starts = voiceStarts(
    doc.sentences,
    patternsOf(doc, VOICE, options.genre).map((pattern) => new RegExp(pattern, "u")),
  );
  const voices = groupBy(placed, ({ sentence }) => String(voiceAt(starts, sentence.span.start)));
  return [...voices.values()].flatMap((voice) => findingsIn(voice, skips, reading, options.limit));
};
