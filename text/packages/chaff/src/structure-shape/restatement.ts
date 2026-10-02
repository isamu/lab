import type { LengthUnit } from "../plugin.ts";

/** Japanese is compared in runs of this many characters; four is past most particle-and-ending runs (ことが, します). */
const CHAR_GRAM = 4;

/** Punctuation, symbols and spaces end a run: a gram across them is shape, not content. */
const BREAK = /[\s\p{P}\p{S}]/u;

const WORD = /[\p{L}\p{N}]+/gu;

/** Runs of code points, so a character outside the Basic Multilingual Plane counts as one. */
const charGrams = (text: string): string[] =>
  text.split(BREAK).flatMap((run) => {
    const characters = [...run];
    return Array.from({ length: Math.max(0, characters.length - CHAR_GRAM + 1) }, (_, start) => characters.slice(start, start + CHAR_GRAM).join(""));
  });

const wordGrams = (text: string): string[] => {
  const words = (text.toLowerCase().match(WORD) ?? []).filter((word) => word.length > 0);
  return words.slice(1).map((word, index) => `${words[index] ?? ""} ${word}`);
};

/** The distinct grams of a text: four-character runs for a document measured in characters, word pairs otherwise. */
export const gramsOf = (text: string, unit: LengthUnit): ReadonlySet<string> => new Set(unit === "char" ? charGrams(text) : wordGrams(text));

/** Fewer grams than this in the closing section and the share says more about its length than about what it says. */
export const MIN_CLOSING_GRAMS = 10;

const PERCENT = 100;

/**
 * The share of the closing section's grams already written in the body, as a rounded percentage: a まとめ that only
 * restates scores high. Undefined when the closing is too short to measure.
 */
export const restatementPercent = (closing: string, body: string, unit: LengthUnit): number | undefined => {
  const closingGrams = gramsOf(closing, unit);
  if (closingGrams.size < MIN_CLOSING_GRAMS) return undefined;
  const bodyGrams = gramsOf(body, unit);
  const repeated = [...closingGrams].filter((gram) => bodyGrams.has(gram)).length;
  return Math.round((repeated / closingGrams.size) * PERCENT);
};
