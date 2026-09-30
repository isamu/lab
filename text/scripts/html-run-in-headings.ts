// A section title drawn as a bold first line of its paragraph: <p><strong>Conclusion</strong><br />In closing, …</p>.
// Read as text the title runs into the paragraph as one line. The bold run becomes a heading one level below the
// heading before it (h2 when none), and the rest stays the paragraph. Only a bold run that opens the paragraph, holds
// plain text, is short, does not end as a sentence or a label (".", ":") and has a sentence (or a lead-in ending in a
// colon) after its line break is taken for a title; a name over its role ("Jane Roe<br>Secretary") is a signature. Pure.
import { hasSentence, plainText } from "./html-elements.ts";

const MAX_TITLE_LENGTH = 100;
const DEEPEST_LEVEL = 6;
const TOP_LEVEL = 1;

// A paragraph's start, a bold run and a line break: the paragraph's text follows up to its end tag.
const OPENING = /<p\b([^>]*)>\s*<(strong|b)\b[^>]*>([^<]*)<\/\2\s*>\s*<br\b[^>]*>/giu;

/** The paragraph's text after from, up to its end tag; undefined when another paragraph opens first or none closes. */
const restOfParagraph = (html: string, from: number): string | undefined => {
  const next = /<(\/?)p\b/iu.exec(html.slice(from));
  return next?.[1] === "/" ? html.slice(from, from + next.index) : undefined;
};

// A sentence's end, a label's colon, or a clause's comma or semicolon: the bold run is part of the text, not a title.
const ENDS_AS_TEXT = /[.!?:;,。！？：；、]$/u;

/** A sentence, or a lead-in to a list ("… with the same:"): what a section holds, unlike a role under a name. */
const isProse = (html: string): boolean => hasSentence(html) || /[:：]$/u.test(plainText(html));

const isTitle = (bold: string, rest: string | undefined): boolean => {
  const title = bold.trim();
  return title !== "" && title.length <= MAX_TITLE_LENGTH && !ENDS_AS_TEXT.test(title) && rest !== undefined && isProse(rest);
};

/** The level of the last heading opening before at; 1 when there is none, as if under the page's title. */
const levelBefore = (html: string, at: number): number => {
  const headings = [...html.slice(0, at).matchAll(/<h([1-6])\b/giu)];
  return Number(headings.at(-1)?.[1] ?? TOP_LEVEL);
};

export const withRunInHeadingsRead = (html: string): string =>
  html.replace(OPENING, (opening: string, attributes: string, _tag: string, bold: string, at: number) => {
    if (!isTitle(bold, restOfParagraph(html, at + opening.length))) return opening;
    const level = String(Math.min(levelBefore(html, at) + 1, DEEPEST_LEVEL));
    return `<h${level}>${bold.trim()}</h${level}><p${attributes}>`;
  });
