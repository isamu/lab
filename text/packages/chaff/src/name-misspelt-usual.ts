// name-variant points at the less frequent form and names the more frequent one as the usual. When the usual form holds a
// word the dictionary lacks, one letter from the dictionary word the pointed form has in its place ("Release Sechedule" ×3
// beside "Release Schedule"), the frequent form is a repeated typo, and the pointed form is the right spelling. Pure.
import { editsOf } from "./spelling.ts";

/** Whether a lower-case word is a dictionary word, with its endings (lords, schedules). */
export type IsKnown = (word: string) => boolean;

/** A word the edits are made on: ASCII letters only, as editsOf makes them. */
const PLAIN_WORD = /^[a-z]+$/u;

const wordsOf = (name: string): string[] => name.toLowerCase().trim().split(/\s+/u);

/** The usual form's word is a one-letter slip of the pointed form's dictionary word in the same place. */
const isSlipOf = (usualWord: string, nameWord: string, isKnown: IsKnown): boolean =>
  PLAIN_WORD.test(usualWord) && PLAIN_WORD.test(nameWord) && isKnown(nameWord) && !isKnown(usualWord) && editsOf(usualWord).includes(nameWord);

/** Whether the two forms have the same words in the same places but where the usual one has a one-letter slip of a dictionary word. */
export const usualIsMisspelt = (name: string, usual: string, isKnown: IsKnown): boolean => {
  const nameWords = wordsOf(name);
  const usualWords = wordsOf(usual);
  if (nameWords.length !== usualWords.length) return false;
  const differing = usualWords.flatMap((word, index) => (word === nameWords[index] ? [] : [index]));
  return differing.length > 0 && differing.every((index) => isSlipOf(usualWords[index] ?? "", nameWords[index] ?? "", isKnown));
};
