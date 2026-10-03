import type { Detector, Finding, Lexicon, Sentence, Token } from "../plugin.ts";
import { densityFindings } from "./ai-phrasing.ts";

/**
 * The word kinds an article can stand before. A conjunction, a preposition or a verb after "a" is the letter a ("option A
 * or B", "a is the length").
 */
const CONTENT = new Set(["NOUN", "PROPN", "ADJ", "ADV", "NUM"]);

const LETTER_START = /^\p{L}/u;
const HAS_LOWER = /\p{Ll}/u;
/** A lower-case letter before capitals (mRNA, pH is not): the first letter is said by its name. */
const LETTER_BEFORE_CAPITALS = /^\p{Ll}\p{Lu}{2}/u;

/** Two tokens with nothing but whitespace between them in the source. Code and markup are hidden from the tokens. */
const adjacent = (source: string, left: Token, right: Token): boolean => source.slice(left.span.end, right.span.start).trim() === "";

/** The sound knowledge of lexicon article-sound, by group. */
export type ArticleSounds = {
  readonly vowelLetters: ReadonlySet<string>;
  readonly vowelLetterNames: ReadonlySet<string>;
  readonly eitherLetterNames: ReadonlySet<string>;
  readonly consonant: readonly string[];
  readonly vowel: readonly string[];
  readonly word: ReadonlySet<string>;
  readonly either: readonly string[];
};

const ofGroup = (lexicon: Lexicon, group: string): string[] => lexicon.filter((entry) => entry.group === group).map((entry) => entry.pattern);

export const articleSoundsOf = (lexicon: Lexicon): ArticleSounds => ({
  vowelLetters: new Set(ofGroup(lexicon, "vowel-letter")),
  vowelLetterNames: new Set(ofGroup(lexicon, "letter-name-vowel")),
  eitherLetterNames: new Set(ofGroup(lexicon, "letter-name-either")),
  consonant: ofGroup(lexicon, "consonant"),
  vowel: ofGroup(lexicon, "vowel"),
  word: new Set(ofGroup(lexicon, "word")),
  either: ofGroup(lexicon, "either"),
});

const startsWithAny = (word: string, starts: readonly string[]): boolean => starts.some((start) => word.startsWith(start));

/** Whether a word in lower or mixed case starts with a vowel sound; undefined when it is said both ways. */
const wordSound = (word: string, sounds: ArticleSounds): boolean | undefined => {
  const lower = word.toLowerCase();
  if (startsWithAny(lower, sounds.either)) return undefined;
  if (startsWithAny(lower, sounds.vowel)) return true;
  if (startsWithAny(lower, sounds.consonant)) return false;
  return sounds.vowelLetters.has(lower.charAt(0));
};

/** Capitals longer than this that hold a vowel may be said as a word (SALT, GIF), so only the lexicon decides them. */
const SPELLED_OUT_LENGTH = 3;

/** Whether capitals not in the lexicon are surely said letter by letter: short (MBA), or with no vowel to say (HTTP). */
const isSpelledOut = (word: string, sounds: ArticleSounds): boolean =>
  word.length <= SPELLED_OUT_LENGTH || ![...word.toLowerCase()].some((letter) => sounds.vowelLetters.has(letter));

/**
 * Whether a word starts with a vowel sound. Capitals are read as the lexicon says (a NASA probe), else letter by letter when
 * surely spelled out (an MBA). undefined when the word may be said both ways (a SQL, an SQL; a or an HTTP) or nothing says how.
 */
export const startsWithVowelSound = (word: string, sounds: ArticleSounds): boolean | undefined => {
  if (LETTER_BEFORE_CAPITALS.test(word)) return sounds.vowelLetterNames.has(word.charAt(0).toUpperCase());
  if (HAS_LOWER.test(word)) return wordSound(word, sounds);
  if (sounds.either.includes(word) || sounds.eitherLetterNames.has(word.charAt(0))) return undefined;
  if (sounds.word.has(word)) return wordSound(word, sounds);
  return isSpelledOut(word, sounds) ? sounds.vowelLetterNames.has(word.charAt(0)) : undefined;
};

const ARTICLES: Readonly<Record<string, boolean>> = { a: false, an: true };

