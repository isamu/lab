import type { Lexicon } from "chaffjs/plugin";
import { escapeRegExp } from "./regexp.ts";

// "Rule 3 (Labels)", "CLAUSE 4.2 Payment": a provision headed by a word from provision-heading-word, read as a Section is.
// Which words head a provision is the lexicon's. Pure.

export type ProvisionHeading = {
  /** The heading line, with the number in the group n and what follows it in rest. */
  readonly pattern: RegExp;
  /** The run its numbers are compared in: "rule", "clause". */
  readonly numbering: string;
  readonly label: (n: string) => string;
};

const CAPITALISED = /^\p{Lu}\p{Ll}+$/u;

export const provisionHeadings = (words: Lexicon): ProvisionHeading[] =>
  words
    .map((entry) => entry.pattern)
    .filter((word) => CAPITALISED.test(word))
    .map((word) => ({
      pattern: new RegExp(
        String.raw`^\s{0,3}(?:${escapeRegExp(word.toUpperCase())}|${escapeRegExp(word)})\s+(?<n>\d{1,3}(?:\.\d{1,3}){0,5})\b(?<rest>.*)$`,
        "u",
      ),
      numbering: word.toLowerCase(),
      label: (n: string) => `${word} ${n}`,
    }));
