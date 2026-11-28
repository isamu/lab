// Where an email's greeting and closing words are found in a line: a Latin word at the head of the line or of one of its
// sentences, a Japanese word anywhere, and a name alone as the salutation (Priya,). Pure; the words come from the caller.
import { escapeRegExp } from "../orthography.ts";

const LATIN_START = /^[A-Za-z]/u;
const LETTER = /\p{L}/u;

/**
 * Whether a line holds one of the words. A Latin word opens the line (Dear, Best regards) and is followed by no letter,
 * so "Hi" does not match "History"; a Japanese word may stand anywhere in it (いつもお世話になっております).
 */
export const lineHas = (line: string, words: readonly string[]): boolean => {
  const trimmed = line.trim();
  const folded = trimmed.toLowerCase();
  return words.some((word) => {
    if (!LATIN_START.test(word)) return trimmed.includes(word);
    return folded.startsWith(word.toLowerCase()) && !LETTER.test(trimmed.charAt(word.length));
  });
};

/** A name alone as the salutation (Priya,) is a few words; a longer line ending in a comma is a sentence run on. */
const MAX_SALUTATION_WORDS = 3;

/** Whether a line is a name alone as the salutation: a few words holding a letter, ending with one of the marks, no sentence's end. */
export const isSalutation = (line: string, marks: readonly string[], sentenceEnds: readonly string[]): boolean => {
  const trimmed = line.trim();
  const mark = marks.find((candidate) => trimmed.endsWith(candidate));
  if (mark === undefined || !LETTER.test(trimmed)) return false;
  const name = trimmed.slice(0, trimmed.length - mark.length);
  return name.split(/\s+/u).length <= MAX_SALUTATION_WORDS && !sentenceEnds.some((end) => name.includes(end));
};

/** The line's sentences after the first: what follows a sentence's end mark and a blank (…on Monday. Thanks, and…). */
const laterSentences = (line: string, sentenceEnds: readonly string[]): string[] =>
  sentenceEnds.length === 0 ? [] : line.split(new RegExp(`(?:${sentenceEnds.map(escapeRegExp).join("|")})\\s+`, "u")).slice(1);

/** Whether a closing opens the line or one of its later sentences (It reopens on Monday. Thanks, and enjoy the day!). */
export const closingIn = (line: string, closings: readonly string[], sentenceEnds: readonly string[]): boolean =>
  [line, ...laterSentences(line, sentenceEnds)].some((sentence) => lineHas(sentence, closings));
