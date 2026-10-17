import type { Sentence } from "../plugin.ts";

// An open list inside brackets that gloss a condition (必要ない場合（単一テーブルへの SELECT 等）も付与すること): the list
// gives examples of when the duty applies, not what the duty covers, so leaving it open is no smell. The condition words
// come from the language's requirement-open-condition lexicon. Pure.

/** Each closing bracket and the opening bracket it closes. */
const PAIRS: ReadonlyMap<string, string> = new Map([
  [")", "("],
  ["）", "（"],
]);
const OPENING: ReadonlySet<string> = new Set(PAIRS.values());

type Open = { readonly char: string; readonly index: number };

/**
 * The brackets still open before `end` of `text`, outermost first. A closing bracket closes only its own kind, so a
 * stray half-width ")" leaves a full-width "（" open. One pass, no recursion: a statute's sentence is long.
 */
const openBracketsBefore = (text: string, end: number): Open[] => {
  const open: Open[] = [];
  text
    .slice(0, Math.max(0, end))
    .split("")
    .forEach((char, index) => {
      if (OPENING.has(char)) open.push({ char, index });
      else if (PAIRS.has(char) && open.at(-1)?.char === PAIRS.get(char)) open.pop();
    });
  return open;
};

/**
 * Whether the open word starting at document offset `start` stands inside brackets, at any depth, that open right after
 * a condition word (場合（…等）, とき（…など）, 場合（A（B 等））).
 */
export const glossesCondition = (sentence: Sentence, start: number, conditions: readonly string[]): boolean =>
  openBracketsBefore(sentence.text, start - sentence.span.start).some((bracket) => {
    const before = sentence.text.slice(0, bracket.index).trimEnd();
    return conditions.some((word) => word !== "" && before.endsWith(word));
  });
