import type { Span } from "./plugin.ts";

/** ト書きを囲む括弧の組（戯曲の「（」「）」）。 */
export type BracketPair = { readonly open: string; readonly close: string };

type Scan = { readonly at: number; readonly depth: number; readonly openedAt: number; readonly found: readonly Span[] };

const step =
  (pair: BracketPair) =>
  (scan: Scan, char: string): Scan => {
    const at = scan.at + char.length;
    if (char === pair.open) return { ...scan, at, depth: scan.depth + 1, openedAt: scan.depth === 0 ? at : scan.openedAt };
    if (char !== pair.close || scan.depth === 0) return { ...scan, at };
    const found = scan.depth === 1 ? [...scan.found, { start: scan.openedAt, end: scan.at }] : scan.found;
    return { at, depth: scan.depth - 1, openedAt: scan.openedAt, found };
  };

/** text の中の、いちばん外側の括弧の組の中身（括弧は含まない）。閉じない括弧と、開いていない閉じ括弧は数えない。 */
const outermostInsides = (text: string, pair: BracketPair): Span[] => [
  ...[...text].reduce<Scan>(step(pair), { at: 0, depth: 0, openedAt: 0, found: [] }).found,
];

const hasText = (text: string, span: Span): boolean => text.slice(span.start, span.end).trim().length > 0;

/** 中身と中身のあいだ（括弧の外）。括弧の字は含まない。 */
const outsidesOf = (text: string, insides: readonly Span[], pair: BracketPair): Span[] => {
  const starts = [0, ...insides.map((inside) => inside.end + pair.close.length)];
  const ends = [...insides.map((inside) => inside.start - pair.open.length), text.length];
  return starts.map((start, index) => ({ start, end: ends[index] ?? text.length }));
};

/**
 * 戯曲の行を、ト書き（括弧の中）と台詞に分けた片（text の中の位置）。ト書きは台詞の文の一部ではなく、中に句点があれば
 * それ自体が文。括弧の中身を片にして、台詞と別に文に分ける。括弧の字そのものは、どの片にも入れない。字の無い片は返さない。
 */
export const stageDirectionPieces = (text: string, pair: BracketPair): Span[] => {
  const insides = outermostInsides(text, pair);
  return [...outsidesOf(text, insides, pair), ...insides].filter((span) => hasText(text, span)).toSorted((left, right) => left.start - right.start);
};
