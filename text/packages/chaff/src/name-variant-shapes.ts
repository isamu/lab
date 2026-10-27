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
