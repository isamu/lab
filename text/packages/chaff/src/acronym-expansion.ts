// The words an acronym is spelled from, beside it in brackets: Communication Access Realtime Translation (CART), VADER (Valence
// Aware Dictionary and sEntiment Reasoner). The expansion is the name the acronym stands for and keeps the name's spelling, and
// its picked-out capitals (sEntiment) are the acronym's letters, not another spelling of the word. Pure.

import type { Span } from "./plugin.ts";

const BRACKET = /\(([^()]*)\)/gu;
const LATIN_WORD = /\p{Script=Latin}[\p{Script=Latin}\d]*(?:-[\p{Script=Latin}\d]+)*/gu;
const ACRONYM = /^\p{Lu}{2,10}$/u;
/** The word before an expansion in brackets: an acronym in any case (VADER, axle), letters only. */
const ACRONYM_ANY_CASE = /^\p{L}{2,10}$/u;
const CAPITAL = /\p{Lu}/gu;
/** Small words an expansion may hold besides the words that give letters (Valence Aware Dictionary and sEntiment Reasoner). */
const MAX_EXTRA_WORDS = 3;

type Word = { readonly text: string; readonly start: number; readonly end: number };

const wordsIn = (text: string, offset: number): Word[] =>
  [...text.matchAll(LATIN_WORD)].map((match) => ({ text: match[0], start: offset + match.index, end: offset + match.index + match[0].length }));

const capitalsOf = (words: readonly Word[]): string => words.map((word) => (word.text.match(CAPITAL) ?? []).join("")).join("");

const sortedLetters = (letters: string): string => [...letters.toUpperCase()].toSorted((left, right) => left.localeCompare(right)).join("");

const spells = (words: readonly Word[], acronym: string): boolean => sortedLetters(capitalsOf(words)) === sortedLetters(acronym);

const spanOf = (words: readonly Word[]): Span[] => {
  const [first, last] = [words[0], words.at(-1)];
  return first === undefined || last === undefined ? [] : [{ start: first.start, end: last.end }];
};

/** The words right before an acronym in brackets whose capitals spell it: the shortest such run ending at the bracket. */
const expansionBefore = (text: string, open: number, acronym: string): Span[] => {
  const before = wordsIn(text.slice(0, open), 0);
  const tail = text.slice(before.at(-1)?.end ?? 0, open);
  if (before.length === 0 || tail.trim() !== "") return [];
  const longest = Math.min(before.length, acronym.length + MAX_EXTRA_WORDS);
  const length = Array.from({ length: longest }, (_, extra) => extra + 1).find((size) => spells(before.slice(-size), acronym));
  return length === undefined ? [] : spanOf(before.slice(-length));
};

/** The words in brackets right after an acronym whose capitals spell it (VADER (Valence Aware … Reasoner), axle (… eXperience ELicitation)). */
const expansionInside = (text: string, open: number, content: string): Span[] => {
  const acronym = text.slice(0, open).trimEnd().split(/\s/u).at(-1) ?? "";
  const inside = wordsIn(content, open + 1);
  if (!ACRONYM_ANY_CASE.test(acronym) || inside.length < 2 || !spells(inside, acronym)) return [];
  return spanOf(inside);
};

/** Where the expansions of the acronyms in text lie, both ways round: the expansion before the acronym in brackets, or in brackets after it. */
export const acronymExpansionSpans = (text: string): Span[] =>
  [...text.matchAll(BRACKET)].flatMap((match) => {
    const content = match[1] ?? "";
    const trimmed = content.trim();
    if (ACRONYM.test(trimmed)) return expansionBefore(text, match.index, trimmed);
    return expansionInside(text, match.index, content);
  });
