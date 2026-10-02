import type { Lexicon, LexiconEntry } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

/**
 * A leading number ("1.", "2-3 ", "１．", "第2章"): numbering, not the heading's words. The number must end in a mark or
 * a space, so the year in "2024年の振り返り" stays.
 */
const LEADING_NUMBER = /^第?[\d０-９]+(?:[.\-．][\d０-９]+)*(?:[章節.)．、:：]|(?=\s))\s*/u;

/** A leading decoration: an emoji or a symbol, with its joiners and variation selectors. */
const LEADING_DECORATION = /^[\p{So}\p{Sk}\p{Extended_Pictographic}\u{FE0F}\u{200D}]+\s*/u;

const CLOSING_MARKS: ReadonlySet<string> = new Set([..." \t?？!！。.:："]);

/** The text without the closing marks at its end, scanned from the end rather than by a pattern that backtracks. */
const withoutClosingMarks = (text: string): string => {
  const characters = [...text];
  const kept = characters.findLastIndex((character) => !CLOSING_MARKS.has(character));
  return characters.slice(0, kept + 1).join("");
};

/** A heading as the lexicons are matched against it: lower case, without its number, decoration and closing marks. */
export const headingWords = (heading: string): string => {
  const trimmed = heading.trim().toLowerCase();
  const stripped = trimmed.replace(LEADING_DECORATION, "").replace(LEADING_NUMBER, "").replace(LEADING_DECORATION, "");
  return withoutClosingMarks(stripped).trim();
};

const LATIN_LETTER = /^[a-z]$/u;

/** A Latin letter on the outer side of a match means the match is part of a longer word ("key" in "keyboard"). */
const breaksWord = (outside: string | undefined, inside: string | undefined): boolean =>
  outside !== undefined && inside !== undefined && LATIN_LETTER.test(outside) && LATIN_LETTER.test(inside);

export const startsWithWord = (words: string, phrase: string): boolean => words.startsWith(phrase) && !breaksWord(words[phrase.length], phrase.at(-1));

export const endsWithWord = (words: string, phrase: string): boolean => words.endsWith(phrase) && !breaksWord(words.at(-phrase.length - 1), phrase[0]);

/** Whether the phrase stands in the words as a whole word (any place for Japanese, between word edges for Latin text). */
export const containsWord = (words: string, phrase: string): boolean => {
  if (phrase.length === 0) return false;
  const starts = [...words.matchAll(new RegExp(`(?=${escapeRegExp(phrase)})`, "gu"))].map((match) => match.index);
  return starts.some((index) => !breaksWord(words[index - 1], phrase[0]) && !breaksWord(words[index + phrase.length], phrase.at(-1)));
};

const matchesAt = (words: string, entry: LexiconEntry): boolean => {
  const phrase = entry.pattern.toLowerCase();
  return entry.position === "before" ? startsWithWord(words, phrase) : endsWithWord(words, phrase);
};

/** The lexicon entry the heading's words take the form of (longest first), or undefined. Unpositioned entries stand at the end. */
export const headingFormOf = (words: string, lexicon: Lexicon): LexiconEntry | undefined =>
  lexicon.toSorted((left, right) => right.pattern.length - left.pattern.length).find((entry) => matchesAt(words, entry));

/** Which bookend the heading is: "before" (an opening such as はじめに), "after" (a closing such as まとめ), or undefined. */
export const bookendOf = (words: string, lexicon: Lexicon): "before" | "after" | undefined =>
  lexicon.find((entry) => startsWithWord(words, entry.pattern.toLowerCase()))?.position;

/** The heading's words without any occurrence of the counterpart, so デメリット is not read as メリット. */
const withoutCounterpart = (words: string, counterpart: string): string => (counterpart === "" ? words : words.replaceAll(counterpart, " "));

/** The pairs (good side, bad side) that both stand in different headings: a symmetric pros / cons layout. */
export const proConPairs = (headings: readonly string[], lexicon: Lexicon): string[] =>
  lexicon.flatMap((entry) => {
    const pro = entry.pattern.toLowerCase();
    const con = (entry.instead_of ?? "").toLowerCase();
    if (con === "") return [];
    const proAt = headings.findIndex((words) => containsWord(withoutCounterpart(words, con), pro));
    const conAt = headings.findIndex((words, index) => index !== proAt && containsWord(words, con));
    return proAt >= 0 && conAt >= 0 ? [`${entry.pattern}/${entry.instead_of ?? ""}`] : [];
  });
