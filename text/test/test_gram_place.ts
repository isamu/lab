import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { compacted, placeOf } from "../packages/chaff/src/detectors/gram-place.ts";

// n-gram を数えるときの詰め方と、詰めた文の中の語句を元の文の範囲に戻すこと。

describe("compacted", () => {
  it("word 単位は空白の並びを 1 つにして前後を削る。詰めた文字ごとに元の位置を持つ", () => {
    const result = compacted("  a  b\tc ", "word");
    assert.equal(result.text, "a b c");
    assert.deepEqual(result.offsets, [2, 3, 5, 6, 7]);
  });

  it("char 単位は空白を全部除く", () => {
    const result = compacted("あ い　う", "char");
    assert.equal(result.text, "あいう");
    assert.deepEqual(result.offsets, [0, 2, 4]);
  });

  it("絵文字（UTF-16 で 2 単位）の後ろも元の位置のまま", () => {
    assert.deepEqual(compacted("😀 a", "word").offsets, [0, 2, 3]);
  });
});

describe("placeOf", () => {
  it("詰めた文の中の語句を、元の文の範囲に戻す", () => {
    const source = "The   upcoming fiscal year.";
    assert.deepEqual(placeOf(compacted(source, "word"), "upcoming fiscal"), { start: 6, end: 21 });
    assert.equal(source.slice(6, 21), "upcoming fiscal");
  });

  it("無い語句と空の語句は undefined", () => {
    assert.equal(placeOf(compacted("abc", "word"), "x"), undefined);
    assert.equal(placeOf(compacted("abc", "word"), ""), undefined);
  });
});
