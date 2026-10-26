// Words that start with two capitals or more and go on in small letters, where the capitals are not a spelling of the
// plain word: a name in capitals with an English ending (SENDs, OPENed), or the letters of an acronym picked out in its
// expansion (CLImatology and PERsistence for CLIPER: part of a longer acronym). A name written that way (HBase, RSpec,
// SCIMple beside SCIM) is a spelling, and stays one.

const CAPITALS_THEN_SMALL = /^(\p{Lu}{2,})\p{Ll}+$/u;
const CAPITALS_WITH_ENDING = /^\p{Lu}{2,}(?:s|es|d|ed|ing)$/u;
const CAPITALS_ONLY = /^\p{Lu}[\p{Lu}\d]+$/u;
const LATIN_RUN = /[\p{L}\d]+/gu;

/** The words of a stretch of text written in capitals only (CLIPER, CAMEX), which a picked-out expansion spells. */
export const acronymsIn = (text: string): string[] => [...text.matchAll(LATIN_RUN)].map((match) => match[0]).filter((word) => CAPITALS_ONLY.test(word));

const isPickedOut = (word: string, acronyms: readonly string[]): boolean => {
  const capitals = CAPITALS_THEN_SMALL.exec(word)?.[1];
  return capitals !== undefined && acronyms.some((acronym) => acronym.length > capitals.length && acronym.includes(capitals));
};

/**
 * Whether a word is capitals with an ending, or the letters of an acronym among acronyms. A hyphenated word is compared
 * as written: leaving it out for one part would hide a variant in another (GitHub-SENDs, Github-SENDs).
 */
export const isCapitalsNotSpelling = (word: string, acronyms: readonly string[]): boolean => CAPITALS_WITH_ENDING.test(word) || isPickedOut(word, acronyms);

/** A surname in capitals after its prefix in small letters (McCAUL, DesJARLAIS, MacARTHUR): one capital, a short prefix, capitals. */
const CAPITALS_AFTER_PREFIX = /^\p{Lu}\p{Ll}{1,3}\p{Lu}{2,}$/u;
const NAME_PART = /\p{L}+\.?/gu;
const INITIAL = /^\p{Lu}\.$/u;
const CAPITALS_WORD = /^\p{Lu}{2,}$/u;

/**
 * Whether a word at `start` in text is a surname set in capitals after a given name in capitals (MICHAEL T. McCAUL, SCOTT
 * DesJARLAIS): a roster's capitals, not another spelling of McCaul. An initial between the two (T.) is passed over.
 */
export const isNameInCapitals = (text: string, start: number, word: string): boolean => {
  if (!CAPITALS_AFTER_PREFIX.test(word)) return false;
  const before = [...text.slice(0, start).matchAll(NAME_PART)].map((match) => match[0]).filter((part) => !INITIAL.test(part));
  return CAPITALS_WORD.test(before.at(-1) ?? "");
};
