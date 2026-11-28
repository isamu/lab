import type { LexiconEntry, Token } from "../plugin.ts";
import { entryEndsAt, type TokenRange } from "./lexicon-match.ts";

// An open list that a word pointing back opens (当該改良、改善等 "the said improvements, etc."): it names a list the text
// gave before, so whatever it leaves open was left open there, and is reported there if anywhere. The pointing words come
// from the language's requirement-open-end lexicon, in the group below. Pure.

const ANAPHOR = "list-anaphor";
const NAME_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);
/** The marks that join the items of a list (改良、改善等, 信用・ブランド等). */
const ITEM_JOINS: ReadonlySet<string> = new Set(["、", "，", "・"]);

export const anaphorWordsOf = (entries: readonly LexiconEntry[]): readonly LexiconEntry[] => entries.filter((entry) => entry.group === ANAPHOR);

/** Whether an entry is a pointing word rather than an open-end word. */
export const isAnaphorCue = (entry: LexiconEntry): boolean => entry.group === ANAPHOR;

const inList = (token: Token | undefined): boolean => token !== undefined && (NAME_POS.has(token.pos) || ITEM_JOINS.has(token.surface));

/** Where the list that ends right before index starts: the nouns and the marks between them, walking back. */
const listStart = (tokens: readonly Token[], index: number): number => (index > 0 && inList(tokens[index - 1]) ? listStart(tokens, index - 1) : index);

/** The first word of the list, past any joining mark the walk took in at its head. */
const firstWord = (tokens: readonly Token[], index: number, end: number): number =>
  index < end && ITEM_JOINS.has(tokens[index]?.surface ?? "") ? firstWord(tokens, index + 1, end) : index;

/** Whether the list the open word at range closes opens with a word that points back to one given before (当該). */
export const refersBack = (tokens: readonly Token[], range: TokenRange, words: readonly LexiconEntry[]): boolean => {
  const first = firstWord(tokens, listStart(tokens, range.start), range.start);
  return words.some((entry) => entryEndsAt(tokens, entry, first + (entry.tokens?.length ?? 0)));
};
