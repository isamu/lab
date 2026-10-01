import { spansWithin, withoutSpans } from "../soft-break.ts";
import type { Span } from "../plugin.ts";

/**
 * The text of a span as one spelling: what a reader never sees removed (unseen is sorted and does not overlap: a line
 * break that vanishes between two wide characters, the marks of bold), any other run of white space one space,
 * full-width and half-width forms alike.
 */
export const factKey = (text: string, span: Span, unseen: readonly Span[]): string => {
  const inside = spansWithin(unseen, span).map((part) => ({ start: part.start - span.start, end: part.end - span.start }));
  return withoutSpans(text.slice(span.start, span.end), inside).normalize("NFKC").replace(/\s+/gu, " ");
};

/** A text without its unseen parts, and where each of its characters stands in the whole text. */
export type SeenText = { readonly text: string; readonly offsets: readonly number[] };

/** The text as a reader sees it, for finding words that a vanishing line break or bold marks split (日本\n銀行). */
export const seenTextOf = (text: string, unseen: readonly Span[]): SeenText => {
  const kept = [...unseen, { start: text.length, end: text.length }].map((part, index) => ({ start: unseen[index - 1]?.end ?? 0, end: part.start }));
  return {
    text: kept.map((part) => text.slice(part.start, part.end)).join(""),
    offsets: kept.flatMap((part) => Array.from({ length: part.end - part.start }, (_, index) => part.start + index)),
  };
};

/** A span found in the seen text, as a span of the whole text: from its first character to just after its last. */
export const wholeSpanOf = <T extends Span>(seen: SeenText, found: T): T => ({
  ...found,
  start: seen.offsets[found.start] ?? found.start,
  end: (seen.offsets[found.end - 1] ?? found.end - 1) + 1,
});
