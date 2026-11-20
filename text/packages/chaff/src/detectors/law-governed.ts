import { escapeRegExp } from "../orthography.ts";
import type { Lexicon } from "../plugin.ts";

// A vague word that a law or a section governs: "as required by applicable law", "as required under 45 CFR §164.528".
// What the law requires is fixed by the law it names, so the word leaves nothing for the reader to decide. Pure: the
// governing words (by, under) and the words that name a law (law, Act, §, HIPAA) come from the language's lexicon.

/** The lexicon's groups: the words that govern a law, and the words that name one. */
const GOVERNOR = "governor";
const REFERENCE = "reference";
/** How many words after the governing word may hold the law's name: "the Food Safety Modernization Act". */
const MAX_OBJECT_WORDS = 6;
/** Where the governed phrase ends: a clause's punctuation or a bracket. A full stop counts only before a space. */
const OBJECT_END = /[,;:()（）、。\n]|\.(?=\s|$)/u;

export type LawReference = { readonly governors: readonly string[]; readonly references: readonly string[] };

export const NO_LAW_REFERENCE: LawReference = { governors: [], references: [] };

export const lawReferenceOf = (lexicon: Lexicon): LawReference => ({
  governors: lexicon.filter((entry) => entry.group === GOVERNOR).map((entry) => entry.pattern.toLowerCase()),
  references: lexicon.filter((entry) => entry.group === REFERENCE).map((entry) => entry.pattern.toLowerCase()),
});

/** A word written whole: no letter or digit right before it, no letter right after it (§164 holds §, laws does not hold law). */
const wholeWord = (word: string): RegExp => new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?!\\p{L})`, "u");

/** The governing word the text opens with, and the text after it; undefined when it opens with none. */
const afterGovernor = (text: string, governors: readonly string[]): string | undefined => {
  const lower = text.trimStart().toLowerCase();
  const governor = governors.find((word) => word !== "" && new RegExp(`^${escapeRegExp(word)}(?!\\p{L})`, "u").test(lower));
  return governor === undefined ? undefined : lower.slice(governor.length);
};

/** The words the governing word takes, up to the clause's end or the next governing word ("the customer under the law" stops at under). */
const objectOf = (text: string, governors: readonly string[]): string => {
  const end = text.search(OBJECT_END);
  const words = (end === -1 ? text : text.slice(0, end)).split(/\s+/u).filter((word) => word !== "");
  const starts = new Set(governors.map((governor) => governor.split(/\s+/u)[0] ?? ""));
  const next = words.findIndex((word) => starts.has(word));
  return (next === -1 ? words : words.slice(0, next)).slice(0, MAX_OBJECT_WORDS).join(" ");
};

/** Whether the words right after end (an offset in text) govern the word by a law or a section: "… by applicable law". */
export const governedByLaw = (text: string, end: number, law: LawReference): boolean => {
  const rest = afterGovernor(text.slice(end), law.governors);
  if (rest === undefined) return false;
  const object = objectOf(rest, law.governors);
  return law.references.some((word) => word !== "" && wholeWord(word).test(object));
};
