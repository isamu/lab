import type { Sentence } from "../plugin.ts";

// An open list inside brackets that gloss a condition (必要ない場合（単一テーブルへの SELECT 等）も付与すること): the list
// gives examples of when the duty applies, not what the duty covers, so leaving it open is no smell. The condition words
// come from the language's requirement-open-condition lexicon. Pure.

const OPENING: ReadonlySet<string> = new Set(["(", "（"]);
const CLOSING: ReadonlySet<string> = new Set([")", "）"]);

/** Where the innermost bracket still open before `end` of `text` opens, or -1. One pass, no recursion: a statute's sentence is long. */
const openBracketBefore = (text: string, end: number): number => {
  const open: number[] = [];
  text
    .slice(0, Math.max(0, end))
    .split("")
    .forEach((char, index) => {
      if (OPENING.has(char)) open.push(index);
      else if (CLOSING.has(char)) open.pop();
    });
  return open.at(-1) ?? -1;
};

/**
 * Whether the open word starting at document offset `start` stands inside brackets that open right after a condition
 * word (場合（…等）, とき（…など）).
 */
export const glossesCondition = (sentence: Sentence, start: number, conditions: readonly string[]): boolean => {
  const bracket = openBracketBefore(sentence.text, start - sentence.span.start);
  if (bracket === -1) return false;
  const before = sentence.text.slice(0, bracket).trimEnd();
  return conditions.some((word) => word !== "" && before.endsWith(word));
};
