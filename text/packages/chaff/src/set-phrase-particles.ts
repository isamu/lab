import type { Token } from "./plugin.ts";

// A particle inside a set phrase (絶滅のおそれのある種: おそれのある, "at risk of"): the phrase is read as one word, so its particle
// is not a link of a nesting chain. Pure.

const touches = (left: Token | undefined, right: Token | undefined): boolean => left !== undefined && right !== undefined && left.span.end === right.span.start;

/** How many words before a particle are read for a phrase's head: the tokenizer may cut it (おそれ as お and それ). */
const MAX_HEAD_WORDS = 3;

/** The words written straight before tokens[at], joined (おそれ from お and それ). */
const headBefore = (tokens: readonly Token[], at: number): string => {
  const window = tokens.slice(Math.max(0, at - MAX_HEAD_WORDS), at + 1);
  const gap = window.findLastIndex((token, index) => index < window.length - 1 && !touches(token, window[index + 1]));
  return window
    .slice(gap + 1, -1)
    .map((token) => token.surface)
    .join("");
};

/** Whether the particle at `at`, the words before it and the dictionary form of the word after it spell one of phrases (おそれのある). */
const isInPhrase = (tokens: readonly Token[], at: number, phrases: readonly string[]): boolean => {
  const [particle, after] = [tokens[at], tokens[at + 1]];
  if (particle === undefined || after === undefined || !touches(particle, after)) return false;
  const tail = `${particle.surface}${after.lemma ?? after.surface}`;
  const head = headBefore(tokens, at);
  return phrases.some((phrase) => phrase.endsWith(tail) && phrase.length > tail.length && head.endsWith(phrase.slice(0, -tail.length)));
};

/** The counted particles (particles) of a sentence that stand inside one of phrases, each written whole (おそれのある). */
export const setPhraseParticles = (tokens: readonly Token[], particles: readonly string[], phrases: readonly string[]): ReadonlySet<Token> =>
  new Set(tokens.filter((token, at) => particles.includes(token.surface) && isInPhrase(tokens, at, phrases)));
