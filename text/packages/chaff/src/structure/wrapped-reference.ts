// A cross-reference that a wrapped paragraph carries to the start of a line ("… the signature referenced in\n   Section
// 2.3."): read as a numbered heading, it opened a phantom section and broke the numbering. Pure.

/** Nothing after the number but the end of a reference: "Section 2.3." or "Section 2.5.4).". */
const NO_TITLE = /^\)?[.,;]?$/u;
/** The line before ends mid-sentence: on a word in lower case, or on a comma or an opening bracket. */
const ENDS_MID_SENTENCE = /(?:(?<![\p{L}\p{N}])\p{Ll}+|[,(])\s*$/u;
/** A short line before (a title in sentence case, "Scope and application") is not running text. */
const MIN_RUNNING_WORDS = 5;

const wordCount = (line: string): number => line.split(/\s+/u).filter((word) => word !== "").length;

/**
 * Whether a numbered line with nothing after its number (no title, no text) ends the sentence of the line before. A
 * heading alone on its line ("Section 3." after a full stop, after a title such as "DEFINITIONS" or "Definitions") is not.
 */
export const isWrappedReference = (rest: string, previous: string | undefined): boolean =>
  previous !== undefined && NO_TITLE.test(rest.trim()) && ENDS_MID_SENTENCE.test(previous) && wordCount(previous) >= MIN_RUNNING_WORDS;

/** The numbered line, or undefined when it is a wrapped reference. A Markdown heading's line is always the heading. */
export const unlessWrappedReference = <Line extends { readonly rest: string }>(
  numbered: Line | undefined,
  onHeading: boolean,
  previous: string | undefined,
): Line | undefined => (numbered === undefined || onHeading || !isWrappedReference(numbered.rest, previous) ? numbered : undefined);
