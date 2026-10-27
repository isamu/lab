// Text a writer copies rather than writes, where a spaced or doubled hyphen is the source's own separator and not a hyphen
// standing in for a dash: a label quoted as printed, a reference list entry, a short category name in a field, a log or bot
// line, and HTML markup shown as text. Pure.
import { QUOTATION_MARKS, quotedSpans } from "../quoted-span.ts";

type Line = { readonly text: string; readonly at: number };

/** The line that holds `offset`, and where the offset falls in it. */
const lineAround = (source: string, offset: number): Line => {
  const start = source.lastIndexOf("\n", offset - 1) + 1;
  const end = source.indexOf("\n", offset);
  return { text: source.slice(start, end === -1 ? source.length : end), at: offset - start };
};

/** After the hyphen, a capital: a new part of a label or of a printed sign ("Unhelpful - Tweet doesn't need a note"). */
const CAPITAL_AFTER = /^\s*-{1,2}\s+\p{Lu}/u;

/** Inside a quotation, a hyphen before a capital separates the parts of what is quoted as printed. A dash in quoted prose runs on in lower case. */
const isQuotedLabelPart = (line: Line): boolean =>
  CAPITAL_AFTER.test(line.text.slice(line.at)) && quotedSpans(line.text, QUOTATION_MARKS).some((span) => line.at >= span.start && line.at < span.end);

/** A reference list entry opened by its number in brackets ("[49] M. Skjuve … (2021) My chatbot companion - a study …"). */
const REFERENCE_ENTRY = /^\s*(?:[-*+]\s+)?\[\d{1,4}\]\s/u;

/** A field's label, bold or not, up to its colon ("**Navan Policy Category:** "). */
const FIELD_LABEL = /^\s*(?:[-*+]\s+)?(?:\*\*|__)?[^:.!?]{1,80}:(?:\*\*|__)?\s/u;

/** At most this many words after the hyphen for a field's value to read as a category name ("Co-working Space - Daily Office Pass"). */
const NAME_WORDS = 3;

const SENTENCE_END = /[.!?]/u;

/** The value of a field that names a category in a few words, with no sentence in it: the hyphen is part of the name. */
const isFieldName = (line: Line): boolean => {
  const label = FIELD_LABEL.exec(line.text);
  if (label === null || label[0].length > line.at) return false;
  const value = line.text.slice(label[0].length);
  const after = line.text.slice(line.at).replace(/^\s*-{1,2}\s+/u, "");
  return !SENTENCE_END.test(value) && after.trim().split(/\s+/u).length <= NAME_WORDS;
};

/** What only a machine writes into a line: an address, a setting (exit_code=99), a dotted name (sre.mediawiki.restart). */
const MACHINE_TOKEN = [/https?:\/\//u, /\b\w+=\w/u, /(?<![\w.])[a-z][\w-]*(?:\.[a-z][\w-]*){2,}/u];

/** A Markdown link's address, which the reader does not see: the writer linked it, not pasted it. */
const LINK_TARGET = /\]\([^)\s]*\)/gu;

/** A chat or bot line as logged: the speaker's name in angle brackets first ("<jinxer-wm> FIRING: …"). */
const CHAT_LINE = /^\s*(?:[-*+]\s+)?<[\w-]+>\s/u;

const isMachineLine = (line: Line): boolean => {
  const shown = line.text.replace(LINK_TARGET, "]");
  return CHAT_LINE.test(shown) || MACHINE_TOKEN.some((token) => token.test(shown));
};

/** An HTML tag shown as text (class="usa-link--external"). */
const HTML_TAG = /<\/?[A-Za-z][^<>]*>/gu;

const isInHtmlTag = (line: Line): boolean => [...line.text.matchAll(HTML_TAG)].some((tag) => line.at > tag.index && line.at < tag.index + tag[0].length);

/** Whether the hyphen at `offset` sits in copied text, where it is the source's separator and not the writer's dash. */
export const isInCopiedText = (source: string, offset: number): boolean => {
  const line = lineAround(source, offset);
  return isQuotedLabelPart(line) || REFERENCE_ENTRY.test(line.text) || isFieldName(line) || isMachineLine(line) || isInHtmlTag(line);
};
