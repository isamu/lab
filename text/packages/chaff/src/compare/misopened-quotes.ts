import type { Span } from "../plugin.ts";

/**
 * A quotation opened with the closing mark: ”Visit the page.” A converter or a keyboard writes ” for both ends, and
 * the reader still sees a quotation. The opening ” stands after a space, an opening bracket or a dash, before a
 * character that is not a space; the closing ” stands after one, before no letter or digit. An inch mark (a 5” screen)
 * follows a digit, so it opens nothing.
 */
const MISOPENED = /(?<![^\s([{—–:;])”(?=[^\s“”])([^“”\n]*?\S)”(?![\p{L}\p{N}])/gu;

const overlaps = (span: Span, others: readonly Span[]): boolean => others.some((other) => span.start < other.end && other.start < span.end);

/** An inside with its two marks. */
const withMarks = (inner: Span): Span => ({ start: inner.start - 1, end: inner.end + 1 });

/**
 * The insides of the quotations opened with ” in text, as quotedSpans gives them: without the marks, offsets from the
 * start of text. A quotation already read (taken, insides too) is not read again.
 */
export const misopenedQuotes = (text: string, taken: readonly Span[]): Span[] => {
  const read = taken.map(withMarks);
  return [...text.matchAll(MISOPENED)].flatMap((match) => {
    const inner = { start: match.index + 1, end: match.index + match[0].length - 1 };
    return overlaps(withMarks(inner), read) ? [] : [inner];
  });
};
