// A quotation that holds a string to be typed as it stands: an e-mail subject (件名に「応募（総務課）」と記載), a file name
// (「【様式】（氏名）」とファイル名を変更), a title (titled “Rates (2026)”). Its brackets are the string's own; the writer cannot
// take them out. Which words around a quotation say so come from the language's literal-quote-cue lexicon. Pure.
import { QUOTATION_MARKS, quotedSpans } from "./quoted-span.ts";
import type { LexiconEntry, Span } from "./plugin.ts";

export type LiteralCues = { readonly before: readonly string[]; readonly after: readonly string[] };

/** The cues of the lexicon: `position: before` stands in front of the quotation (件名に「…」), the rest right after it (「…」と記載). */
export const literalCues = (entries: readonly LexiconEntry[]): LiteralCues => ({
  before: entries.filter((entry) => entry.position === "before").map((entry) => entry.pattern.toLowerCase()),
  after: entries.filter((entry) => entry.position !== "before").map((entry) => entry.pattern.toLowerCase()),
});

/** Spaces allowed between a cue and its quotation; farther than this the cue is not the quotation's. */
const GAP = 8;
const LATIN_LETTER = /[A-Za-z]/u;

/** A cue that begins or ends with a Latin letter is a word: named does not match the end of unnamed. */
const standsBefore = (window: string, cue: string): boolean =>
  window.endsWith(cue) && !(LATIN_LETTER.test(cue.at(0) ?? "") && LATIN_LETTER.test(window.at(-cue.length - 1) ?? ""));

const standsAfter = (window: string, cue: string): boolean =>
  window.startsWith(cue) && !(LATIN_LETTER.test(cue.at(-1) ?? "") && LATIN_LETTER.test(window.at(cue.length) ?? ""));

/** How far from a quotation to read: the longest cue, one letter more to tell a word from part of one, and the gap. */
const reachOf = (cues: LiteralCues): number => Math.max(0, ...[...cues.before, ...cues.after].map((cue) => cue.length)) + 1 + GAP;

/** Only the few characters next to the quotation are read, so a sentence of many quotations stays linear. */
const isLiteral = (text: string, quoted: Span, cues: LiteralCues, reach: number): boolean => {
  const opener = quoted.start - 1;
  const closerEnd = quoted.end + 1;
  const before = text
    .slice(Math.max(0, opener - reach), opener)
    .trimEnd()
    .toLowerCase();
  const after = text
    .slice(closerEnd, closerEnd + reach)
    .trimStart()
    .toLowerCase();
  return cues.before.some((cue) => standsBefore(before, cue)) || cues.after.some((cue) => standsAfter(after, cue));
};

/** The insides of the quotations the cues mark as a literal string, without the quotation marks. Positions count from 0 in `text`. */
export const literalQuoteSpans = (text: string, cues: LiteralCues): Span[] => {
  const reach = reachOf(cues);
  return quotedSpans(text, QUOTATION_MARKS).filter((quoted) => isLiteral(text, quoted, cues, reach));
};

/** The text with each literal quotation's inside blanked to spaces, so a measure of the sentence's own brackets skips it. */
export const withoutLiteralQuotes = (text: string, cues: LiteralCues): string => {
  const units = text.split("");
  literalQuoteSpans(text, cues).forEach((span) => units.fill(" ", span.start, span.end));
  return units.join("");
};
