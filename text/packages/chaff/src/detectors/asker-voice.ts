import type { LexiconEntry, Section, Sentence } from "../plugin.ts";

// A section whose heading names what a reader asked (【相談事例等】, ご質問) quotes the asker in their own words; its sentences
// are not in the writer's voice. The heading words come from the language's asker-heading lexicon. Pure.

/** Brackets a heading is set in (【相談事例等】, ［ご質問］); they are not part of its words. */
const BRACKETS = /^[\s【〔［[（(「『]+|[\s】〕］\]）)」』:：]+$/gu;

const headingWords = (section: Section): string => (section.unlabeledHeading ?? section.heading).replace(BRACKETS, "");

/** Whether the section's heading, without its number and brackets, is one of the words naming a reader's question. */
export const isAskerSection = (section: Section, headings: readonly LexiconEntry[]): boolean => {
  const words = headingWords(section);
  return words !== "" && headings.some((entry) => entry.pattern === words);
};

/** The sentences of every section whose heading names a reader's question. */
export const askerSentences = (sections: readonly Section[], headings: readonly LexiconEntry[]): Set<Sentence> =>
  new Set(sections.filter((section) => isAskerSection(section, headings)).flatMap((section) => section.sentences));
