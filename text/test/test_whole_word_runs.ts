import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { MAX_WHOLE_WORD_PARTS, wholeWordRuns, type SpannedSurface } from "../packages/chaff/src/whole-word-runs.ts";

// 一語として比べる語を、トークンの並びから見つける。例はすべて自作。

/** Tokens written one after another, with a space before each token whose index is in `gaps`. */
const tokensOf = (surfaces: readonly string[], gaps: ReadonlySet<number> = new Set()): SpannedSurface[] =>
  surfaces.reduce<SpannedSurface[]>((tokens, surface, at) => {
    const start = (tokens.at(-1)?.span.end ?? 0) + (gaps.has(at) ? 1 : 0);
    return [...tokens, { surface, span: { start, end: start + surface.length } }];
  }, []);

const WORDS = new Set(["お客様", "お客さま", "お嬢さま"]);

describe("wholeWordRuns", () => {
  it("一語のままの語も、切られた語も一つの並び", () => {
    assert.deepEqual(wholeWordRuns(tokensOf(["お客様", "の", "声"]), WORDS), [{ first: 0, last: 0, word: "お客様" }]);
    assert.deepEqual(wholeWordRuns(tokensOf(["お客", "さま", "名"]), WORDS), [{ first: 0, last: 1, word: "お客さま" }]);
    assert.deepEqual(wholeWordRuns(tokensOf(["お", "嬢", "さま"]), WORDS), [{ first: 0, last: 2, word: "お嬢さま" }]);
  });

  it("名前の後の さま は語に入らない", () => {
    assert.deepEqual(wholeWordRuns(tokensOf(["山田", "さま"]), WORDS), []);
    assert.deepEqual(wholeWordRuns(tokensOf(["森下", "健一", "様"], new Set([1, 2])), WORDS), []);
  });

  it("間があいた字は一語にしない", () => {
    assert.deepEqual(wholeWordRuns(tokensOf(["お客", "さま"], new Set([1])), WORDS), []);
  });

  it("重ならない: 同じ所から始まるなら長いほう、先に始まる語が勝つ", () => {
    const words = new Set(["お客", "お客さま", "さま名"]);
    assert.deepEqual(wholeWordRuns(tokensOf(["お客", "さま", "名"]), words), [{ first: 0, last: 1, word: "お客さま" }]);
    assert.deepEqual(wholeWordRuns(tokensOf(["さま", "名"]), new Map([["さま名", "g"]])), [{ first: 0, last: 1, word: "さま名" }]);
  });

  it("長すぎる並びは見ない", () => {
    const parts = Array.from({ length: MAX_WHOLE_WORD_PARTS + 1 }, () => "あ");
    assert.deepEqual(wholeWordRuns(tokensOf(parts), new Set([parts.join("")])), []);
  });

  it("空の入力", () => {
    assert.deepEqual(wholeWordRuns([], WORDS), []);
    assert.deepEqual(wholeWordRuns(tokensOf(["お客", "さま"]), new Set()), []);
  });
});
