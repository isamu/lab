// A spaced hyphen that joins one capitalised word onto a name ("the Islamic State of Iraq and Syria - Khorasan, as …"): the
// hyphen is part of the name, not a dash in the sentence. Pure.

/** A capitalised word: the one ending right before the hyphen's space. */
const CAPITALISED_WORD = /^\p{Lu}[\p{L}'’]*$/u;
const NOT_WORD = /[^\p{L}'’]/u;
/** Longer than any word, to look back over. */
const WORD_REACH = 40;

/**
 * The hyphen, then one word in title case that ends the phrase: a comma, a stop, a bracket or the end of the line follows.
 * A word all in capitals after it (I - JURISDICTION) is a heading's title set off by a dash.
 */
const SUFFIX_AFTER = /^ -{1,2} \p{Lu}\p{Ll}[\p{L}'’]*(?=[,.;:)\]]|$)/u;

const lineEnd = (text: string, offset: number): number => {
  const end = text.indexOf("\n", offset);
  return end === -1 ? text.length : end;
};

/** `offset` is where the hit starts in `text`: the space before the hyphen. */
export const joinsNameSuffix = (text: string, offset: number): boolean =>
  offset > 0 &&
  CAPITALISED_WORD.test(
    text
      .slice(Math.max(0, offset - WORD_REACH), offset)
      .split(NOT_WORD)
      .at(-1) ?? "",
  ) &&
  SUFFIX_AFTER.test(text.slice(offset, lineEnd(text, offset)));
