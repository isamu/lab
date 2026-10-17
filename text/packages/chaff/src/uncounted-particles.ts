import type { Token } from "./plugin.ts";

/** The words that decide which particle-looking tokens are not links in a chain of particles. */
export type UncountedWords = {
  /** The particles a chain is made of (の). */
  readonly particles: readonly string[];
  /** Words written as a number: every character one of these, or a decimal digit. */
  readonly numeralChars: ReadonlySet<string>;
  /** Words that number a provision and may be followed by a branch number (第70条の２: 条). */
  readonly counters: readonly string[];
};

const DECIMAL_DIGITS = /^\p{Nd}+$/u;

export const isNumeral = (surface: string, numeralChars: ReadonlySet<string>): boolean =>
  DECIMAL_DIGITS.test(surface) || (surface !== "" && [...surface].every((char) => numeralChars.has(char)));

const numeralAt = (tokens: readonly Token[], at: number, words: UncountedWords): boolean => {
  const token = tokens[at];
  return token !== undefined && isNumeral(token.surface, words.numeralChars);
};

/** 第70条, 第３項: a counter right after a number. */
const numberedCounterAt = (tokens: readonly Token[], at: number, words: UncountedWords): boolean => {
  const token = tokens[at];
  return token !== undefined && words.counters.includes(token.surface) && numeralAt(tokens, at - 1, words);
};

const NOMINAL = new Set(["NOUN", "PROPN"]);
const LETTER = /\p{L}/u;

/** Where the run of number tokens that starts at `at` ends (三十 may be two tokens). */
const numeralRunEnd = (tokens: readonly Token[], at: number, words: UncountedWords): number => {
  const end = tokens.findIndex((token, index) => index >= at && !isNumeral(token.surface, words.numeralChars));
  return end === -1 ? tokens.length : end;
};

/**
 * A word after the number makes it a quantity (資料２－１の４ページ: page 4 of it), not a branch number. A word that opens
 * the next number (第 of 第70条の２第１項) is not one.
 */
const isWordAt = (tokens: readonly Token[], at: number, words: UncountedWords): boolean => {
  const token = tokens[at];
  return token !== undefined && NOMINAL.has(token.pos) && LETTER.test(token.surface) && !numeralAt(tokens, at + 1, words);
};

/** 第70条の２, 70の２－８の２, 第２の２: the particle joins a branch number to the number before it, so it is part of the number. */
const isNumberingConnector = (tokens: readonly Token[], at: number, words: UncountedWords): boolean =>
  numeralAt(tokens, at + 1, words) &&
  !isWordAt(tokens, numeralRunEnd(tokens, at + 1, words), words) &&
  (numeralAt(tokens, at - 1, words) || numberedCounterAt(tokens, at - 1, words));

/** The particle tokens of a sentence that join the parts of a number (第70条の２) and are not links of a chain. */
export const uncountedParticles = (tokens: readonly Token[], words: UncountedWords): ReadonlySet<Token> =>
  new Set(tokens.filter((token, at) => words.particles.includes(token.surface) && isNumberingConnector(tokens, at, words)));
