/**
 * The start of a list item: "(1) ", "(A) ", "1. ", "a) ", "- ", "• ", optionally after the quotation mark an Act quoted in
 * a statute's notes opens each paragraph with.
 */
const LIST_ITEM = /^[ \t]*["“]?(?:\([A-Za-z0-9]{1,4}\)|\d{1,3}[.)]|[A-Za-z][.)]|[-*+•])[ \t]/u;

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
  return next !== undefined && LIST_ITEM.test(next);
};
