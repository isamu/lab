// name-variant: a slip in one word of a title the document repeats ("National Industrial Recover Act" once beside
// "National Industrial Recovery Act"). A title of a law or a body ends in a head word (Act, Commission) and is made of
// ordinary words, which the tagger may read as a verb (Recover), so it is read from the capitals, not from the tagger. Pure.
import { isEndLetterApart } from "./name-end-letter.ts";
import { isNearWord } from "./name-variants.ts";
import { escapeRegExp } from "./orthography.ts";

export type TitleSlip = { readonly offset: number; readonly surface: string; readonly usual: string };

/** A title has two words or more before its head: two-word titles (Trade Act, Power Act) are often two laws. */
const MIN_TITLE_WORDS = 3;
const WORD = "\\p{Lu}[\\p{L}'’]*";

type Title = { readonly offset: number; readonly words: readonly string[] };

/** Runs of capitalised words ending in a head word, and each tail of them of MIN_TITLE_WORDS words or more. */
const titlesIn = (text: string, heads: readonly string[]): Title[] => {
  if (heads.length === 0) return [];
  const head = heads.map(escapeRegExp).join("|");
  const pattern = new RegExp(`(?<![\\p{L}'’-])(?:${WORD}[ \\t]+){${String(MIN_TITLE_WORDS - 1)},}(?:${head})(?![\\p{L}'’-])`, "gu");
  return [...text.matchAll(pattern)].flatMap((found) => {
    const placed = [...found[0].matchAll(/\S+/gu)].map((word) => ({ word: word[0], offset: (found.index ?? 0) + (word.index ?? 0) }));
    const words = placed.map(({ word }) => word);
    return placed.slice(0, words.length - MIN_TITLE_WORDS + 1).map(({ offset }, index) => ({ offset, words: words.slice(index) }));
  });
};

/** One word, lower-cased, one letter apart: replaced, swapped or dropped inside, or its last letter dropped or added (not s). */
const isWordSlip = (word: string, usual: string): boolean => {
  const [left, right] = [word.toLowerCase(), usual.toLowerCase()];
  return isNearWord(left, right) || isEndLetterApart(left, right);
};

/** Whether words is usual with one word other than the head slipped. */
const isSlipOf = (words: readonly string[], usual: readonly string[]): boolean => {
  if (words.length !== usual.length || words.at(-1) !== usual.at(-1)) return false;
  const differing = words.flatMap((word, index) => (word === usual[index] ? [] : [index]));
  const [at] = differing;
  return differing.length === 1 && at !== undefined && isWordSlip(words[at] ?? "", usual[at] ?? "");
};

/**
 * Titles written once that are a repeated title (two times or more) with one word slipped. A title is read at its longest
 * tail that matches: "the National Industrial Recover Act" is compared as "National Industrial Recover Act".
 */
export const titleSlipsIn = (text: string, heads: readonly string[]): TitleSlip[] => {
  const titles = titlesIn(text, heads);
  const counts = new Map<string, number>();
  titles.forEach((title) => counts.set(title.words.join(" "), (counts.get(title.words.join(" ")) ?? 0) + 1));
  const repeated = [...counts].flatMap(([surface, count]) => (count >= 2 ? [surface.split(" ")] : []));
  const slips = titles.flatMap((title): TitleSlip[] => {
    const surface = title.words.join(" ");
    const usual = counts.get(surface) === 1 ? repeated.find((words) => isSlipOf(title.words, words)) : undefined;
    return usual === undefined ? [] : [{ offset: title.offset, surface, usual: usual.join(" ") }];
  });
  return slips.filter(
    (slip) => !slips.some((other) => other.offset < slip.offset && other.offset + other.surface.length === slip.offset + slip.surface.length),
  );
};
