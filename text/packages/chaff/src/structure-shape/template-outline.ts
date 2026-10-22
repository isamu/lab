import type { Lexicon, LexiconEntry } from "../plugin.ts";
import { startsWithWord } from "./heading-words.ts";

/** How many of the template's sections an outline needs before it reads as the template: a real proposal has one or two. */
export const TEMPLATE_SECTIONS = 4;

/** Kanji or katakana: a compound goes on through them, so 効果 does not open 効果測定 and 提案 does not open 提案者. */
const COMPOUND = /[\p{Script=Han}\p{Script=Katakana}ー]/u;

const continuesCompound = (words: string, phrase: string): boolean =>
  COMPOUND.test(phrase.at(-1) ?? "") && COMPOUND.test([...words.slice(phrase.length)][0] ?? "");

const opensWith = (words: string, phrase: string): boolean => startsWithWord(words, phrase) && !continuesCompound(words, phrase);

/** The longest entry the heading opens with, so 提案の背景 is the background and not the proposal. */
const sectionOf = (words: string, lexicon: Lexicon): LexiconEntry | undefined =>
  lexicon
    .filter((entry) => entry.group !== undefined && opensWith(words, entry.pattern.toLowerCase()))
    .toSorted((left, right) => right.pattern.length - left.pattern.length)[0];

/**
 * The template sections (the lexicon's groups: summary, background, proposal, benefits…) that the headings stand for,
 * each once, in heading order. `headings` are heading words as headingWords gives them (lower case, numbers dropped).
 */
export const templateSectionsOf = (headings: readonly string[], lexicon: Lexicon): string[] => [
  ...new Set(headings.flatMap((words) => sectionOf(words, lexicon)?.group ?? [])),
];

/** Whether the outline is the template: enough of its sections stand as headings. */
export const isTemplateOutline = (sections: readonly string[]): boolean => sections.length >= TEMPLATE_SECTIONS;
