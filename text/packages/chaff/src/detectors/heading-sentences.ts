import type { ProseDocument, Section, Sentence, Token } from "../plugin.ts";

const shifted = (tokens: readonly Token[], by: number): Token[] =>
  tokens.map((token) => ({ ...token, span: { start: token.span.start + by, end: token.span.end + by } }));

/** Where the heading's text starts in the source: from the heading's line, which ends where its section starts. */
const textStartOf = (source: string, section: Section, headingStarts: ReadonlyMap<number, number>): number | undefined => {
  const from = headingStarts.get(section.span.start);
  if (from === undefined) return undefined;
  const at = source.indexOf(section.heading, from);
  return at < 0 || at >= section.span.start ? undefined : at;
};

const headingSentence = (source: string, section: Section, headingStarts: ReadonlyMap<number, number>): Sentence[] => {
  if (section.depth === 0 || section.heading === "") return [];
  const start = textStartOf(source, section, headingStarts);
  if (start === undefined) return [];
  const span = { start, end: start + section.heading.length };
  return [
    section.headingTokens === undefined ? { span, text: section.heading } : { span, text: section.heading, tokens: shifted(section.headingTokens, start) },
  ];
};

/**
 * Each heading read as one sentence, placed where its text stands in the source, with its words. For a rule that reads
 * the words a writer chose in titles as well as in body sentences. A heading whose text cannot be found in its line
 * (inline markup in it) is left out rather than placed wrong.
 */
export const headingSentences = (doc: ProseDocument): Sentence[] => {
  const headingStarts = new Map((doc.markup?.headings ?? []).map((heading) => [heading.end, heading.start]));
  return doc.sections.flatMap((section) => headingSentence(doc.source, section, headingStarts));
};

/** Body sentences and headings together, in the order they stand in the source. */
export const sentencesWithHeadings = (doc: ProseDocument): Sentence[] =>
  [...doc.sentences, ...headingSentences(doc)].toSorted((left, right) => left.span.start - right.span.start);
