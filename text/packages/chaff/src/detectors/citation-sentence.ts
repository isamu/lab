// A bibliographic citation written out as a sentence, as in a footnote: authors and the year in parentheses, then a title
// or a publisher. Its length is the length of the reference, not of the writer's prose. Pure.

/** "Keys and Reina (2025)," or "Federal Housing Finance Agency (n.d.),": the year in parentheses, a comma after it. */
const AUTHOR_YEAR = /\((?:\d{4}[a-z]?|n\.d\.)\),/u;

/** What only a reference carries: a quoted title right after the year, a place and publisher, or a page range. */
const PUBLICATION_MARKS: readonly RegExp[] = [
  /\((?:\d{4}[a-z]?|n\.d\.)\),\s*["“]/u,
  /\([\p{Lu}][^():]*:\s[^()]+\)/u,
  /\bpp\.\s*\d/u,
];

export const isCitationSentence = (text: string): boolean =>
  AUTHOR_YEAR.test(text) && PUBLICATION_MARKS.some((mark) => mark.test(text));
