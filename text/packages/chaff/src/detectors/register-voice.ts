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

/** The next sentence of the same paragraph opens with a word that takes up the scene this one set (…送れない。そんなときの…). */
export const isTakenUp = (next: Sentence | undefined, between: string, openers: readonly LexiconEntry[]): boolean => {
  const first = next?.tokens?.[0]?.surface;
  return first !== undefined && between.trim() === "" && !between.includes("\n") && openers.some((opener) => opener.pattern === first);
};
