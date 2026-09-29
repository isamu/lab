import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { blankLongRuns } from "../packages/lang-en/src/long-runs.ts";
import { prepare, tokenize } from "../packages/lang-en/src/pos.ts";

describe("blankLongRuns: 語でない長い並びを空白で覆う", () => {
  const cases: readonly (readonly [string, string, number, string])[] = [
    ["空", "", 3, ""],
    ["limit ちょうどは残す", "abc de", 3, "abc de"],
    ["limit を超えたら覆う", "abcd de", 3, "     de"],
    ["文の途中", "go abcdef now", 3, "go        now"],
    ["いくつあっても", "abcd x efgh", 3, "     x     "],
    ["空白の種類を問わない", "abcd\tefgh\nij", 3, "    \t    \nij"],
    ["サロゲートの対も長さで覆う", "😀😀😀😀 a", 3, "         a"],
  ];
  cases.forEach(([label, input, limit, expected]) => {
    it(label, () => {
      const result = blankLongRuns(input, limit);
      assert.equal(result, expected);
      assert.equal(result.length, input.length);
    });
  });
});

describe("長い並びのある英文を読む", () => {
  before(() => prepare());

  it("長い並びの後ろの語も、本文の位置で返す", () => {
    const text = `See ${"x".repeat(3000)} for the key.`;
    const tokens = tokenize(text) ?? [];
    assert.deepEqual(
      tokens.map((token) => token.surface),
      ["See", "for", "the", "key", "."],
    );
    tokens.forEach((token) => assert.equal(text.slice(token.span.start, token.span.end), token.surface));
  });
});
