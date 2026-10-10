import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { tokenReadingOf } from "../packages/chaff/src/name-char-reading.ts";

// 解析器が読めない名前の字の読み（name-char-reading）。例はすべて自作。

const chars = new Map([
  ["汰", "タ"],
  ["莉", "リ"],
]);

describe("tokenReadingOf: 名前の語の読み", () => {
  it("解析器の読みがあれば、それを使う", () => {
    assert.equal(tokenReadingOf({ surface: "健", reading: "ケン" }, chars), "ケン");
    assert.equal(tokenReadingOf({ surface: "汰", reading: "タイ" }, chars), "タイ");
  });

  it("読みが無いか空なら、語彙表の字の読みをつなぐ", () => {
    assert.equal(tokenReadingOf({ surface: "汰", reading: undefined }, chars), "タ");
    assert.equal(tokenReadingOf({ surface: "汰", reading: "" }, chars), "タ");
    assert.equal(tokenReadingOf({ surface: "莉汰" }, chars), "リタ");
  });

  it("一字でも語彙表に無ければ、読まない", () => {
    assert.equal(tokenReadingOf({ surface: "颯" }, chars), undefined);
    assert.equal(tokenReadingOf({ surface: "颯汰" }, chars), undefined);
    assert.equal(tokenReadingOf({ surface: "" }, chars), undefined);
    assert.equal(tokenReadingOf({ surface: "汰" }, new Map()), undefined);
  });
});
