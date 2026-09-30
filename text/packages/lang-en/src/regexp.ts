/** A word from a lexicon, matched as written: a sign in it is that character, not a pattern. */
export const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
