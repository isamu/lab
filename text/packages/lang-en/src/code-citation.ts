import type { Lexicon } from "chaffjs/plugin";
import { escapeRegExp } from "./regexp.ts";

// "35 CFR §122", "42 U.S.C. § 1983": a section of a code named right before the reference, not of this document.
// Which names are codes is the lexicon's (document-kind).

/** Built once from the lexicon; undefined when it names no code. */
export type CodeVocabulary = { readonly before: RegExp | undefined };

/** The code's title number ("35 CFR"), then the name, then at most a second "§" ("§§ 1981 and 1983") up to the reference. */
const TITLE_NUMBER = String.raw`(?:\d{1,3}\s+)?`;
const SECOND_SIGN = String.raw`\s*(?:§\s*)?$`;

/** "35 CFR " is a few characters. Only this much before a reference is read, however long the line. */
const REACH = 40;

export const codeVocabulary = (lexicons: Readonly<Record<string, Lexicon>>): CodeVocabulary => {
  const names = (lexicons["document-kind"] ?? []).map((entry) => entry.pattern).toSorted((left, right) => right.length - left.length);
  if (names.length === 0) return { before: undefined };
  const name = `(?:${names.map(escapeRegExp).join("|")})`;
  return { before: new RegExp(String.raw`(?<![\p{L}\p{N}_.])(?<code>${TITLE_NUMBER}${name})${SECOND_SIGN}`, "u") };
};

/** The code named right before the reference at `start`, or undefined when none is. */
export const citedCodeBefore = (text: string, start: number, vocabulary: CodeVocabulary): string | undefined =>
  vocabulary.before?.exec(text.slice(Math.max(0, start - REACH), start))?.groups?.["code"];
