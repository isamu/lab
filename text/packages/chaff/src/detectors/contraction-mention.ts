import { quotedSpans } from "../quoted-span.ts";

import type { Span } from "../plugin.ts";

// A short phrase in quotation marks ("Do Not Disturb", ‘we’re going to x’) is a name or an example: the form is mentioned,
// not used, so it says nothing about the document's register. Spoken words carry punctuation ("We don't know," she
// said) and stay, unless they are quoted inside another quotation (a platform's label in a quoted sentence), which is
// someone else's wording twice over. The text must already have straight apostrophes, so a ’ left in it closes a quotation.

const MENTION_MARKS: Readonly<Record<string, string>> = { "“": "”", '"': '"', "‘": "’" };
/** More words than this in quotation marks is a quoted sentence, not a phrase named as an example. */
const MAX_MENTION_WORDS = 4;
const PHRASE = /^[\p{L}' ]+$/u;

const isMention = (quoted: string): boolean => {
  const phrase = quoted.trim();
  return PHRASE.test(phrase) && phrase.split(/\s+/u).length <= MAX_MENTION_WORDS;
};

const isNested = (span: Span, spans: readonly Span[]): boolean => spans.some((outer) => outer !== span && outer.start < span.start && span.end < outer.end);

/** text with the characters in each span replaced by spaces, every other character at its place. */
const blankSpans = (text: string, spans: readonly Span[]): string => {
  if (spans.length === 0) return text;
  const units = text.split("");
  spans.forEach((span) => units.fill(" ", Math.max(0, span.start), Math.min(text.length, span.end)));
  return units.join("");
};

/** The text with each quoted short phrase, and each quotation inside another, blanked out. */
export const withoutMentions = (text: string): string => {
  const quoted = quotedSpans(text, MENTION_MARKS);
  return blankSpans(
    text,
    quoted.filter((span) => isMention(text.slice(span.start, span.end)) || isNested(span, quoted)),
  );
};

/**
 * The text (which starts at offset in the document) with the document ranges that fall in it blanked out.
 * Ranges are in document coordinates; those outside the text change nothing.
 */
export const blankRanges = (text: string, offset: number, ranges: readonly Span[]): string =>
  blankSpans(
    text,
    ranges
      .filter((range) => range.end > offset && range.start < offset + text.length)
      .map((range) => ({ start: range.start - offset, end: range.end - offset })),
  );

/** A list of search terms or keywords runs to at least this many comma-separated items. */
const MIN_LIST_TERMS = 8;
/** A term is a few words; a longer item is a clause of prose. */
const MAX_TERM_WORDS = 4;
/** Share of the items that must be terms: a list's label ("(i) Functional errors (k1=50): error") may run longer. */
const MIN_TERM_SHARE = 0.9;

/**
 * A sentence that is a list of terms (keywords, search strings: "won't load, wont load, can't login, …") names its
 * contractions as items; it does not write in a register.
 */
export const isTermList = (text: string): boolean => {
  const items = text
    .split(/[,;]/u)
    .map((item) => item.trim())
    .filter((item) => item !== "");
  if (items.length < MIN_LIST_TERMS) return false;
  const terms = items.filter((item) => item.split(/\s+/u).length <= MAX_TERM_WORDS);
  return terms.length >= items.length * MIN_TERM_SHARE;
};
