import type { ProseDocument, Span, Token } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";
import { isKnownWord, type Speller } from "../spelling.ts";
import { isInverseOrder, isListedPair, isOtherEnding, type WordEnding } from "../name-variant-shapes.ts";
import { titleSlipsIn } from "../name-title-slip.ts";

// name-variant が、似た二つの形を一つの名前の書き分けではなく別の二つと見る所。中黒で並べた二つの語、ある向きとその逆、語の別の
// 形（Texan と Texas）、同じ文に並べた一字違いの二つの名前、文書が二度以上使う名前の語、文や行の頭で大文字になったふつうの語、
// 引用した題の大文字、動詞の語幹。

/** A finding before it is rendered: where, the pointed form, the usual form and how they differ. */
export type Found = { readonly offset: number; readonly name: string; readonly usual: string; readonly kind: string };

const patternsOf = (doc: ProseDocument, id: string): string[] => (doc.lexicons[id] ?? []).map((entry) => entry.pattern);

const wordEndingsOf = (doc: ProseDocument): WordEnding[] =>
  (doc.lexicons["name-word-ending"] ?? []).flatMap((entry) => (entry.instead_of === undefined ? [] : [{ ending: entry.pattern, insteadOf: entry.instead_of }]));

/** Where a whole word or name is written, as written. */
const offsetsOf = (text: string, surface: string): number[] =>
  [...text.matchAll(new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(surface)}(?![\\p{L}\\p{N}])`, "gu"))].map((found) => found.index ?? 0);

/** The word in which a one-letter variant differs from its usual form. */
const differingWord = (name: string, usual: string): string | undefined => {
  const [words, others] = [name.split(/\s+/u), usual.split(/\s+/u)];
  return words.find((word, index) => word !== others[index]);
};

/** Marks a line may start with before its first word (indent, quote, list, heading). */
const LINE_MARKS = /^[ \t>*#+-]*$/u;

const startsLine = (text: string, offset: number): boolean => LINE_MARKS.test(text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset));
const ONE_WORD = /^\p{L}+$/u;

/**
 * Whether a one-word form stands where any word takes a capital, at the start of a sentence or of a line (a verse line),
 * the form is a dictionary word in small letters, and the tagger reads the usual form as an ordinary word too (Sprang beside
 * Spring): two words, not a name. A usual form the tagger reads as a name only (Friedman) keeps its slips (Freedman).
 */
const isCapitalisedByPlace = (
  found: Found,
  text: string,
  sentenceStarts: ReadonlySet<number>,
  speller: Speller | undefined,
  ordinary: ReadonlySet<string>,
): boolean =>
  speller !== undefined &&
  ONE_WORD.test(found.name) &&
  (sentenceStarts.has(found.offset) || startsLine(text, found.offset)) &&
  isKnownWord(found.name.toLowerCase(), speller) &&
  ordinary.has(found.usual.toLowerCase());

/** A word of three capitals or more: a title set in capitals as published (TRIDENT). */
const CAPITALS_WORD = /(?<!\p{L})\p{Lu}{3,}(?!\p{L})/u;
const QUOTES = /["“”]/gu;

/** Whether a case-only variant holding a word in capitals stands inside quotation marks on its line: a cited title as published. */
const isQuotedTitleCase = (found: Found, text: string): boolean => {
  if (found.name.toLowerCase() !== found.usual.toLowerCase() || !CAPITALS_WORD.test(found.name)) return false;
  const lineStart = text.lastIndexOf("\n", found.offset) + 1;
  const before = text.slice(lineStart, found.offset);
  const lineEnd = text.indexOf("\n", found.offset);
  const after = text.slice(found.offset + found.name.length, lineEnd < 0 ? text.length : lineEnd);
  return (before.match(QUOTES)?.length ?? 0) % 2 === 1 && (after.match(QUOTES)?.length ?? 0) > 0;
};

/** Whether a Japanese name is followed at once by an auxiliary that does not follow names (咲けり の けり): a verb stem, not a name. */
const isVerbStem = (found: Found, tokenAt: ReadonlyMap<number, Token>, copulas: ReadonlySet<string>): boolean => {
  const next = tokenAt.get(found.offset + found.name.length);
  return copulas.size > 0 && next?.pos === "AUX" && !copulas.has(next.surface);
};

/** What the checks read from the document, built once. */
type Reading = {
  readonly text: string;
  readonly sentences: readonly Span[];
  readonly sentenceStarts: ReadonlySet<number>;
  readonly endings: readonly WordEnding[];
  readonly directions: readonly string[];
  readonly copulas: ReadonlySet<string>;
  readonly tokenAt: ReadonlyMap<number, Token>;
  readonly speller: Speller | undefined;
  readonly ordinary: ReadonlySet<string>;
};

const inOneSentence = (sentences: readonly Span[], offset: number, other: number): boolean =>
  sentences.some((span) => span.start <= offset && offset < span.end && span.start <= other && other < span.end);

/**
 * A one-letter variant (near) that is two names: another form of the word (Texan), the usual form in the same sentence
 * (Constantinus and Constantius, two sons), the differing word written twice or more (Bandle, of Richard Bandle and
 * Mrs. Bandle), or a word capitalised by its place (Sprang).
 */
const isNearPair = (reading: Reading, found: Found): boolean => {
  const word = differingWord(found.name, found.usual);
  return (
    isOtherEnding(found.name, found.usual, reading.endings) ||
    offsetsOf(reading.text, found.usual).some((offset) => inOneSentence(reading.sentences, found.offset, offset)) ||
    (word !== undefined && offsetsOf(reading.text, word).length >= 2) ||
    isCapitalisedByPlace(found, reading.text, reading.sentenceStarts, reading.speller, reading.ordinary)
  );
};

/**
 * The finding is not two forms of one name: a one-letter variant that is two names (isNearPair), ・ listing two words, a
 * direction and its inverse, a title quoted in capitals, a verb stem. ordinary holds the words read as names that are
 * ordinary words in small letters (name-ordinary-word.ts).
 */
export const twoThingsIn = (
  doc: ProseDocument,
  tokens: readonly Token[],
  speller: Speller | undefined,
  ordinary: ReadonlySet<string>,
): ((found: Found) => boolean) => {
  const reading: Reading = {
    text: doc.prose ?? doc.source,
    sentences: doc.sentences.map((sentence) => sentence.span),
    sentenceStarts: new Set(doc.sentences.flatMap((sentence) => sentence.tokens?.[0]?.span.start ?? [])),
    endings: wordEndingsOf(doc),
    directions: patternsOf(doc, "name-direction-word"),
    copulas: new Set(patternsOf(doc, "name-copula")),
    tokenAt: new Map(tokens.map((token) => [token.span.start, token])),
    speller,
    ordinary,
  };
  return (found) =>
    (found.kind === "near" && isNearPair(reading, found)) ||
    isListedPair(found.name, found.usual) ||
    (found.kind === "order" && isInverseOrder(found.name, found.usual, reading.directions)) ||
    isQuotedTitleCase(found, reading.text) ||
    (found.kind === "reading" && isVerbStem(found, reading.tokenAt, reading.copulas));
};

/** A title written once with one word a letter away from a title written twice or more (name-title-slip.ts). heads ends a title. */
export const titleFindingsOf = (text: string, heads: readonly string[]): Found[] =>
  titleSlipsIn(text, heads).map(({ offset, surface, usual }) => ({ offset, name: surface, usual, kind: "title" }));
