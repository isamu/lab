import type { Span } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

// A count written as a word before its unit ("twelve years", "Ten years"), which the tree does not read as a quantity.
// Pure: the number words come in order from one (the lexicon count-number, the position is the number).

export type WordCount = Span & { readonly amount: number };

const alternation = (words: readonly string[]): string =>
  words
    .filter((word) => word !== "")
    .map(escapeRegExp)
    .join("|");

/**
 * Each number word standing as a word of its own, followed by one of the units after a space. A word joined to letters,
 * digits or a dash on either side is the tail of a larger number (二十年's 十, "twenty-one years", "fortyten").
 */
export const numberWordCounts = (source: string, numberWords: readonly string[], units: readonly string[]): WordCount[] => {
  const [words, unitWords] = [alternation(numberWords), alternation(units)];
  if (words === "" || unitWords === "") return [];
  const pattern = new RegExp(`(?<![\\p{L}\\p{N}\\p{Pd}])(${words})\\s+(?:${unitWords})(?![\\p{L}\\p{N}])`, "giu");
  const lowered = numberWords.map((word) => word.toLowerCase());
  return [...source.matchAll(pattern)].flatMap((match) => {
    const position = lowered.indexOf((match[1] ?? "").toLowerCase());
    return position < 0 ? [] : [{ start: match.index, end: match.index + match[0].length, amount: position + 1 }];
  });
};
