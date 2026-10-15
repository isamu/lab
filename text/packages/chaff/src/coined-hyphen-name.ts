// A name coined from pieces joined by hyphens (Medi-Cal, the name of a programme): the pieces after the first are capitalised
// and one of them is not a word. Closed up, its letters spell an ordinary word (medical), which is another word and not another
// spelling of the name.

const CAPITALISED = /^\p{Lu}\p{Ll}+$/u;

/** Whether a hyphenated word is a coined name. isWord says whether a lower-case word is in the language's dictionary. */
export const isCoinedName = (word: string, isWord: (word: string) => boolean): boolean => {
  const later = word.split("-").slice(1);
  return later.length > 0 && later.every((part) => CAPITALISED.test(part)) && later.some((part) => !isWord(part.toLowerCase()));
};

const UPPER = /\p{Lu}/u;

/**
 * The words without the coined names whose key the document otherwise writes only in small letters (Medi-Cal beside medical).
 * Beside a spelling with capitals of its own (Wi-Fi beside WiFi) the coined name is still a spelling of that name. spelling is the
 * word with the first letter of each part in small letters.
 */
export const withoutCoinedNames = <Word extends { readonly key: string; readonly spelling: string; readonly shown?: string }>(
  words: readonly Word[],
  isWord: (word: string) => boolean,
): Word[] => {
  const isCoined = (word: Word): boolean => isCoinedName(word.shown ?? word.spelling, isWord);
  const capitalKeys = new Set(words.filter((word) => !isCoined(word) && UPPER.test(word.spelling)).map((word) => word.key));
  return words.filter((word) => !isCoined(word) || capitalKeys.has(word.key));
};
