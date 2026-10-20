/** A heading that ends with a colon, as a label does ("Phone:"). */
const COLON_END = /[:：]$/u;

/** A line that ends a sentence: a full stop, a question or an exclamation mark, then closing quotes, brackets or emphasis. */
const SENTENCE_END = /[.!?。！？][”’"')\]」』）*_]*$/u;

/** A line of markup that holds items, not a value: a list item, a table row, a quotation, a code fence. */
const MARKUP_LINE = /^(?:[-*+>|]|\d+[.)]\s|```|~~~)/u;

/** What a value holds: a number (a street number, a postcode, a phone number) or an address (@). */
const VALUE_MARK = /[\d０-９@＠]/u;

/** A value is short: an address of a few lines, a number. Longer lines without a full stop are prose that left it off. */
const MAX_VALUE_LINES = 3;
const MAX_VALUE_WORDS = 6;
const MAX_VALUE_CHARS = 40;

const WORD = /\S+/gu;

const isValueLine = (line: string): boolean =>
  !SENTENCE_END.test(line) && !MARKUP_LINE.test(line) && [...line].length <= MAX_VALUE_CHARS && (line.match(WORD) ?? []).length <= MAX_VALUE_WORDS;

/**
 * Whether a heading is the label of a field ("Mailing Address:", "Phone:") rather than the title of a section: it ends with a
 * colon, and what stands under it (body: the text up to the next heading) is a value: a few short lines with no sentence or
 * list in them, holding a number or an address (a mailing address, a phone number). A page's contact block is set this way,
 * and its labels are not compared with the section titles.
 */
export const isFieldLabel = (heading: string, body: string): boolean => {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");
  return (
    COLON_END.test(heading.trim()) &&
    lines.length > 0 &&
    lines.length <= MAX_VALUE_LINES &&
    lines.every(isValueLine) &&
    lines.some((line) => VALUE_MARK.test(line))
  );
};
