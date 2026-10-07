import type { Span, Token } from "../plugin.ts";
import type { FactValue } from "./fact-values.ts";
import type { Fact } from "./labelled-facts.ts";

// A value with no label, named by who counts, the verb that counts and what is counted ("We gained 52 new customers": we
// + gain + new customer). A summary that states such a value is compared with the body's value for the same three. Pure:
// reads the tagger's parts of speech and lemmas.

/** The words right after a number that say what it counts, and the key of who counts it with which verb. */
export type CountedPhrase = Span & { readonly label: string; readonly key: string };

/** How many words after a number may name what it counts ("new enterprise customers"). */
const MAX_COUNTED_WORDS = 3;
const COUNTED_WORD: ReadonlySet<string> = new Set(["ADJ", "NOUN"]);
const SUBJECT_WORD: ReadonlySet<string> = new Set(["NOUN", "PROPN", "PRON"]);
/** A number right after a preposition is part of something larger: the pool in "1 of 3 proposals". */
const NOT_A_COUNT_AFTER: ReadonlySet<string> = new Set(["ADP", "NUM"]);

/** The number is the end of a range ("between 10 and 12 customers") or of a pair ("1 of 3"). */
const isPartOfLarger = (tokens: readonly Token[], index: number): boolean => {
  const [twoBefore, before] = [tokens[index - 2], tokens[index - 1]];
  return NOT_A_COUNT_AFTER.has(before?.pos ?? "") || (before?.pos === "CCONJ" && twoBefore?.pos === "NUM");
};

const wordOf = (token: Token): string => (token.lemma ?? token.surface).toLowerCase();

/** The adjectives and nouns right after the number at index, up to the last noun ("new customers"). */
const countedWords = (tokens: readonly Token[], index: number): Token[] => {
  const after = tokens.slice(index + 1, index + 1 + MAX_COUNTED_WORDS);
  const stop = after.findIndex((token) => !COUNTED_WORD.has(token.pos));
  const run = stop < 0 ? after : after.slice(0, stop);
  return run.slice(0, run.findLastIndex((token) => token.pos === "NOUN") + 1);
};

/**
 * What the number at index in a sentence's tokens counts: the words after it, the nearest verb before it, and the nearest
 * noun or pronoun before that verb (who counts). None when one of the three is missing or the number is part of a larger one.
 */
export const countedPhraseAt = (tokens: readonly Token[], index: number): CountedPhrase[] => {
  if (isPartOfLarger(tokens, index)) return [];
  const words = countedWords(tokens, index);
  const verbAt = tokens.slice(0, index).findLastIndex((token) => token.pos === "VERB");
  const subject = tokens.slice(0, Math.max(0, verbAt)).findLast((token) => SUBJECT_WORD.has(token.pos));
  const [first, last, verb] = [words[0], words.at(-1), tokens[verbAt]];
  if (first === undefined || last === undefined || verb === undefined || subject === undefined) return [];
  const key = ["counted", wordOf(subject), wordOf(verb), ...words.map(wordOf)].join("\u0000");
  return [{ start: first.span.start, end: last.span.end, label: words.map((token) => token.surface).join(" "), key }];
};

/** A calendar year ("2026 revenue") is a point in time, not a count. */
const YEAR = /^(?:1[89]|2[01])\d{2}$/u;

/** The fact of each number with no unit that a counted phrase follows after one character (the space). */
export const countedFacts = (source: string, values: readonly FactValue[], phrases: readonly CountedPhrase[]): Fact[] =>
  values.flatMap((value) => {
    if (value.kind !== "quantity" || value.unit !== "" || YEAR.test(source.slice(value.start, value.end))) return [];
    const phrase = phrases.find((candidate) => candidate.start === value.end + 1);
    return phrase === undefined ? [] : [{ label: phrase.label, key: phrase.key, value }];
  });
