// name-variant points at the less frequent form and names the more frequent one as the usual. When the usual form holds a
// word the dictionary lacks, one letter from the dictionary word the pointed form has in its place ("Release Sechedule" ×3
// beside "Release Schedule"), the frequent form is a repeated typo, and the pointed form is the right spelling. Pure.
import { editsOf } from "./spelling.ts";

/** Whether a lower-case word is a dictionary word, with its endings (lords, schedules). */
export type IsKnown = (word: string) => boolean;

const LATIN_WORD = /\p{Script=Latin}+/gu;

const wordsOf = (name: string): string[] => (name.match(LATIN_WORD) ?? []).map((word) => word.toLowerCase());

/** The usual form's word is a one-letter slip of the pointed form's dictionary word in the same place. */
const isSlipOf = (usualWord: string, nameWord: string | undefined, isKnown: IsKnown): boolean =>
  nameWord !== undefined && isKnown(nameWord) && !isKnown(usualWord) && editsOf(usualWord).includes(nameWord);

/** Whether every word the usual form has in place of the pointed form's is a one-letter slip of a dictionary word. */
export const usualIsMisspelt = (name: string, usual: string, isKnown: IsKnown): boolean => {
  const nameWords = wordsOf(name);
  const usualWords = wordsOf(usual);
  const onlyInName = nameWords.filter((word) => !usualWords.includes(word));
  const onlyInUsual = usualWords.filter((word) => !nameWords.includes(word));
  return onlyInUsual.length > 0 && onlyInUsual.length === onlyInName.length && onlyInUsual.every((word, index) => isSlipOf(word, onlyInName[index], isKnown));
};
