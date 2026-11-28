const CODE_MARK = "`";
const PARAGRAPH_BREAK = /\n[ \t]*\n/u;
const PARAGRAPH_BREAKS = new RegExp(PARAGRAPH_BREAK.source, "gu");
/** The quote that opens right after a code mark, and the mark that closes it. */
const CLOSER: Readonly<Record<string, string>> = { '"': '"', "'": "'", "“": "”", "‘": "’" };

/** The offsets in a paragraph of its single code marks; a run of two or more (``) is a fence or a longer delimiter, not counted. */
const codeMarksIn = (paragraph: string): number[] =>
  [...paragraph].flatMap((char, at) => (char === CODE_MARK && paragraph[at - 1] !== CODE_MARK && paragraph[at + 1] !== CODE_MARK ? [at] : []));

/** The quote's two offsets in a paragraph, when a quote opens right after the code mark at `mark` and closes on the same line. */
const quoteAfter = (paragraph: string, mark: number): number[] => {
  const opening = mark + 1;
  const closer = CLOSER[paragraph[opening] ?? ""];
  if (closer === undefined) return [];
  const closing = paragraph.indexOf(closer, opening + 1);
  const lineEnd = paragraph.indexOf("\n", opening);
  return closing === -1 || (lineEnd !== -1 && closing > lineEnd) ? [] : [opening, closing];
};

/** Where each paragraph of `source` starts and ends (its break excluded). */
const paragraphSpans = (source: string): { start: number; end: number }[] => {
  const breaks = [...source.matchAll(PARAGRAPH_BREAKS)];
  const starts = [0, ...breaks.map((match) => match.index + match[0].length)];
  return starts.map((start, at) => ({ start, end: breaks[at]?.index ?? source.length }));
};

/** The quote offsets in `source` of the one paragraph from start to end. */
const unclosedIn = (source: string, start: number, end: number): number[] => {
  const paragraph = source.slice(start, end);
  const marks = codeMarksIn(paragraph);
  const last = marks.at(-1);
  return last !== undefined && marks.length % 2 === 1 ? quoteAfter(paragraph, last).map((at) => start + at) : [];
};

/**
 * The offsets in `source` of the quote marks of a quoted value that opens right after a code mark left unclosed in its
 * paragraph (`"my-secure-password" (don't use this)): the writer meant the value as code and dropped the closing mark, so
 * its quotes are the code's, not the prose's. Code marks pair from the left, so with an odd count the last one is unclosed.
 */
export const unclosedCodeQuoteOffsets = (source: string): ReadonlySet<number> =>
  new Set(paragraphSpans(source).flatMap(({ start, end }) => unclosedIn(source, start, end)));
