// name-variant points at a name one letter away from a more frequent one. Two one-word names that are forms of one
// dictionary word are two words, not one name written two ways: a people and its country (Germans, Germany), a singular
// and its plural (Englishman, Englishmen), the people and the act (Crusaders, Crusades). Pure.
import { isKnownWord, type Speller, type Suffix } from "./spelling.ts";
import { usualIsMisspelt, type IsKnown } from "./name-misspelt-usual.ts";

/** A stem shorter than this is too short to say two words share it (bed, beds). */
const MIN_STEM = 3;
const ONE_WORD = /^\p{L}+$/u;

/** The word with one ending taken off (germans → german, englishmen → englishman), at least MIN_STEM letters long. */
const stemsOf = (word: string, suffixes: readonly Suffix[]): string[] =>
  suffixes.flatMap(({ suffix, replacement }) =>
    word.endsWith(suffix) && word.length - suffix.length >= MIN_STEM ? [`${word.slice(0, word.length - suffix.length)}${replacement}`] : [],
  );

/** Letters the other word may add after the shared stem: Germany after german, crusades after crusade. Marker and Market (mark + et) share only a start. */
const MAX_ADDED = 1;

/** Whether word, with an ending taken off, is a dictionary word that other is, or is with one letter added. */
const isFormOf = (word: string, other: string, suffixes: readonly Suffix[], isKnown: IsKnown): boolean =>
  stemsOf(word, suffixes).some((stem) => stem !== word && isKnown(stem) && other.startsWith(stem) && other.length - stem.length <= MAX_ADDED);

/**
 * Whether two one-word names are forms of one dictionary word: both are dictionary words, and one of them, with its ending
 * taken off, is the other, or the other less its last letter. Two names that are both in the dictionary but share no stem (Anderson, Andersen)
 * are still a slip.
 */
export const areWordForms = (name: string, usual: string, suffixes: readonly Suffix[], isKnown: IsKnown): boolean => {
  const [left, right] = [name.toLowerCase(), usual.toLowerCase()];
  if (!ONE_WORD.test(left) || !ONE_WORD.test(right) || !isKnown(left) || !isKnown(right)) return false;
  return isFormOf(left, right, suffixes, isKnown) || isFormOf(right, left, suffixes, isKnown);
};

/**
 * Whether the dictionary says two forms are not one name written two ways: the usual form is a repeated slip of the
 * pointed form's dictionary word (name-misspelt-usual.ts), or the two are forms of one word.
 */
export const isDictionaryPair = (name: string, usual: string, speller: Speller): boolean => {
  const isKnown = (word: string): boolean => isKnownWord(word, speller);
  return usualIsMisspelt(name, usual, isKnown) || areWordForms(name, usual, speller.suffixes, isKnown);
};
