import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokensWithin } from "../packages/lang-ja/src/tokens-within.ts";
import type { Span, Token } from "../packages/chaff/src/plugin.ts";

const token = (start: number, end: number): Token => ({ span: { start, end }, surface: "x".repeat(end - start), pos: "NOUN" });

/** 文ごとに全 token を見る書き方。これと同じ答えを返すこと。 */
const naive = (tokens: readonly Token[], span: Span): Token[] => tokens.filter((entry) => entry.span.start >= span.start && entry.span.end <= span.end);

/** 再現できる乱数（mulberry32）。落ちたら seed を出す。 */
const random = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value + 0x6d2b79f5) | 0;
    const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
    const next = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

/** start の昇順に並んだ token。重なり・長さ 0・隙間を混ぜる。 */
const sortedTokens = (next: () => number, count: number): Token[] => {
  const cursor = { at: 0 };
  return Array.from({ length: count }, () => {
    cursor.at += Math.floor(next() * 3);
    const start = cursor.at;
    return token(start, start + Math.floor(next() * 4));
  });
};

describe("tokensWithin: span に収まる token", () => {
  const cases: readonly (readonly [string, readonly Token[], Span, readonly Token[]])[] = [
    ["token が無い", [], { start: 0, end: 10 }, []],
    ["span が空", [token(0, 2)], { start: 5, end: 5 }, []],
    ["全部入る", [token(0, 2), token(2, 4)], { start: 0, end: 4 }, [token(0, 2), token(2, 4)]],
    ["span の外は落とす", [token(0, 2), token(2, 4), token(4, 6)], { start: 2, end: 4 }, [token(2, 4)]],
    ["またぐ token はどちらにも入れない", [token(0, 3), token(3, 5)], { start: 0, end: 2 }, []],
    ["span の終わりにある長さ 0 の token", [token(4, 4)], { start: 0, end: 4 }, [token(4, 4)]],
  ];
  cases.forEach(([label, tokens, span, expected]) => {
    it(label, () => assert.deepEqual(tokensWithin(tokens, span), expected));
  });

  it("文ごとに全部をなめる書き方と、生成した入力で同じ答えを返す", () => {
    const seed = 20260930;
    const next = random(seed);
    const rounds = 2000;
    Array.from({ length: rounds }).forEach((_, round) => {
      const tokens = sortedTokens(next, Math.floor(next() * 40));
      const last = tokens.at(-1)?.span.end ?? 0;
      const start = Math.floor(next() * (last + 3)) - 1;
      const span = { start, end: start + Math.floor(next() * 12) };
      assert.deepEqual(tokensWithin(tokens, span), naive(tokens, span), `seed ${seed}, round ${round}`);
    });
  });
});
