/** A heading that ends with a colon, as a label does ("Phone:"). */
const COLON_END = /[:：]$/u;

/** A line that ends a sentence: a full stop, a question or an exclamation mark, then closing quotes, brackets or emphasis. */
const SENTENCE_END = /[.!?。！？][”’"')\]」』）*_]*$/u;

/** A value is short: an address line or a phone number. A longer line without a full stop is prose that left it off. */
const MAX_VALUE_WORDS = 6;

/** A run of letters or digits not split by a space: a word, or a run of Japanese text, which then counts as one. */
const WORD = /\S+/gu;

const isValueLine = (line: string): boolean => !SENTENCE_END.test(line) && (line.match(WORD) ?? []).length <= MAX_VALUE_WORDS;

/**
 * Whether a heading is the label of a field ("Mailing Address:", "Phone:") rather than the title of a section: it ends with a
 * colon, and what stands under it (body: the text up to the next heading) is a value, short lines with no sentence in them
 * (an address, a number). A page's contact block is set this way, and its labels are not compared with the section titles.
 */
export const isFieldLabel = (heading: string, body: string): boolean => {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return COLON_END.test(heading.trim()) && lines.length > 0 && lines.every(isValueLine);
};
