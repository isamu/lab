// proper-noun-density: names per 1000 words (characters in Japanese) of prose. A name counts once however many words
// it has, a line that is not a sentence is not prose, and the everyday names of lexicon everyday-name are not counted.
import { lengthOf, proseText } from "../measure.ts";
import { nameSpans } from "../team-names.ts";
import { QUOTATION_MARKS, quotedIn } from "../quoted-span.ts";
import type { Detector, Finding, ProseDocument, Sentence, Span, Token } from "../plugin.ts";

const PER = 1000;
/** 密度を見る rule は短い文書を測らない。単位は言語で違うので床も分ける。 */
const FLOOR = { word: 200, char: 500 };
const EVERYDAY_NAME = "everyday-name";
const PREDICATES: ReadonlySet<string> = new Set(["VERB", "AUX"]);
/**
 * What may stand between two words of one name: spaces, a hyphen, a slash, an initial's full stop, an ampersand, an apostrophe,
 * and an opening bracket, since a name's short form in brackets right after it is the same name (Office of the Comptroller (OCC)).
 */
const INSIDE_NAME = /^[\s\-‐/.&'’(（]*$/u;
const LATIN = /\p{Script=Latin}/u;
const CAPITAL = /\p{Lu}/u;
const LETTER = /\p{L}/u;
const LOWER_START = /^\p{Ll}/u;
const CONTENT: ReadonlySet<string> = new Set(["NOUN", "ADJ", "ADV"]);

/**
 * A word only prose has: a verb in lower case or in a script without case (a capitalised one is a title's: Arrangements to
 * Deliver Services), or any other lower-case content word, since the tagger can read a verb among many names as a noun (flew).
 */
const isProseWord = (token: Token): boolean => {
  if (PREDICATES.has(token.pos)) return !CAPITAL.test(token.surface.charAt(0));
  return CONTENT.has(token.pos) && LATIN.test(token.surface) && LOWER_START.test(token.surface);
};

/** A sentence may open with its verb (Moved by D. Kim, ...; Meet Alice at Contoso.). */
const opensWithVerb = (tokens: readonly Token[]): boolean => {
  const first = tokens.find((token) => LETTER.test(token.surface));
  return first !== undefined && PREDICATES.has(first.pos);
};

/**
 * A sentence with no word of prose is a line, not prose: a letterhead, a roster, a signature, an address, a heading, a list of
 * document titles or a table row read as text. A reader does not parse it as a sentence, so its names hide no sentence's shape.
 */
export const isProse = (sentence: Sentence): boolean => {
  const tokens = sentence.tokens ?? [];
  return opensWithVerb(tokens) || tokens.some(isProseWord);
};

/** A Latin word with no capital is no name, whatever the tagger said: the Japanese tagger marks English words (rule, requests) as proper nouns. */
const isNameWord = (token: Token): boolean => token.pos === "PROPN" && !(LATIN.test(token.surface) && !CAPITAL.test(token.surface));

const within = (spans: readonly Span[], token: Token): Span | undefined => spans.find((span) => token.span.start >= span.start && token.span.end <= span.end);

const spansIn = (sentence: Sentence, names: readonly string[]): Span[] =>
  nameSpans(sentence.text, names).map((span) => ({ start: sentence.span.start + span.start, end: sentence.span.start + span.end }));

const between = (sentence: Sentence, end: number, start: number): string => sentence.text.slice(end - sentence.span.start, start - sentence.span.start);

/** The first word of each name: adjacent name words (Federal Reserve System, 赤堀 政明, Randall D. Guynn) are one name. */
const nameStarts = (sentence: Sentence, everyday: readonly Span[]): Token[] => {
  const words = (sentence.tokens ?? []).filter((token) => isNameWord(token) && within(everyday, token) === undefined);
  return words.filter((token, index) => {
    const previous = words[index - 1];
    return previous === undefined || !INSIDE_NAME.test(between(sentence, previous.span.end, token.span.start));
  });
};

const tokensWithin = (sentence: Sentence, span: Span): Token[] =>
  (sentence.tokens ?? []).filter((token) => token.span.start >= span.start && token.span.end <= span.end);

/** Quoted words with no word of prose are a title: “Joint Statement on the Risk-Based Approach to Assessing Customer Relationships” is one name. */
const titlesIn = (sentence: Sentence): Span[] => quotedIn(sentence, QUOTATION_MARKS).filter((span) => !tokensWithin(sentence, span).some(isProseWord));

/**
 * The names one sentence counts. A name the team listed in chaff.yaml is one, however many names the words in it make
 * (Bank of England is one, not two), and so is a quoted title.
 */
export const namesIn = (sentence: Sentence, listed: readonly string[], everyday: readonly string[]): Token[] => {
  const named = [...spansIn(sentence, listed), ...titlesIn(sentence)];
  const counted = new Set<Span>();
  return nameStarts(sentence, spansIn(sentence, everyday)).filter((token) => {
    const name = within(named, token);
    if (name === undefined) return true;
    if (counted.has(name)) return false;
    counted.add(name);
    return true;
  });
};

const everydayNamesOf = (doc: ProseDocument): string[] => (doc.lexicons[EVERYDAY_NAME] ?? []).map((entry) => entry.pattern);

export const properNounDensity: Detector = (doc, options): Finding[] => {
  const prose = doc.sentences.filter(isProse);
  const everyday = everydayNamesOf(doc);
  const hits = prose.flatMap((sentence) => namesIn(sentence, doc.names ?? [], everyday).map((token) => ({ sentence, token })));
  const length = prose.reduce((sum, sentence) => sum + lengthOf(sentence, doc.lengthUnit), 0);
  const rate = length === 0 ? 0 : Math.round((hits.length / length) * PER);
  const first = hits[0];
  if (length < FLOOR[doc.lengthUnit] || first === undefined || rate <= options.limit) return [];
  return [
    {
      rule: "proper-noun-density",
      severity: "info",
      line: 0,
      column: 0,
      quote: proseText(first.sentence),
      values: { count: hits.length, density: rate, limit: options.limit, offset: first.token.span.start },
    },
  ];
};
