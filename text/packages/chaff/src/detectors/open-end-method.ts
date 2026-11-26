import type { LexiconEntry, Token } from "../plugin.ts";
import { entryEndsAt, type TokenRange } from "./lexicon-match.ts";

// An open word right after an act that gives one example of how to do the act named next (別シートに分離するなどデータ
// 構造を改める "restructure the data, by moving it to another sheet for instance"): the requirement is the act that
// follows, with its own object and verb, and the example leaves it no more open. The open word made into an act of its
// own (保存するなどして, 保存するなどしなければならない), naming a kind (保存するなどの措置) or ending a list of things (氏名、
// 住所など) is none of this. The case particles that mark the object come from the language's requirement-open-end lexicon,
// in the group below. Pure.

const METHOD_CASE = "method-case";
const NAME_POS: ReadonlySet<string> = new Set(["NOUN", "PROPN"]);
const VERB = "VERB";
const PUNCT = "PUNCT";

export const methodWordsOf = (entries: readonly LexiconEntry[]): readonly LexiconEntry[] => entries.filter((entry) => entry.group === METHOD_CASE);

/** Whether an entry is a case particle of the act that follows rather than an open-end word. */
export const isMethodCue = (entry: LexiconEntry): boolean => entry.group === METHOD_CASE;

/** Where the run of nouns that starts at index ends (one past its last noun). */
const nounRunEnd = (tokens: readonly Token[], index: number): number => (NAME_POS.has(tokens[index]?.pos ?? "") ? nounRunEnd(tokens, index + 1) : index);

/** Whether a verb stands after index before the clause closes at a mark. */
const verbFollows = (tokens: readonly Token[], index: number): boolean => {
  const token = tokens[index];
  if (token === undefined || token.pos === PUNCT) return false;
  return token.pos === VERB || verbFollows(tokens, index + 1);
};

/**
 * Whether the open word at range follows a verb and is followed by a noun run, a case particle and a verb: an example of
 * how to do the act that follows. range: the tokens the open word covers.
 */
export const exemplifiesMethod = (tokens: readonly Token[], range: TokenRange, words: readonly LexiconEntry[]): boolean => {
  if (tokens[range.start - 1]?.pos !== VERB) return false;
  const objectEnd = nounRunEnd(tokens, range.end);
  if (objectEnd === range.end) return false;
  const particle = words.find((entry) => entryEndsAt(tokens, entry, objectEnd + (entry.tokens?.length ?? 0)));
  return particle !== undefined && verbFollows(tokens, objectEnd + (particle.tokens?.length ?? 0));
};
