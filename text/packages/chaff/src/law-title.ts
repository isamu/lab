// The title of a statute cited with its number (愛がん動物用飼料の安全性の確保に関する法律（ペットフード安全法）（平成20年法律第83号）).
// The statute fixed its title's spelling, so its words are the statute's and not the writer's. Pure.

import type { Span } from "./plugin.ts";

/** What a cited title starts after: the end of a sentence or a clause, a quotation, a bracket, a space or a line. */
const TITLE_BOUNDARY = /[、。，．,.「」『』（）()\s]/u;
const CLOSING_BRACKETS = "）)";
const OPENING_BRACKETS = "（(";

const lastIndexOfAny = (text: string, characters: string, before: number): number =>
  Math.max(...[...characters].map((character) => text.lastIndexOf(character, before)));

/** Where the brackets written right before `at` (a short name, （ペットフード安全法）) open; `at` when none closes there. */
const bracketsStart = (text: string, at: number): number => {
  if (at === 0 || !CLOSING_BRACKETS.includes(text.charAt(at - 1))) return at;
  const opening = lastIndexOfAny(text, OPENING_BRACKETS, at - 2);
  const nested = lastIndexOfAny(text, CLOSING_BRACKETS, at - 2);
  return opening === -1 || nested > opening ? at : bracketsStart(text, opening);
};

/** Where the title before a statute's number begins: past the brackets before the number, back to a boundary. */
const titleStart = (text: string, numberAt: number): number => {
  const units = text.slice(0, bracketsStart(text, numberAt)).split("");
  return units.findLastIndex((unit) => TITLE_BOUNDARY.test(unit)) + 1;
};

/**
 * Each statute title in text, with the brackets after it up to its number. numbers: the patterns of a statute's number in
 * brackets (（平成20年法律第83号）), from the language's lexicon.
 */
export const lawTitleSpans = (text: string, numbers: readonly RegExp[]): Span[] =>
  numbers.flatMap((number) =>
    [...text.matchAll(new RegExp(number.source, "gu"))].flatMap((match): Span[] => {
      const start = titleStart(text, match.index);
      return start >= bracketsStart(text, match.index) ? [] : [{ start, end: match.index + match[0].length }];
    }),
  );
