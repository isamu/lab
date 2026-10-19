import type { LexiconEntry, Section, Sentence } from "../plugin.ts";

// A section whose heading names what a reader asked (【相談事例等】, ご質問内容) quotes the asker in their own words; its sentences
// are not in the writer's voice. The heading words come from the language's asker-heading lexicon. Pure.

/** Marks around a heading's words (【相談事例等】, ［ご質問内容］, a trailing colon); they are not part of the words. */
const OPENING: ReadonlySet<string> = new Set([..." \t\u3000【〔［[（(「『"]);
const CLOSING: ReadonlySet<string> = new Set([..." \t\u3000】〕］]）)」』:："]);

const headingWords = (section: Section): string => {
  const chars = [...(section.unlabeledHeading ?? section.heading)];
  const start = chars.findIndex((char) => !OPENING.has(char));
  return start === -1 ? "" : chars.slice(start, chars.findLastIndex((char) => !CLOSING.has(char)) + 1).join("");
};

/** Whether the section's heading, without its number and brackets, is one of the words naming a reader's question. */
export const isAskerSection = (section: Section, headings: readonly LexiconEntry[]): boolean => {
  const words = headingWords(section);
  return words !== "" && headings.some((entry) => entry.pattern === words);
};

/** The sentences of every section whose heading names a reader's question. */
export const askerSentences = (sections: readonly Section[], headings: readonly LexiconEntry[]): Set<Sentence> =>
  new Set(sections.filter((section) => isAskerSection(section, headings)).flatMap((section) => section.sentences));
