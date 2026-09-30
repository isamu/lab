import type { Span } from "./plugin.ts";
import { mergeSpans } from "./span-merge.ts";
import { firstEndingAfter } from "./soft-break.ts";

const piecesOutside = (span: Span, sortedCuts: readonly Span[]): Span[] => {
  const overlapping = sortedCuts
    .slice(firstEndingAfter(sortedCuts, span.start), firstEndingAfter(sortedCuts, span.end) + 1)
    .filter((cut) => cut.start < span.end);
  const { pieces, cursor } = overlapping.reduce<{ pieces: Span[]; cursor: number }>(
    (acc, cut) => ({
      pieces: cut.start > acc.cursor ? [...acc.pieces, { start: acc.cursor, end: cut.start }] : acc.pieces,
      cursor: Math.max(acc.cursor, cut.end),
    }),
    { pieces: [], cursor: span.start },
  );
  return cursor < span.end ? [...pieces, { start: cursor, end: span.end }] : pieces;
};

/** The parts of each span that no cut covers, in order. Cuts may overlap one another and come in any order. */
export const cutSpans = (spans: readonly Span[], cuts: readonly Span[]): Span[] => {
  if (cuts.length === 0) return [...spans];
  const sortedCuts = mergeSpans(cuts, true);
  return spans.flatMap((span) => piecesOutside(span, sortedCuts));
};

/** cutSpans, less the pieces of `source` that hold only white space. */
export const cutTextSpans = (spans: readonly Span[], cuts: readonly Span[], source: string): Span[] =>
  cuts.length === 0 ? [...spans] : cutSpans(spans, cuts).filter((piece) => source.slice(piece.start, piece.end).trim() !== "");
