import type { Token } from "./plugin.ts";

/** The words that decide which particle-looking tokens are not links in a chain of particles. */
export type UncountedWords = {
  /** The particles a chain is made of (の). */
  readonly particles: readonly string[];
  /** Words written as a number: every character one of these, or a decimal digit. */
  readonly numeralChars: ReadonlySet<string>;
  /** Words that number a provision and may be followed by a branch number (第70条の２: 条). */
  readonly counters: readonly string[];
  /** Nouns that make one compound particle with the particle on each side (のための: ため). */
  readonly compoundNouns: readonly string[];
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

/** 第70条の２, 70の２－８の２, 第２の２: the particle joins a branch number to the number before it, so it is part of the number. */
const isNumberingConnector = (tokens: readonly Token[], at: number, words: UncountedWords): boolean =>
  numeralAt(tokens, at + 1, words) && (numeralAt(tokens, at - 1, words) || numberedCounterAt(tokens, at - 1, words));

/** The second の of のための: the compound particle is one link, written with two of the particle. */
const isCompoundTail = (tokens: readonly Token[], at: number, words: UncountedWords): boolean => {
  const noun = tokens[at - 1];
  const head = tokens[at - 2];
  return noun !== undefined && head !== undefined && words.compoundNouns.includes(noun.surface) && head.surface === tokens[at]?.surface;
};

/** The particle tokens of a sentence that are not links of a chain: a numbering connector, the tail of a compound particle. */
export const uncountedParticles = (tokens: readonly Token[], words: UncountedWords): ReadonlySet<Token> =>
  new Set(
    tokens.filter((token, at) => words.particles.includes(token.surface) && (isNumberingConnector(tokens, at, words) || isCompoundTail(tokens, at, words))),
  );
