import type { Span } from "./plugin.ts";

// The marks of a heading or a quotation that are syntax, not words: what a rule limited to headings or quotations must
// not read (`## 概要` reads 概要). Positions are in the text given. Pure.

const QUOTE_MARKS = /^[ \t]*(?:>[ \t]?)+/gmu;
const ATX_OPENING = /^[ \t]*#{1,6}(?=[ \t]|$)/gmu;
const ATX_CLOSING = /(?<![ \t])[ \t]+#+[ \t]*$/gmu;
const SETEXT_UNDERLINE = /^[ \t]*(?:=+|-+)[ \t]*$/gmu;

const spansOf = (text: string, pattern: RegExp): Span[] =>
  [...text.matchAll(pattern)].flatMap((match) => (match[0] === "" ? [] : [{ start: match.index, end: match.index + match[0].length }]));

/** The `>` opening each line of a quotation, nested ones too (`> > `). */
export const quoteMarkers = (text: string): Span[] => spansOf(text, QUOTE_MARKS);

/**
 * One heading's `#` run, its closing `#` run and a setext underline (`===`), its quotation marks already blanked. The
 * `#` of `C#` is a word: a closing run follows a space.
 */
export const headingMarkers = (heading: string): Span[] => [
  ...spansOf(heading, ATX_OPENING),
  ...spansOf(heading, ATX_CLOSING),
  ...spansOf(heading, SETEXT_UNDERLINE),
];
