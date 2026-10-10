/** A word as the tokenizer gives it: what is written and where. */
export type SpannedSurface = { readonly surface: string; readonly span: { readonly start: number; readonly end: number } };

/** Where a listed word lies in the tokens (from the first token to the last, both included) and the word as written. */
export type WholeWordRun = { readonly first: number; readonly last: number; readonly word: string };

/** The listed words, as a set or keyed to what they map to. */
export type ListedWords = ReadonlySet<string> | ReadonlyMap<string, string>;

/** お + 嬢 + さま is the longest cut seen; a listed word is not looked for across more tokens than this. */
export const MAX_WHOLE_WORD_PARTS = 3;

const joinedSurface = (tokens: readonly SpannedSurface[], first: number, last: number): string =>
  tokens
    .slice(first, last + 1)
    .map((token) => token.surface)
    .join("");

/** The longest listed word written by tokens from `first` on, each touching the one before. */
const longestFrom = (tokens: readonly SpannedSurface[], first: number, words: ListedWords): WholeWordRun | undefined => {
  const lasts = Array.from({ length: MAX_WHOLE_WORD_PARTS }, (_, extra) => first + extra).filter((last) => last < tokens.length);
  const touching = lasts.filter((last) => tokens.slice(first + 1, last + 1).every((token, at) => tokens[first + at]?.span.end === token.span.start));
  const written = touching.map((last) => ({ first, last, word: joinedSurface(tokens, first, last) }));
  return written.filter(({ word }) => words.has(word)).at(-1);
};

/**
 * The listed words in a sentence's tokens, each one run, however the tokenizer cut it: お客様 is one token and お客さま is お客 and
 * さま, and the さま must not be read as the さま written after a name. Runs do not overlap; the earlier one wins.
 */
export const wholeWordRuns = (tokens: readonly SpannedSurface[], words: ListedWords): WholeWordRun[] =>
  words.size === 0
    ? []
    : tokens.reduce<WholeWordRun[]>((runs, _, first) => {
        if ((runs.at(-1)?.last ?? -1) >= first) return runs;
        const run = longestFrom(tokens, first, words);
        return run === undefined ? runs : [...runs, run];
      }, []);
