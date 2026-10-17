// Phrases set in capitals by convention ("NOW, THEREFORE, BE IT RESOLVED" in a resolution). Pure.
import { escapeRegExp } from "../orthography.ts";

const COMMA_OR_SPACE = /,?\s+/u;

const wordsOf = (text: string): string => text.trim().split(COMMA_OR_SPACE).join(" ");

/**
 * Whether a run of capitals is made only of the listed phrases of several words, one after another ("NOW, THEREFORE" then
 * "BE IT RESOLVED"). A comma after a word, as a run of capitals writes it, is ignored. One-word entries (MUST) match nothing here.
 */
export const isConventionalPhrase = (run: string, entries: Iterable<string>): boolean => {
  const phrases = [...entries].map(wordsOf).filter((phrase) => phrase.includes(" "));
  if (phrases.length === 0) return false;
  const one = `(?:${phrases.map(escapeRegExp).join("|")})`;
  return new RegExp(`^${one}(?: ${one})*$`, "u").test(wordsOf(run));
};
