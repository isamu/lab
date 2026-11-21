// name-variant: pairs that look like one name written two ways but are two things — a list mark inside two ordinary words,
// one direction and its inverse, a word and its form with another ending, a word capitalised by its place. Pure.

import { escapeRegExp } from "./orthography.ts";

const LOWER = /\p{Ll}/u;
const UPPER = /\p{Lu}/u;
/** Capitals after a surname prefix: three or more, so a product name ending in an acronym (MacOS) stays a name. */
const CAPITALS_AFTER = /^\p{Lu}{3,}$/u;
const WORD_BREAK = /[\s&・-]+/u;

/** A word in capitals, or in capitals after a surname prefix from the lexicon name-capitals-prefix (McCAUL, DesJARLAIS). */
const isCapitalsWord = (word: string, prefixes: readonly string[]): boolean =>
  !LOWER.test(word) || prefixes.some((prefix) => word.startsWith(prefix) && CAPITALS_AFTER.test(word.slice(prefix.length)));

/** Whether a name is set in capitals, as a roster sets it (MICHAEL T. McCAUL, SCOTT DesJARLAIS). */
export const isSetInCapitals = (surface: string, prefixes: readonly string[]): boolean =>
  UPPER.test(surface) && surface.split(WORD_BREAK).every((word) => isCapitalsWord(word, prefixes));

const HAN = /\p{Script=Han}/u;
const LIST_MARK = "・";

/** Whether name differs from usual only by ・ placed between two kanji (動物園・水族館): the mark lists two things there. */
export const isListedPair = (name: string, usual: string): boolean => {
  const [marked, plain] = name.length > usual.length ? [name, usual] : [usual, name];
  const chars = [...marked];
  const between = chars.some((char, index) => char === LIST_MARK && HAN.test(chars[index - 1] ?? "") && HAN.test(chars[index + 1] ?? ""));
  return between && marked.replaceAll(LIST_MARK, "") === plain;
};

const LETTERS = /^\p{Script=Latin}+$/u;

/** The two sides of a direction word. A word in Latin letters stands between spaces (to, not the "to" in Toronto). */
const sidesOf = (name: string, direction: string): readonly string[] => {
  const word = escapeRegExp(direction);
  const separator = LETTERS.test(direction) ? new RegExp(`\\s+${word}\\s+`, "u") : new RegExp(word, "u");
  return name.split(separator).map((side) => side.trim());
};

/** Whether name and usual are one pair of words in the two orders around a word of direction (ASCII to binary, binary to ASCII). */
export const isInverseOrder = (name: string, usual: string, directions: readonly string[]): boolean =>
  directions.some((direction) => {
    const [from, to, ...rest] = sidesOf(name, direction);
    const [usualFrom, usualTo, ...usualRest] = sidesOf(usual, direction);
    return rest.length === 0 && usualRest.length === 0 && from !== "" && to !== "" && from === usualTo && to === usualFrom;
  });

/** An ending a word may take instead of another (Texas, Texan; Romans, Romano): from the lexicon name-word-ending. */
export type WordEnding = { readonly ending: string; readonly insteadOf: string };

const ONE_WORD = /^\p{L}+$/u;

/** Whether two one-word names differ only in a last letter that the lexicon calls another form of the word (Texan for Texas). */
export const isOtherEnding = (name: string, usual: string, endings: readonly WordEnding[]): boolean => {
  if (!ONE_WORD.test(name) || !ONE_WORD.test(usual) || name.length !== usual.length || name.slice(0, -1) !== usual.slice(0, -1)) return false;
  const [nameEnd, usualEnd] = [name.slice(-1).toLowerCase(), usual.slice(-1).toLowerCase()];
  return endings.some(({ ending, insteadOf }) => (ending === nameEnd && insteadOf === usualEnd) || (ending === usualEnd && insteadOf === nameEnd));
};

