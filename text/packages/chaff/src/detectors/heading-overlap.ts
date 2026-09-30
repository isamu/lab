// How much of a section's heading its first sentence takes up: the heading's character trigrams, and the part of the
// heading the sentence repeats, in the document's length unit. Pure; heading-echo decides with these.
import type { LengthUnit } from "../plugin.ts";

const foldedChars = (text: string): string[] => [...text.toLowerCase().replace(/\s+/gu, "")];

const trigramAt = (chars: readonly string[], index: number): string => chars.slice(index, index + 3).join("");

/**
 * 文字 3-gram で測る。
 * 語 n-gram にすると wordSplit capability が要り、L1（言語を問わず動く）から外れる。
 */
export const trigrams = (text: string): Set<string> => {
  // 大文字小文字を畳む。英語では見出しが Title Case、本文が小文字になり、
  // 同じ語でも一致しなくなる（Generating Output → generated output）。
  const clean = foldedChars(text);
  return new Set(clean.slice(0, Math.max(0, clean.length - 2)).map((__char, index) => trigramAt(clean, index)));
};

/** A word as compared across heading and sentence: case folded, the punctuation around it dropped ("Spacewalks?" is spacewalks). */
const foldedWord = (word: string): string => {
  const chars = [...word.toLowerCase()];
  const isWordChar = (char: string): boolean => /[\p{L}\p{N}]/u.test(char);
  return chars.slice(chars.findIndex(isWordChar), chars.findLastIndex(isWordChar) + 1).join("");
};

const headingWords = (heading: string): string[] =>
  heading
    .trim()
    .split(/\s+/u)
    .filter((word) => word.length > 0);

/** Below this length a word repeats another only as itself: "on" is not repeated by "one", nor "go" by "going". */
const MIN_STEM = 4;

/** The same word, or one of them the other with an ending added (level → levels, reference → references). */
const isSameWord = (headingWord: string, sentenceWord: string): boolean => {
  if (headingWord === sentenceWord) return true;
  const [shorter, longer] = headingWord.length < sentenceWord.length ? [headingWord, sentenceWord] : [sentenceWord, headingWord];
  return shorter.length >= MIN_STEM && longer.startsWith(shorter);
};

/** The heading's words that the sentence repeats; a word of punctuation alone is never repeated. */
const echoedWords = (heading: string, sentence: string): number => {
  const said = sentence.split(/\s+/u).map(foldedWord);
  return headingWords(heading)
    .map(foldedWord)
    .filter((word) => word !== "" && said.some((other) => isSameWord(word, other))).length;
};

/** The heading's characters (spaces aside) that a trigram the sentence also has covers. */
const echoedChars = (heading: string, sentence: string): number => {
  const said = trigrams(sentence);
  const clean = foldedChars(heading);
  const covered = new Set(clean.flatMap((__char, index) => (said.has(trigramAt(clean, index)) ? [index, index + 1, index + 2] : [])));
  return covered.size;
};

/**
 * How much of the heading the sentence repeats, in the document's length unit. A sentence that repeats only part of it
 * ("How Do Astronauts Go on Spacewalks?" → "When astronauts go on spacewalks, they wear spacesuits…") keeps the rest of
 * its length as its own material.
 */
export const echoedHeadingUnits = (heading: string, sentence: string, unit: LengthUnit): number =>
  unit === "word" ? echoedWords(heading, sentence) : echoedChars(heading, sentence);
