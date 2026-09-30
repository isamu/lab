import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mergeSpans } from "../packages/chaff/src/span-merge.ts";
import type { Span } from "../packages/chaff/src/plugin.ts";

const span = (start: number, end: number): Span => ({ start, end });

/** 範囲が覆う位置の集まり。 */
const covered = (spans: readonly Span[]): Set<number> => new Set(spans.flatMap(({ start, end }) => Array.from({ length: end - start }, (_, at) => start + at)));

/** 並んでいて、重ならない（joinTouching なら接しもしない）。 */
const isApart = (merged: readonly Span[], joinTouching: boolean): boolean =>
  merged.slice(1).every((current, at) => {
    const previous = merged[at];
    return previous !== undefined && (joinTouching ? previous.end < current.start : previous.end <= current.start);
  });

const LCG_MULTIPLIER = 1664525;
const LCG_INCREMENT = 1013904223;
const LCG_MODULUS = 2 ** 32;
const SEED = 20260930;
const CASES = 2000;

/** 種を決めた擬似乱数で作る範囲の組。落ちたら、その組を上の表に足す。 */
const generatedSpanSets = (): Span[][] => {
  const state = { value: SEED };
  const draw = (below: number): number => {
    state.value = (state.value * LCG_MULTIPLIER + LCG_INCREMENT) % LCG_MODULUS;
    return Math.floor((state.value / LCG_MODULUS) * below);
  };
  const oneSpan = (): Span => {
    const start = draw(12);
    return span(start, start + draw(5));
  };
  return Array.from({ length: CASES }, () => Array.from({ length: draw(7) }, oneSpan));
};

describe("mergeSpans", () => {
  it("重なる範囲は 1 つにまとめ、始まりの順に並べる", () => {
    assert.deepEqual(mergeSpans([span(5, 9), span(0, 3), span(2, 6)], false), [span(0, 9)]);
    assert.deepEqual(mergeSpans([span(0, 10), span(2, 4)], false), [span(0, 10)]);
  });

  it("接するだけの範囲は、joinTouching のときだけまとめる", () => {
    assert.deepEqual(mergeSpans([span(0, 3), span(3, 5)], false), [span(0, 3), span(3, 5)]);
    assert.deepEqual(mergeSpans([span(0, 3), span(3, 5)], true), [span(0, 5)]);
  });

  it("離れた範囲はそのまま", () => {
    assert.deepEqual(mergeSpans([span(4, 6), span(0, 2)], true), [span(0, 2), span(4, 6)]);
  });

  it("空、1 つ、長さ 0、同じ範囲", () => {
    assert.deepEqual(mergeSpans([], true), []);
    assert.deepEqual(mergeSpans([span(1, 2)], false), [span(1, 2)]);
    assert.deepEqual(mergeSpans([span(2, 2), span(2, 2)], false), [span(2, 2), span(2, 2)]);
    assert.deepEqual(mergeSpans([span(2, 2), span(2, 2)], true), [span(2, 2)]);
    assert.deepEqual(mergeSpans([span(1, 4), span(1, 4)], false), [span(1, 4)]);
  });

  it("渡した配列を変えない", () => {
    const spans = [span(3, 5), span(0, 4)];
    mergeSpans(spans, true);
    assert.deepEqual(spans, [span(3, 5), span(0, 4)]);
  });

  it("どんな範囲の組でも、覆う位置は変わらず、結果は並んで離れている", () => {
    generatedSpanSets().forEach((spans) => {
      [true, false].forEach((joinTouching) => {
        const merged = mergeSpans(spans, joinTouching);
        assert.deepEqual(covered(merged), covered(spans), JSON.stringify(spans));
        assert.ok(isApart(merged, joinTouching), JSON.stringify(spans));
      });
    });
  });
});
