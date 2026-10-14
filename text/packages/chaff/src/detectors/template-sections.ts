import type { Lexicon, MarkupHeading } from "../plugin.ts";
import { escapeRegExp } from "../orthography.ts";

type Span = { readonly start: number; readonly end: number };

/** Lexicon group of placeholder-word: a word that, in a heading, says what follows is a template (Template, 雛形). */
export const TEMPLATE = "template";

const LATIN = /\p{Script=Latin}/u;

/** Does the character beside a match end the word? A Latin edge needs a non-letter next to it; a CJK word stands anywhere. */
const boundsWord = (edge: string, beside: string | undefined): boolean => !LATIN.test(edge) || beside === undefined || !/[\p{L}\p{N}]/u.test(beside);

const holdsWordAt = (text: string, pattern: string, index: number): boolean =>
  boundsWord(pattern[0] ?? "", text[index - 1]) && boundsWord(pattern.at(-1) ?? "", text[index + pattern.length]);

/** The heading names a template: one of the words appears in it as a whole word, in any case. */
export const namesTemplate = (heading: string, words: Lexicon): boolean => {
  const text = heading.toLowerCase();
  return words.some((word) => {
    const pattern = word.pattern.toLowerCase();
    return [...text.matchAll(new RegExp(escapeRegExp(pattern), "gu"))].some((match) => holdsWordAt(text, pattern, match.index));
  });
};

/** A heading's section runs from the heading to the next one at its depth or above; text before a template title stays checked. */
const sectionOf = (headings: readonly MarkupHeading[], index: number, documentEnd: number): Span => {
  const heading = headings[index];
  const next = headings.slice(index + 1).find((later) => later.depth <= (heading?.depth ?? 0));
  return { start: heading?.start ?? 0, end: next?.start ?? documentEnd };
};

/** The parts of a document under a heading that names a template: their blanks are the point, not a slip. */
export const templateSections = (headings: readonly MarkupHeading[], documentEnd: number, words: Lexicon): Span[] =>
  words.length === 0 ? [] : headings.flatMap((heading, index) => (namesTemplate(heading.text, words) ? [sectionOf(headings, index, documentEnd)] : []));

export const isInside = (spans: readonly Span[], offset: number): boolean => spans.some((span) => span.start <= offset && offset < span.end);
