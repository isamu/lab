import { escapeRegExp } from "./regexp.ts";

/**
 * sentence-splitter joins an initial to the next word only when a capitalised word stands before it, so "written by
 * J. Smith", "Smith and C.W. Landsea" and "by F. W. Evans" were each cut after the initials. After a word that leads a
 * name (by, and), initials before a capitalised word are a name's, unless that word is a sentence-start-word
 * ("items B and D. The rest") or the initials are the pronoun I ("you and I. Then"). Their full stops are replaced with
 * a plain letter; the length does not change, so the spans fit the original text.
 */

const EDGE_BEFORE = String.raw`(?<![\p{L}\p{N}_.'’])`;
const WORD_END = String.raw`(?![\p{L}\p{N}_.'’-])`;
const PLAIN_LETTER = "n";
const FULL_STOP = /\./gu;
const PRONOUN_I = /^I\.$/u;

const oneOf = (words: readonly string[]): string => `(?:${words.map(escapeRegExp).join("|")})`;

/** Built once from the lexicons: initials after a lead word, before a capitalised word that is not a sentence-start-word. */
export const leadInitials = (leadWords: readonly string[], startWords: readonly string[]): RegExp | undefined => {
  if (leadWords.length === 0) return undefined;
  const notStart = startWords.length === 0 ? "" : String.raw`(?!\s+${oneOf(startWords)}${WORD_END})`;
  return new RegExp(String.raw`(?<=${EDGE_BEFORE}${oneOf(leadWords)}[ \t]+)(?:\p{Lu}\.[ \t]?){0,2}\p{Lu}\.(?=\s+\p{Lu})${notStart}`, "gu");
};

/** The text with the full stops of every name's initials after a lead word rewritten. */
export const unmarkLeadInitials = (text: string, pattern: RegExp | undefined): string =>
  pattern === undefined ? text : text.replace(pattern, (initials: string) => (PRONOUN_I.test(initials) ? initials : initials.replace(FULL_STOP, PLAIN_LETTER)));
