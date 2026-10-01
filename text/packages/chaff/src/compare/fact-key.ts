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
