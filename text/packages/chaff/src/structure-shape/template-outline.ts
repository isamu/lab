import type { Lexicon, LexiconEntry } from "../plugin.ts";
import { startsWithWord } from "./heading-words.ts";

/** How many of the template's sections an outline needs before it reads as the template: a real proposal has one or two. */
export const TEMPLATE_SECTIONS = 4;

/** Kanji or katakana: a compound goes on through them, so 効果 does not open 効果測定 and 提案 does not open 提案者. */
const COMPOUND = /[\p{Script=Han}\p{Script=Katakana}ー]/u;

const characterAt = (text: string, index: number): string => {
  const code = text.codePointAt(index);
  return code === undefined ? "" : String.fromCodePoint(code);
};

const continuesCompound = (words: string, phrase: string): boolean => COMPOUND.test(phrase.at(-1) ?? "") && COMPOUND.test(characterAt(words, phrase.length));

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

/**
 * The share of the headings that must be template sections before the template is the whole outline. A real proposal
 * that uses the template's sections keeps them among headings of its own; a generated one has little else.
 */
export const WHOLE_TEMPLATE_SHARE = 0.75;

/** Whether the template outline is the whole outline: nearly every heading is one of its sections, the writer's own words nearly absent. */
export const isWholeTemplateOutline = (headings: readonly string[], lexicon: Lexicon): boolean => {
  const inTemplate = headings.filter((words) => sectionOf(words, lexicon) !== undefined).length;
  return isTemplateOutline(templateSectionsOf(headings, lexicon)) && inTemplate >= headings.length * WHOLE_TEMPLATE_SHARE;
};