/** Whether the document writes word in small letters somewhere (stain beside Stain, vigil beside Vigil): an ordinary word there. */
export const isWrittenSmall = (text: string, word: string): boolean => {
  const small = word.toLowerCase();
  return ONE_WORD.test(word) && small !== word && new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(small)}(?![\\p{L}\\p{N}])`, "u").test(text);
};

/**
 * Whether a pair of one-word forms holds a word the document writes in small letters: the pointed form (Stain beside stain
 * and Spain), or the usual form when the pointed one is a dictionary word too (Virgil beside Vigil and vigil). A name beside
 * an ordinary word, or two ordinary words, not one name written two ways. A pointed form no dictionary knows beside a word
 * written in small letters (Affliates beside affiliates) is still a slip.
 */
export const isNameAndWord = (name: string, usual: string, text: string, isKnown: (word: string) => boolean): boolean =>
  isWrittenSmall(text, name) || (isWrittenSmall(text, usual) && isKnown(name.toLowerCase()));

const APOSTROPHES = /['’]/gu;
const APOSTROPHE_WORD = /^\p{L}+(?:['’]\p{L}+)+$/u;
/** A stem shorter than this (the O of O'Brien) is a name's prefix, not a word. */
const MIN_CONTRACTED_STEM = 2;

/**
 * Whether two one-word forms differ only by an apostrophe and the part before it is a word the document writes in small
 * letters (Look’ee and Lookee, Thank’ee and Thankee): a contraction of an ordinary word printed both ways, not a name.
 */
export const isContractionPair = (name: string, usual: string, text: string): boolean => {
  const [marked, plain] = APOSTROPHE_WORD.test(name) ? [name, usual] : [usual, name];
  const stem = marked.split(APOSTROPHES)[0] ?? "";
  return (
    APOSTROPHE_WORD.test(marked) &&
    ONE_WORD.test(plain) &&
    marked.replaceAll(APOSTROPHES, "") === plain &&
    stem.length >= MIN_CONTRACTED_STEM &&
    isWrittenSmall(text, stem)
  );
};

/** An acronym in capitals with a plural s (SBLCs). Names in capitals alone are not compared at all. */
const ACRONYM_PLURAL = /^\p{Lu}{2,}s$/u;

/** Whether two forms are acronyms with a plural s (SBLCs and SBDCs): one letter tells two programmes apart. */
export const isAcronymPair = (name: string, usual: string): boolean => ACRONYM_PLURAL.test(name) && ACRONYM_PLURAL.test(usual);

const SPACE = /\s/u;
/** Marks a file name or a URL may end with in running text (Prosperity.pdf. or 2015.pdf;). */
const TRAILING_MARKS = ".,;:!?)]";
/** A file name's extension in small letters after a letter or digit (.pdf, .html), or a URL's scheme. */
const FILE_OR_URL = /[\p{L}\p{N}]\.\p{Ll}{2,4}$|:\/\//u;
const EXTENSION = /\.\p{Ll}{2,4}$/u;

const runStart = (text: string, offset: number): number => {
  let start = offset;
  while (start > 0 && !SPACE.test(text.charAt(start - 1))) start -= 1;
  return start;
};

const withoutTrailingMarks = (run: string): string => {
  let end = run.length;
  while (end > 0 && TRAILING_MARKS.includes(run.charAt(end - 1))) end -= 1;
  return run.slice(0, end);
};

/**
 * Whether the form at offset is part of a file name or a URL: the text without spaces around it holds more than the form
 * and its extension, and ends with an extension or holds a scheme (Low-Tax-Rates-to-Create-American-Economic-Prosperity.pdf).
 * A name with only a domain after it (Borrowmoney.com) is still the name.
 */
export const isInFileName = (text: string, offset: number, length: number): boolean => {
  const start = runStart(text, offset);
  const rest = text.slice(offset + length);
  const after = rest.search(SPACE);
  const run = withoutTrailingMarks(text.slice(start, offset + length + (after < 0 ? rest.length : after)));
  return run.replace(EXTENSION, "").length > length && FILE_OR_URL.test(run);
};

/** What may stand between a wrong mark and the form it marks: spaces, a colon. */
const MARK_GAP = /[\s:：]*$/u;

/**
 * Whether the form at offset follows a wrong mark from the lexicon name-wrong-mark on its own line (× Rspec beside ○ RSpec):
 * a list showing a wrong spelling on purpose, not a use of the name.
 */
export const isMarkedWrong = (text: string, offset: number, marks: readonly string[]): boolean => {
  const before = text.slice(text.lastIndexOf("\n", offset - 1) + 1, offset).replace(MARK_GAP, "");
  return marks.some((mark) => before.endsWith(mark));
};
