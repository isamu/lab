import type { LexiconEntry, Sentence, Token } from "../plugin.ts";

// Sentence shapes whose register is a deliberate voice, not a slip: counted, never pointed at. Pure.

/** Marks after a sentence's last word: its full stop, an exclamation, closing brackets and spaces. */
const TRAILING_MARKS: ReadonlySet<string> = new Set(["。", "．", ".", "！", "!", "」", "』", "）", ")", " ", "\t", "\n", "　"]);

const withoutTrailingMarks = (text: string): string => {
  const chars = [...text];
  return chars.slice(0, chars.findLastIndex((char) => !TRAILING_MARKS.has(char)) + 1).join("");
};

/** A polite sentence that ends in a greeting said only politely (農業まつり、お疲れ様でした。). Plain remarks greet people so too. */
export const endsInSetGreeting = (sentence: Sentence, phrases: readonly LexiconEntry[]): boolean => {
  const text = withoutTrailingMarks(sentence.text);
  return phrases.some((phrase) => text.endsWith(phrase.pattern));
};

const PAST = new Set(["た", "だ"]);

const hasParticle = (tokens: readonly Token[], particles: readonly LexiconEntry[]): boolean =>
  tokens.some((token) => token.pos === "ADP" && particles.some((particle) => particle.pattern === token.surface));

/**
 * A speaker's declaration (負担軽減を、目に見える形で実現する。二度と繰り返さない。): an object particle, no subject particle, and a
 * verb in the present at the end. particles is the declaration-particle word list already narrowed to the document's genre; without
 * an object particle for the genre the shape does not hold.
 */
export const isDeclaration = (sentence: Sentence, ending: readonly Token[], particles: readonly LexiconEntry[]): boolean => {
  const objects = particles.filter((particle) => particle.group === "object");
  const subjects = particles.filter((particle) => particle.group === "subject");
  const tokens = sentence.tokens ?? [];
  const last = ending.at(-1);
  if (objects.length === 0 || last === undefined || PAST.has(last.surface)) return false;
  return ending.some((token) => token.pos === "VERB") && hasParticle(tokens, objects) && !hasParticle(tokens, subjects);
};

/** The most tokens an opener in takeup-opener spans (これ/だけ). */
const OPENER_TOKENS_MAX = 3;

/** The words a sentence opens with, as whole tokens: そんな, then これ, これだけ, これだけで for これ/だけ/で. */
const openingWords = (tokens: readonly Token[]): Set<string> =>
  new Set(
    tokens.map((_, index) =>
      tokens
        .slice(0, index + 1)
        .map((token) => token.surface)
        .join(""),
    ),
  );

/** The next sentence of the same paragraph opens with words that take up the scene or act this one set (…送れない。そんなときの…, …と書いて送る。これだけで…). */
export const isTakenUp = (next: Sentence | undefined, between: string, openers: readonly LexiconEntry[]): boolean => {
  const tokens = next?.tokens ?? [];
  if (tokens.length === 0 || between.trim() !== "" || between.includes("\n")) return false;
  const opening = openingWords(tokens.slice(0, OPENER_TOKENS_MAX));
  return openers.some((opener) => opening.has(opener.pattern));
};

const EXCLAMATION = /[！!][\s」』）)]*$/u;

/** A sentence closed by an exclamation mark (わかるかっ！！！): a cry in the writer's voice, said plainly in either register. */
export const isExclamation = (sentence: Sentence): boolean => EXCLAMATION.test(sentence.text);
