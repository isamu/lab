// Words a sentence's length should not count because the writer did not build a sentence of them: a title (a line with no
// full stop whose words are capitalised, or a quoted title inside a list item), and a run of quoted terms listed one after
// another ("MUST", "MUST NOT", … and "OPTIONAL"), which reads as one list. Pure.

type Span = { readonly start: number; readonly end: number };

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’&.-]*/gu;
/** Short words (of, the, and, in) keep their lower case in a title; the longer words decide. */
const SIGNIFICANT_LENGTH = 4;
const MIN_SIGNIFICANT = 3;
/** Share of the longer words that start with a capital in a title ("Supervisory Guidance for Assessing Risk …"). */
const TITLE_SHARE = 0.75;
const STARTS_UPPER = /^\p{Lu}/u;
const LETTER_LOWER = /\p{Ll}/u;

const wordsOf = (text: string): string[] => text.match(WORD) ?? [];

/** Most of its longer words start with a capital, and some are not all capitals (a title, not an acronym run). */
export const isTitleCase = (text: string): boolean => {
  const significant = wordsOf(text).filter((word) => word.length >= SIGNIFICANT_LENGTH && !/^\d/u.test(word));
  if (significant.length < MIN_SIGNIFICANT || !significant.some((word) => LETTER_LOWER.test(word))) return false;
  return significant.filter((word) => STARTS_UPPER.test(word)).length / significant.length >= TITLE_SHARE;
};

/** The end of a sentence: a stop, then any closing quotes or brackets. */
const ENDS_SENTENCE = /[.?!。？！][\s"'”’)\]]*$/u;

/** A line with no sentence end whose words are a title (an attachment's name, a list of letters' titles). */
export const isTitleLine = (text: string): boolean => !ENDS_SENTENCE.test(text.trim()) && isTitleCase(text);

const QUOTED = /“([^“”]+)”|"([^"\n]+)"/gu;

/** The words of the quoted titles in a text (“Changes to Home Mortgage Disclosure Act Loan Volume Reporting Threshold”). */
export const quotedTitleWords = (text: string): number =>
  [...text.matchAll(QUOTED)]
    .map((match) => match[1] ?? match[2] ?? "")
    .filter(isTitleCase)
    .reduce((total, title) => total + wordsOf(title).length, 0);

/** A quoted term of up to three words. */
const TERM = String.raw`["“][^"“”\n]{1,30}["”]`;
/** Three or more quoted terms joined by commas, the last after a short word (and, or). */
const TERM_SERIES = new RegExp(String.raw`${TERM}(?:[ \t\n]*,[ \t\n]*${TERM}){1,}(?:[ \t\n]*,?[ \t\n]+\p{Ll}{2,3}[ \t\n]+${TERM})`, "gu");
const MAX_TERM_WORDS = 3;

const TERM_WORDS = /["“]([^"“”\n]{1,30})["”]/gu;

/** How many words fewer a series of quoted terms makes the sentence, read as one word ("MUST", "SHALL NOT" … "OPTIONAL"). */
export const termSeriesSaving = (text: string): number =>
  [...text.matchAll(TERM_SERIES)]
    .map((match) => [...match[0].matchAll(TERM_WORDS)].map((term) => wordsOf(term[1] ?? "")))
    .filter((terms) => terms.every((words) => words.length > 0 && words.length <= MAX_TERM_WORDS))
    .reduce((total, terms) => total + Math.max(0, terms.flat().length - 1), 0);

/** Whether a span lies inside one of the item spans of the document's lists. */
export const isInListItem = (span: Span, items: readonly Span[]): boolean => items.some((item) => item.start <= span.start && span.end <= item.end);
