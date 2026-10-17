// Acronyms a sentence about abbreviations spells out in words (the abbreviation DOB … spell out the field to date of birth),
// and the other capitalisations of an acronym that a text writes (TCoP beside TCOP). Pure; the mention words come from the
// abbreviation-mention lexicon.
import { escapeRegExp } from "../orthography.ts";

const ACRONYM = /(?<![\p{L}\p{N}])[A-Z][A-Z&-]*[A-Z](?![\p{L}\p{N}])/gu;
/** A word of two letters or more: the letters of a dotted form (B.B.C.) spell nothing out. */
const LATIN_WORD = /[A-Za-z]{2,}/gu;
const CAPITAL = /\p{Lu}/gu;
/** A capitalisation of an acronym keeps at least this many capitals (TCoP); fewer is a word (Tcop). */
const MIN_CAPITALS = 2;

const mentionsAbbreviation = (sentence: string, mentions: readonly string[]): boolean => {
  const lowered = sentence.toLowerCase();
  return mentions.some((mention) => lowered.includes(mention.toLowerCase()));
};

/** Whether some run of consecutive words, other than the acronym itself, has the acronym's letters as its initials. */
const spellsOutInWords = (sentence: string, acronym: string): boolean => {
  const letters = acronym.replaceAll(/[&-]/gu, "").toLowerCase();
  const words = (sentence.match(LATIN_WORD) ?? []).filter((word) => word !== acronym.replaceAll(/[&-]/gu, ""));
  return words.some(
    (_, start) =>
      words
        .slice(start, start + letters.length)
        .map((word) => word.charAt(0).toLowerCase())
        .join("") === letters,
  );
};

/** The acronyms that a sentence naming an abbreviation also writes out in full. */
export const spelledOutAcronyms = (sentences: readonly string[], mentions: readonly string[]): Set<string> =>
  new Set(
    sentences
      .filter((sentence) => mentionsAbbreviation(sentence, mentions))
      .flatMap((sentence) => (sentence.match(ACRONYM) ?? []).filter((acronym) => spellsOutInWords(sentence, acronym))),
  );

/** The other ways the text capitalises an acronym (TCoP for TCOP, TCOP for TCoP), each with two capitals or more. */
export const caseVariantsIn = (text: string, acronym: string): string[] => {
  const written = new RegExp(String.raw`(?<![\p{L}\p{N}])${escapeRegExp(acronym)}(?![\p{L}\p{N}])`, "giu");
  const variants = [...text.matchAll(written)].map((match) => match[0]);
  return [...new Set(variants)].filter((variant) => variant !== acronym && (variant.match(CAPITAL) ?? []).length >= MIN_CAPITALS);
};
