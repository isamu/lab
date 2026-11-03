// A bibliographic entry written as a line of a note, as Japanese papers print them (SIST 02): fields closed by a period,
// "著者. 題. 出版者, 2025, p. 369." The words of the entry are the cited work's, not the writer's. Pure.

/** A period that closes a field: a full-width one, or an ASCII one after a letter that is not ASCII, a closing quote or bracket, followed by a space. */
const FIELD_END = /．(?=\S)|(?<=\P{ASCII})\.(?=\s)/gu;

/** What a reference carries and a sentence of prose does not: a year, a quoted title in “”, a link, or a page. */
const PUBLICATION_MARKS: readonly RegExp[] = [/(?<!\d)(?:1[89]|20)\d{2}(?!\d)/u, /“[^”]/u, /https?:\/\//u, /\bpp?\. ?\d/u];

/** Fields closed before the end of the text that it takes to be an entry and not one sentence: author, title, then the rest. */
const MIN_FIELD_ENDS = 2;

/** Whether the text is a bibliographic entry: two fields or more closed by a period inside it, and a mark only a reference carries. */
export const isBibliographyEntry = (text: string): boolean => {
  const body = text.trim();
  const fieldEnds = [...body.matchAll(FIELD_END)].filter((match) => match.index + match[0].length < body.length);
  return fieldEnds.length >= MIN_FIELD_ENDS && PUBLICATION_MARKS.some((mark) => mark.test(body));
};
