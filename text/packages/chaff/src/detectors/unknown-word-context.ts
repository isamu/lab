// Where a word stands, for unknown-word: places in a document where a word not in the dictionary is a name or a term the
// writer means as written, not a slip. Pure functions over the Markdown source and an offset into it.
import { isAddress, isKnownWord, stemsOf, type CheckedWord, type Speller } from "../spelling.ts";

/** Each half of a closed compound keeps this many letters: a shorter half (open + end, pip + line) is more often a slip at the joint. */
const MIN_COMPOUND_PART = 4;

/**
 * Two dictionary words of four letters or more written as one (crowdwork, crowdworkers): a closed compound, not a slip. The
 * head is a word as listed and the tail takes only an inflection: a prefix or a derived ending on a half (misre + presenation)
 * reads too many slips as words.
 */
export const isClosedCompound = (word: string, speller: Speller): boolean => {
  const listed: Speller = { ...speller, suffixes: [], prefixes: [] };
  const inflected: Speller = { ...listed, suffixes: speller.suffixes.filter(({ inflection }) => inflection === true) };
  return [...Array(Math.max(0, word.length - 2 * MIN_COMPOUND_PART + 1)).keys()]
    .map((index) => index + MIN_COMPOUND_PART)
    .some((split) => isKnownWord(word.slice(0, split), listed) && isKnownWord(word.slice(split), inflected));
};

/** Letters a name keeps before its drug stem: fewer, and the word is too short to be read as a drug by its ending alone. */
const MIN_DRUG_HEAD = 3;

/** A drug's international name, read by its stem (paroxetine by -oxetine, as fluoxetine): stems from the drug-stem lexicon. */
export const hasDrugStem = (word: string, stems: readonly string[]): boolean =>
  stems.some((stem) => word.endsWith(stem) && word.length >= stem.length + MIN_DRUG_HEAD);

/** How far back or ahead to look for a neighbouring word or a search stem. */
const NEIGHBOUR_REACH = 40;

const CLOSER: Readonly<Record<string, string>> = { '"': '"', "“": "”", "(": ")" };

/** The word alone between quotes or brackets ("mailto", (jchaplin)): a word the writer names as such, or an account handle. */
export const isMention = (source: string, offset: number, word: string): boolean => {
  const closer = CLOSER[source.charAt(offset - 1)];
  return closer !== undefined && source.charAt(offset + word.length) === closer;
};

/**
 * A search stem with a wildcard in a list of terms (ukrain*, vaccin*): the word ends in a * that closes no emphasis
 * (nothing opens one before the word), and a separator or the line's end follows it, not a word as after a footnote's *.
 */
export const isSearchStem = (source: string, offset: number, word: string): boolean => {
  const end = offset + word.length;
  return source[end] === "*" && source[offset - 1] !== "*" && /^[ \t]*(?:[,;|)\]]|\r?\n|$)/u.test(source.slice(end + 1));
};

const LETTER = /\p{L}/u;

/** The stem a * at index of source closes: the letters right before it, or "" when none come before. */
const stemBefore = (source: string, index: number): string => {
  const head = Array.from(source.slice(Math.max(0, index - NEIGHBOUR_REACH), index));
  return head.slice(head.findLastIndex((character) => !LETTER.test(character)) + 1).join("");
};

/** The word stands in a line with a search stem (president, maga, biden, democrat*): every item of that list is a term. */
export const inSearchTermList = (source: string, offset: number): boolean => {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const end = source.indexOf("\n", offset);
  const line = source.slice(start, end === -1 ? source.length : end);
  return [...line.matchAll(/\*/gu)].some((star) => {
    const stem = stemBefore(source, start + star.index);
    return stem !== "" && isSearchStem(source, start + star.index - stem.length, stem);
  });
};

/** A Latin letter outside English's a–z (ê, é, ñ, ß): a word of another language. */
const isForeignWord = (token: string): boolean => [...token].some((letter) => letter > "\u007f" && /\p{Script=Latin}/u.test(letter));

const SPACE = /\s/u;

/** The last space-separated token of text when a space ends it ("old bête " gives "bête"), or "". */
const lastToken = (text: string): string => (SPACE.test(text.at(-1) ?? "") ? (text.trimEnd().split(SPACE).at(-1) ?? "") : "");

/** The first space-separated token of text when a space starts it (" noire for" gives "noire"), or "". */
const firstToken = (text: string): string => (SPACE.test(text.charAt(0)) ? (text.trimStart().split(SPACE)[0] ?? "") : "");

/** The word stands beside a word of another language written in Latin letters (bête noire): it belongs to that phrase. */
export const besideForeignWord = (source: string, offset: number, word: string): boolean => {
  const end = offset + word.length;
  return (
    isForeignWord(lastToken(source.slice(Math.max(0, offset - NEIGHBOUR_REACH), offset))) || isForeignWord(firstToken(source.slice(end, end + NEIGHBOUR_REACH)))
  );
};

/** The letters of every URL and email address in the source, lower-cased: a word also in an address names what it points at. */
export const addressWordsOf = (source: string): Set<string> =>
  new Set((source.match(/\S+/gu) ?? []).filter(isAddress).flatMap((chunk) => chunk.toLowerCase().match(/\p{L}+/gu) ?? []));

const countsOf = (keys: readonly string[]): Map<string, number> => {
  const counts = new Map<string, number>();
  keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
  return counts;
};

/**
 * The word and its stems, the forms another word of its family shares (rightsized and rightsizing share rightsize), for a
 * word the dictionary does not know. A known word is in no such family: "refactored" does not make "refactore" a form of
 * it, nor "tools" "toolss".
 */
const familyOf = (word: string, speller: Speller): string[] => (isKnownWord(word, speller) ? [] : [...new Set([word, ...stemsOf(word, speller)])]);

/**
 * Words the document uses once, counting a word's other forms as uses (rightsize, rightsized, rightsizing): a word used
 * twice or more, in any form, is more often the document's own term than a slip.
 */
export const usedOnce = (words: readonly CheckedWord[], speller: Speller): CheckedWord[] => {
  const uses = countsOf(words.map(({ word }) => word));
  const families = new Map([...uses.keys()].map((word) => [word, familyOf(word, speller)]));
  const shared = countsOf([...families.values()].flat());
  return words.filter(({ word }) => uses.get(word) === 1 && (families.get(word) ?? []).every((key) => shared.get(key) === 1));
};
