import type { Lexicon } from "../plugin.ts";
import { holdsWordAt } from "./template-sections.ts";

/** Lexicon group of placeholder-word: a word that opens a line giving an example to copy (Example:, Helpful:, 例：). */
export const EXAMPLE_LEAD = "example-lead";

/** The text of a blank's line before it and after it. */
export type LineAround = { readonly before: string; readonly after: string };

export const lineAround = (source: string, start: number, end: number): LineAround => ({
  before: source.slice(source.lastIndexOf("\n", start - 1) + 1, start),
  after: source.slice(end).split("\n")[0] ?? "",
});

/** A run of underscores is the line a form is signed or filled on; a bracket beside it is the caption of that line. */
const FILL_LINE = "___";
const SPACE_OR_EMPHASIS = /[\s*]/u;

/** text without the spaces and emphasis marks around it. */
const bare = (text: string): string => {
  const chars = [...text];
  const first = chars.findIndex((char) => !SPACE_OR_EMPHASIS.test(char));
  const last = chars.findLastIndex((char) => !SPACE_OR_EMPHASIS.test(char));
  return first < 0 ? "" : chars.slice(first, last + 1).join("");
};

/** The bracket names the blank a form leaves to fill by hand ("________ [Name of New Employer]"). */
export const captionsFillLine = (line: LineAround): boolean => bare(line.before).endsWith(FILL_LINE) || bare(line.after).startsWith(FILL_LINE);

/** A list mark or emphasis before the line's first word. */
const LINE_LEAD = /^\s*(?:[-*+]\s+|\d+[.)]\s+)?[*_]*/u;
const COLONS = /[:：]/u;
const OPENING_QUOTES: ReadonlySet<string> = new Set(["“", '"', "「", "『"]);
const CLOSING_QUOTES = /[”"」』]/u;

/** After the lead: a colon, then a quotation that opens and has not closed yet before the blank. */
const opensQuoteAfterColon = (rest: string): boolean => {
  const colon = rest.search(COLONS);
  if (colon < 0) return false;
  const quoted = rest.slice(colon + 1).trimStart();
  return OPENING_QUOTES.has(quoted.charAt(0)) && !CLOSING_QUOTES.test(quoted.slice(1));
};

/** The blank is inside a quotation a line offers as an example ("Helpful: “See the link [insert link name] …”"). */
export const insideQuotedExample = (line: LineAround, leads: Lexicon): boolean => {
  const text = line.before.slice(LINE_LEAD.exec(line.before)?.[0].length ?? 0);
  const lower = text.toLowerCase();
  const lead = leads.find((word) => lower.startsWith(word.pattern.toLowerCase()) && holdsWordAt(lower, word.pattern.toLowerCase(), 0));
  return lead !== undefined && opensQuoteAfterColon(text.slice(lead.pattern.length));
};

/** A field label of a filing form at the head of a line, and the value written after it on that line (【氏名】 followed by a name). */
const LIST_MARK = /^\s*(?:[-*+]\s+)?/u;
const FIELD_LABEL = /^(?:【[^【】\n]{1,30}】|［[^［］\n]{1,30}］)/u;
const LEADING_SPACES = /^[ \t\u3000]+/u;
const VALUE_START = /^[\p{Script=Han}\p{Script=Katakana}\p{Script=Latin}\p{N}]/u;
const BLANK_MARK_START = /^[○〇◯△]/u;

const isFilledValue = (value: string, blankSuffixes: Lexicon): boolean =>
  VALUE_START.test(value) && !BLANK_MARK_START.test(value) && !blankSuffixes.some((word) => value.startsWith(word.pattern));

/** The label at the head of a line, when a filled value follows it on that line. */
const filledLabelOf = (line: string, blankSuffixes: Lexicon): string[] => {
  const rest = line.replace(LIST_MARK, "");
  const label = FIELD_LABEL.exec(rest)?.[0];
  if (label === undefined) return [];
  return isFilledValue(rest.slice(label.length).replace(LEADING_SPACES, ""), blankSuffixes) ? [label] : [];
};

/** The labels a document fills in somewhere: elsewhere the same 【氏名】 names that field of the form, not a blank. */
export const filledFieldLabels = (source: string, blankSuffixes: Lexicon): ReadonlySet<string> =>
  new Set(source.split("\n").flatMap((line) => filledLabelOf(line, blankSuffixes)));
