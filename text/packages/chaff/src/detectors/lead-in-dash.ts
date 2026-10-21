// An en dash between two digits (45–58, 10:00–10:15) is a range mark, the typographer's correct choice, not a dash that
// sets off words.
export const DASH = /[—―]|(?<!\p{Nd})–|–(?!\p{Nd})/gu;

/**
 * The start of a list item: "(1) ", "(A) ", "1. ", "a) ", "- ", "• ", optionally after the quotation mark an Act quoted in
 * a statute's notes opens each paragraph with. In brackets, a number, one or two letters ("(aa)") or a roman numeral, not
 * a word ("(note)"). Four spaces of indent make a Markdown code block, not a list.
 */
const OPENING = /^ {0,3}["“]?/u;
const BRACKETED = /^\((?:\d{1,3}|[A-Za-z]{1,2}|[ivxlc]{1,6}|[IVXLC]{1,6})\)[ \t]/u;
const MARKED = /^(?:\d{1,3}[.)]|[A-Za-z][.)]|[-*+•])[ \t]/u;

const isListItem = (line: string): boolean => {
  const label = line.slice(OPENING.exec(line)?.[0].length ?? 0);
  return BRACKETED.test(label) || MARKED.test(label);
};

/** The end of the line that holds `offset`. */
const lineEndAt = (source: string, offset: number): number => {
  const end = source.indexOf("\n", offset);
  return end === -1 ? source.length : end;
};

/** The first line after `from` that is not blank, or undefined at the end of the text. */
const nextWrittenLine = (source: string, from: number): string | undefined => {
  for (let start = from; start < source.length; start = lineEndAt(source, start) + 1) {
    const line = source.slice(start, lineEndAt(source, start));
    if (line.trim() !== "") return line;
  }
  return undefined;
};

/**
 * "(a) Whoever—" ending its paragraph, with "(1) having knowingly accessed…" below: the dash introduces the list that
 * follows, as a colon would. It is the form of an enumeration, not a dash that sets off words. `offset` is the dash's.
 */
export const introducesList = (source: string, offset: number): boolean => {
  const end = lineEndAt(source, offset);
  if (source.slice(offset + 1, end).trim() !== "") return false;
  const next = nextWrittenLine(source, end + 1);
  return next !== undefined && isListItem(next);
};
