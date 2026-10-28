// A number the tree did not read but the text writes: "(d)" run into the end of the line before "(e)", "6.1" and "6.2"
// written as plain paragraphs before the "6.3" the tree read, "(11)" joined to the heading of "(10)". A skip across such
// a label is not a missing number. Pure.

const LETTERS = "abcdefghijklmnopqrstuvwxyz";

/** At most this many missing numbers are looked for; a wider skip is not a few labels the tree missed. */
const MAX_MISSING = 30;

/** A label in brackets ((11)): in the heading before, a bare number may be any number in its words. */
const BRACKETED = /^[([]/u;
/** An HTML comment: text the reader does not see, so a label in it is not written. */
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;

const escapeRegExp = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");

/** The label written with another number in place of its own: digits for digits, a letter in the same case for a letter. */
const relabel = (label: string, ordinal: number): ((other: number) => string) | undefined => {
  const digits = [...label.matchAll(/\d+/gu)].findLast((match) => Number(match[0]) === ordinal);
  if (digits !== undefined) return (other) => `${label.slice(0, digits.index)}${other}${label.slice(digits.index + digits[0].length)}`;
  const letter = [...label.matchAll(/(?<![A-Za-z])[A-Za-z](?![A-Za-z])/gu)].findLast((match) => LETTERS.indexOf(match[0].toLowerCase()) + 1 === ordinal);
  if (letter === undefined) return undefined;
  const upper = letter[0] !== letter[0].toLowerCase();
  return (other) => {
    const written = LETTERS.charAt(other - 1);
    return `${label.slice(0, letter.index)}${upper ? written.toUpperCase() : written}${label.slice(letter.index + 1)}`;
  };
};

/**
 * A label set out as one: at the start of a line behind the same marks as the later label (## for a heading, none for a
 * paragraph), after a run of spaces within a line, or after a space in the heading that opens the node before
 * ("##### (10) … (11) …", a label in brackets). A label in a sentence or in an HTML comment ("under clause (d)") is a reference, and a list item's "3." under
 * headings numbered "## 4." is another numbering.
 */
const setOutIn = (text: string, label: string, lead: string): boolean => {
  const escaped = escapeRegExp(label);
  const after = String.raw`(?![0-9A-Za-z])`;
  const atLineStart = new RegExp(String.raw`^[ \t]*${escapeRegExp(lead)}[ \t]*${escaped}${after}`, "mu");
  const afterSpaces = new RegExp(String.raw`\S[ \t]{2,}${escaped}${after}`, "u");
  if (atLineStart.test(text) || afterSpaces.test(text)) return true;
  const firstLine = text.split("\n", 1)[0] ?? "";
  const bracketed = BRACKETED.test(label);
  return bracketed && firstLine.trimStart().startsWith("#") && new RegExp(String.raw`\s${escaped}${after}`, "u").test(firstLine);
};

/** The marks before a label on its own line (## of a heading, > of a quotation), spaces left out. */
const leadOf = (source: string, start: number, label: string): string => {
  const lineStart = source.lastIndexOf("\n", start - 1) + 1;
  const lineEnd = source.indexOf("\n", start);
  const line = source.slice(lineStart, lineEnd === -1 ? source.length : lineEnd).normalize("NFKC");
  const at = line.indexOf(label);
  return at === -1 ? "" : line.slice(0, at).trim();
};

export type LabelSpan = { readonly label: string; readonly ordinal: number; readonly start: number };

/**
 * Whether the text between two numbered nodes sets out a label of the later one's kind with a number the skip leaves out
 * (between previous's last number and current's), which the tree did not read as a node.
 */
export const labelWrittenBetween = (source: string, previous: LabelSpan & { readonly last: number }, current: LabelSpan): boolean => {
  const missing = current.ordinal - previous.last - 1;
  if (missing < 1 || missing > MAX_MISSING || current.start <= previous.start) return false;
  const label = current.label.normalize("NFKC");
  const written = relabel(label, current.ordinal);
  if (written === undefined) return false;
  const lead = leadOf(source, current.start, label);
  const text = source
    .slice(source.lastIndexOf("\n", previous.start - 1) + 1, current.start)
    .replaceAll(HTML_COMMENT, "")
    .normalize("NFKC");
  return Array.from({ length: missing }, (_, index) => written(previous.last + 1 + index)).some((missingLabel) => setOutIn(text, missingLabel, lead));
};
