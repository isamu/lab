const QUOTE_OPENERS: Readonly<Record<string, string>> = { "”": "“", "’": "‘", '"': '"', "」": "「", "』": "『" };

/**
 * Whether the line ends with a quotation it opens after words of its own (Revised “Getting It Right!”): the stop belongs to
 * the quoted title, not to a sentence of the line's.
 */
export const endsWithQuotedTitle = (line: string): boolean => {
  const text = line.trimEnd();
  const opener = QUOTE_OPENERS[text.at(-1) ?? ""];
  if (opener === undefined) return false;
  const opened = text.slice(0, -1).lastIndexOf(opener);
  return opened > 0 && text.slice(0, opened).trim() !== "";
};