/** The article the next word takes, written in the case of the one written ("A apple" → "An"). */
const fitting = (written: string, vowel: boolean): string => {
  const article = vowel ? "an" : "a";
  return written.charAt(0) === written.charAt(0).toUpperCase() ? `${article.charAt(0).toUpperCase()}${article.slice(1)}` : article;
};

type Slip = { readonly article: Token; readonly next: Token; readonly fits: string };

/** An article that does not fit the sound of the word after it. */
const WORD = /\p{L}/u;

/**
 * Whether a token is the article "a" or "an": lower case, or capitalised as the first word of the sentence. A capital A
 * inside a sentence is a letter ("grade A eggs", "vitamin A intake").
 */
const isArticle = (token: Token, at: number, tokens: readonly Token[]): boolean => {
  const first = tokens.findIndex((candidate) => WORD.test(candidate.surface));
  return token.surface === token.surface.toLowerCase() || at === first;
};

const slipAt = (source: string, tokens: readonly Token[], at: number, sounds: ArticleSounds): Slip | undefined => {
  const article = tokens[at];
  const next = tokens[at + 1];
  const takesAn = ARTICLES[article?.surface.toLowerCase() ?? ""];
  if (article === undefined || next === undefined || takesAn === undefined || !isArticle(article, at, tokens)) return undefined;
  if (!CONTENT.has(next.pos) || !LETTER_START.test(next.surface)) return undefined;
  if (!adjacent(source, article, next)) return undefined;
  const vowel = startsWithVowelSound(next.surface, sounds);
  return vowel === undefined || vowel === takesAn ? undefined : { article, next, fits: fitting(article.surface, vowel) };
};

const slipFinding = (sentence: Sentence, slip: Slip): Finding => ({
  rule: "",
  severity: "warning",
  line: 0,
  column: 0,
  quote: sentence.text.trim(),
  values: { matched: `${slip.article.surface} ${slip.next.surface}`, article: slip.fits, offset: slip.article.span.start },
});

/** "a" before a vowel sound or "an" before a consonant sound (a apple, an user), by the sound knowledge in the lexicon. */
export const articleSound: Detector = (doc, options): Finding[] => {
  const sounds = articleSoundsOf(options.lexicon ?? []);
  const findings = doc.sentences.flatMap((sentence) => {
    const tokens = sentence.tokens ?? [];
    return tokens.flatMap((_token, at) => {
      const slip = slipAt(doc.source, tokens, at, sounds);
      return slip === undefined ? [] : [slipFinding(sentence, slip)];
    });
  });
  return findings.length < options.limit ? [] : findings;
};

const ADJECTIVE = "ADJ";

type Intensified = { readonly sentence: Sentence; readonly matched: string; readonly offset: number };

type IntensifierWords = { readonly intensifiers: ReadonlySet<string>; readonly exceptions: ReadonlySet<string> };

/** The lexicon's intensifier right before an adjective ("very important"), not before an excepted word ("the very first"). */
const intensifiedIn = (source: string, sentence: Sentence, words: IntensifierWords): Intensified[] => {
  const tokens = sentence.tokens ?? [];
  return tokens.flatMap((token, at) => {
    const next = tokens[at + 1];
    if (next === undefined || !words.intensifiers.has(token.surface.toLowerCase()) || next.pos !== ADJECTIVE) return [];
    if (!adjacent(source, token, next)) return [];
    return words.exceptions.has(next.surface.toLowerCase()) ? [] : [{ sentence, matched: `${token.surface} ${next.surface}`, offset: token.span.start }];
  });
};

const EXCEPTIONS = "very-exception";

/** "very" + adjective, dense for the document's length: each one leans on "very" instead of a stronger word. */
export const intensifiedAdjective: Detector = (doc, options): Finding[] => {
  const words = {
    intensifiers: new Set((options.lexicon ?? []).map((entry) => entry.pattern)),
    exceptions: new Set((doc.lexicons[EXCEPTIONS] ?? []).map((entry) => entry.pattern)),
  };
  return densityFindings(
    doc,
    doc.sentences.flatMap((sentence) => intensifiedIn(doc.source, sentence, words)),
    options.limit,
  );
};
