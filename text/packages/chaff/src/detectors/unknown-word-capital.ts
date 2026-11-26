import type { Speller } from "../spelling.ts";

/** A word capitalised on its first letter only (Schedule, Sechedule), not inside another word, a path or an address. */
const CAPITALISED = /(?<![\p{L}\p{N}_./@#&'’\\-])\p{Lu}\p{Ll}+(?![\p{L}\p{N}_/@'’=-]|\.[\p{L}\p{N}])/gu;

const LETTERS = /\p{L}+/gu;

/** A capitalised word, and the word right before it on its line, lower-cased ("" at the line's start). */
export type CapitalisedWord = { readonly offset: number; readonly word: string; readonly before: string };

/** The last word before a place on its line (release in Kubernetes Release Schedule). */
const wordBefore = (text: string, offset: number): string =>
  (
    text
      .slice(text.lastIndexOf("\n", offset - 1) + 1, offset)
      .match(LETTERS)
      ?.at(-1) ?? ""
  ).toLowerCase();

export const capitalisedWordsOf = (text: string, minLength: number, maxLength: number): CapitalisedWord[] =>
  [...text.matchAll(CAPITALISED)]
    .filter((match) => match[0].length >= minLength && match[0].length <= maxLength)
    .map((match) => ({ offset: match.index, word: match[0], before: wordBefore(text, match.index) }));

/** Each capitalised word of a document, with the words it follows. */
export const followedWordsOf = (words: readonly CapitalisedWord[]): Map<string, Set<string>> => {
  const followed = new Map<string, Set<string>>();
  words.forEach(({ word, before }) => followed.set(word, (followed.get(word) ?? new Set<string>()).add(before)));
  return followed;
};

const capitalise = (word: string): string => `${word.charAt(0).toUpperCase()}${word.slice(1)}`;

/**
 * The word with one inner letter left out, or two neighbouring letters swapped: slips of the hand. Not a changed letter (Kustomize),
 * nor a first or last letter left out, which is how one name is made from another (Davide from David, Grande from grand).
 */
const slipsOf = (word: string): string[] => {
  const at = [...Array(word.length).keys()];
  const dropped = at.slice(1, -1).map((index) => `${word.slice(0, index)}${word.slice(index + 1)}`);
  const swapped = at.slice(0, -1).map((index) => `${word.slice(0, index)}${word.charAt(index + 1)}${word.charAt(index)}${word.slice(index + 2)}`);
  return [...new Set([...dropped, ...swapped])].filter((slip) => slip !== word);
};

/** The words a document writes: capitalised (Schedule, with the words before it) and in lower case (schedule). */
export type WrittenWords = { readonly capitalised: ReadonlyMap<string, ReadonlySet<string>>; readonly lowerCase: ReadonlySet<string> };

/**
 * The dictionary word, capitalised, that a capitalised unknown word (Sechedule) slips from, when the document itself writes it
 * capitalised the same way after the same word (Release Schedule beside Release Sechedule): a caption typed twice, once wrong.
 * The document must also write it in lower case, as a common word: a twin only ever capitalised is a name (Paris beside Parisa).
 * A name beside other words (Greta 1978 beside the Great Lakes) has no such twin.
 */
export const capitalisedTwin = (found: CapitalisedWord, written: WrittenWords, speller: Speller, minLength: number): string | undefined =>
  found.before === ""
    ? undefined
    : slipsOf(found.word.toLowerCase())
        .filter((slip) => slip.length >= minLength && written.lowerCase.has(slip) && speller.words.some((list) => list.has(slip)))
        .map(capitalise)
        .find((twin) => written.capitalised.get(twin)?.has(found.before) === true);
