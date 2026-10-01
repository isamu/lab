import type { Span } from "../plugin.ts";
import { firstEndingAfter } from "../soft-break.ts";
import { mergeSpans } from "../span-merge.ts";

/** Spans made ready for lookups: sorted and merged, so each lookup is a binary search, not a scan of every span. */
export type SpanIndex = readonly Span[];

export const spanIndex = (spans: readonly Span[]): SpanIndex => mergeSpans(spans, false);

/** Whether span shares at least one character with a span in the index. */
export const overlapsAny = (index: SpanIndex, span: Span): boolean => {
  const region = index[firstEndingAfter(index, span.start)];
  return region !== undefined && region.start < span.end;
};

/** Whether the character at offset is inside a span in the index. */
export const coversOffset = (index: SpanIndex, offset: number): boolean => overlapsAny(index, { start: offset, end: offset + 1 });
