import type { Lexicon, LexiconEntry } from "chaffjs/plugin";
import { escapeRegExp } from "./regexp.ts";

// "35 CFR §122", "42 U.S.C. § 1983", "RFC 1122, Section 3.3.4.2": a section of a code or a numbered document named
// right before the reference, not of this document. Which names are codes is the lexicon's (document-kind).

/** Built once from the lexicon; each pattern is undefined when the lexicon names no code of its shape. */
export type CodeVocabulary = {
  readonly before: RegExp | undefined;
  readonly numberedBefore: RegExp | undefined;
  /** The name of a code that takes a title number, at the start of the text and ending at a word boundary. */
  readonly titled: RegExp | undefined;
};

/** The code's title number ("35 CFR"), then the name, then at most a second "§" ("§§ 1981 and 1983") up to the reference. */
const TITLE_NUMBER = String.raw`(?:\d{1,3}\s+)?`;
const SECOND_SIGN = String.raw`\s*(?:§\s*)?$`;
/** The document's own number after its name, then a comma, an opening parenthesis or a space up to the reference. */
const OWN_NUMBER = String.raw`\s+\d{1,5}`;
const NUMBER_TO_REFERENCE = String.raw`(?:,\s*|\s*\(\s*|\s+)(?:§\s*)?$`;
const NOT_INSIDE_A_WORD = String.raw`(?<![\p{L}\p{N}_.])`;
const WORD_ENDS = String.raw`(?![\p{L}\p{N}_])`;

/** "35 CFR " is a few characters. Only this much before a reference is read, however long the line. */
const REACH = 40;

const namesOf = (entries: readonly LexiconEntry[]): string | undefined => {
  const names = entries.map((entry) => entry.pattern).toSorted((left, right) => right.length - left.length);
  return names.length === 0 ? undefined : `(?:${names.map(escapeRegExp).join("|")})`;
};

/** An entry with position "before" is a name written before its own number ("RFC 1122"); the others follow a title number. */
export const codeVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): CodeVocabulary => {
  const entries = lexicons["document-kind"] ?? [];
  const titled = namesOf(entries.filter((entry) => entry.position !== "before"));
  const numbered = namesOf(entries.filter((entry) => entry.position === "before"));
  return {
    before: titled === undefined ? undefined : new RegExp(String.raw`${NOT_INSIDE_A_WORD}(?<code>${TITLE_NUMBER}${titled})${SECOND_SIGN}`, "u"),
    numberedBefore:
      numbered === undefined ? undefined : new RegExp(String.raw`${NOT_INSIDE_A_WORD}(?<code>${numbered}${OWN_NUMBER})${NUMBER_TO_REFERENCE}`, "u"),
    titled: titled === undefined ? undefined : new RegExp(String.raw`^${titled}${WORD_ENDS}`, "u"),
  };
};

/** The code named right before the reference at `start`, or undefined when none is. */
export const citedCodeBefore = (text: string, start: number, vocabulary: CodeVocabulary): string | undefined => {
  const before = text.slice(Math.max(0, start - REACH), start);
  return vocabulary.before?.exec(before)?.groups?.["code"] ?? vocabulary.numberedBefore?.exec(before)?.groups?.["code"];
};

/** "40 CFR § 163.25" at the start of a heading: the text after the number starts with a code named after a title number. */
export const titledCodeAt = (rest: string, vocabulary: CodeVocabulary): boolean => vocabulary.titled?.test(rest) === true;
