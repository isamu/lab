import type { Span } from "./plugin.ts";

/** 重なる範囲を 1 つにまとめ、始まりの順に並べる。joinTouching なら、接するだけの範囲（前の end が次の start）もまとめる。 */
export const mergeSpans = (spans: readonly Span[], joinTouching: boolean): Span[] =>
  spans
    .toSorted((left, right) => left.start - right.start)
    .reduce<Span[]>((acc, span) => {
      const last = acc.at(-1);
      if (last !== undefined && (joinTouching ? span.start <= last.end : span.start < last.end))
        acc[acc.length - 1] = { start: last.start, end: Math.max(last.end, span.end) };
      else acc.push(span);
      return acc;
    }, []);
