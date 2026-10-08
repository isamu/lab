// A list left open (等, など, etc.) that a limit closes in the same breath (自転車等に限ります, only A, B, etc.). Pure: reads one
// sentence's text and tokens; the open words, the limits and the phrases that look like a limit without being one come
// from the language's nado-closed-list lexicon.
import type { LexiconEntry, Token } from "./plugin.ts";
import { escapeRegExp } from "./orthography.ts";

export type ClosedListWords = {
  readonly open: readonly string[];
  /** A limit right after the open word (等に限り, etc. only). */
  readonly limitsAfter: readonly string[];
  /** A limit before the list it governs (only A, B, etc.). */
  readonly limitsBefore: readonly string[];
  /** A phrase holding a limit's letters that closes nothing (に限らず, not only). */
  readonly notLimits: readonly string[];
};

/** An open word on a closed list: where it is in the sentence, the word and the limit. */
export type OpenOnClosed = { readonly offset: number; readonly open: string; readonly limit: string };

const patternsOf = (entries: readonly LexiconEntry[], group: string, position?: "before" | "after"): string[] =>
  entries.filter((entry) => entry.group === group && (position === undefined || entry.position === position)).map((entry) => entry.pattern);

export const closedListWordsOf = (entries: readonly LexiconEntry[]): ClosedListWords => ({
  open: patternsOf(entries, "open"),
  limitsAfter: patternsOf(entries, "limit", "after"),
  limitsBefore: patternsOf(entries, "limit", "before"),
  notLimits: patternsOf(entries, "not-limit"),
});

const LATIN_START = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;
/** What may stand between an open word and a limit right after it: spaces, a comma, a closing bracket. */
const BETWEEN_OPEN_AND_LIMIT = /^[\s,、)）」』]*/u;
/** A word that is a counter or a class (1等, 2等), not an open word, by the tagger's features. */
const CLASS_NOUN = "Class";
/** What makes the words between a limit and an open word a clause of their own, not the list it governs. */
const CLAUSE_POS: ReadonlySet<string> = new Set(["AUX", "VERB"]);
/** A verb form that modifies a noun inside a list (a driving licence, used cars). */
const NOUN_MODIFYING_FORMS: ReadonlySet<string> = new Set(["Ger", "Part"]);
const LIST_SEPARATOR = /[,、]/u;

/** Where a word occurs in a text; a Latin word only as whole words, any case. */
const placesOf = (text: string, word: string): number[] => {
  const latin = LATIN_START.test(word);
  const matches = [...text.matchAll(new RegExp(escapeRegExp(word), latin ? "giu" : "gu"))].map((match) => match.index);
  if (!latin) return matches;
  return matches.filter((at) => !LETTER.test(text[at - 1] ?? "") && !LETTER.test(text[at + word.length] ?? ""));
};

const startsWithWord = (text: string, word: string): boolean => placesOf(text.slice(0, word.length + 1), word).includes(0);

/**
 * The open word stands as a word of its own: a token starts there, is no longer than the word (等しい, 同等 are other
 * words), and is not a counter (1等). Token spans are the sentence's own offsets. Without tokens only a Latin word is read.
 */
const standsAsOpenWord = (tokens: readonly Token[], at: number, open: string): boolean => {
  if (tokens.length === 0) return LATIN_START.test(open);
  const token = tokens.find((candidate) => candidate.span.start === at);
  return token !== undefined && open.toLowerCase().startsWith(token.surface.toLowerCase()) && token.features?.NounType !== CLASS_NOUN;
};

const limitRightAfter = (rest: string, words: ClosedListWords): string | undefined => {
  const after = rest.slice(BETWEEN_OPEN_AND_LIMIT.exec(rest)?.[0].length ?? 0);
  if (words.notLimits.some((phrase) => startsWithWord(after, phrase))) return undefined;
  return longestFirst(words.limitsAfter).find((limit) => startsWithWord(after, limit));
};

const longestFirst = (words: readonly string[]): string[] => [...words].sort((a, b) => b.length - a.length);

const insideNotLimit = (text: string, at: number, notLimits: readonly string[]): boolean =>
  notLimits.some((phrase) => placesOf(text, phrase).some((start) => start <= at && at < start + phrase.length));

const OPEN_BRACKETS = /[(（]/gu;
const CLOSE_BRACKETS = /[)）]/gu;

/** A bracket opened and not closed between the limit and the list: the list explains a word the limit governs. */
const opensBracket = (between: string): boolean => (between.match(OPEN_BRACKETS)?.length ?? 0) > (between.match(CLOSE_BRACKETS)?.length ?? 0);

/** The words between a limit and the open word are a list it governs: separated by commas, with no clause of their own. */
const governsList = (text: string, tokens: readonly Token[], from: number, to: number): boolean =>
  LIST_SEPARATOR.test(text.slice(from, to)) &&
  !opensBracket(text.slice(from, to)) &&
  !tokens.some(
    (token) => token.span.start >= from && token.span.end <= to && CLAUSE_POS.has(token.pos) && !NOUN_MODIFYING_FORMS.has(token.features?.VerbForm ?? ""),
  );

const limitBefore = (text: string, tokens: readonly Token[], at: number, words: ClosedListWords): string | undefined => {
  const limits = words.limitsBefore.flatMap((limit) =>
    placesOf(text.slice(0, at), limit).map((start) => ({ limit, start, end: start + limit.length, negated: insideNotLimit(text, start, words.notLimits) })),
  );
  const nearest = limits.toSorted((a, b) => b.start - a.start)[0];
  if (nearest === undefined || nearest.negated) return undefined;
  return governsList(text, tokens, nearest.end, at) ? nearest.limit : undefined;
};

/** The open words of one sentence that a limit closes, by their offset in the sentence. */
export const openWordsOnClosedLists = (text: string, tokens: readonly Token[], words: ClosedListWords): OpenOnClosed[] =>
  words.open
    .flatMap((open) => placesOf(text, open).map((at) => ({ open, at })))
    .filter(({ open, at }) => standsAsOpenWord(tokens, at, open))
    .flatMap(({ open, at }) => {
      const limit = limitRightAfter(text.slice(at + open.length), words) ?? limitBefore(text, tokens, at, words);
      return limit === undefined ? [] : [{ offset: at, open, limit }];
    })
    .sort((a, b) => a.offset - b.offset || b.open.length - a.open.length)
    .filter((hit, index, hits) => hits[index - 1]?.offset !== hit.offset);
