import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { wellFormed } from "../packages/lang-ja/src/well-formed.ts";
import { morphemes, prepare, tokenize } from "../packages/lang-ja/src/pos.ts";
import { quantities } from "../packages/lang-ja/src/quantities.ts";

// 解析器（kuromoji）は、対になっていないサロゲートを渡すと例外で落ちる。文字列を途中で切ると、絵文字の片割れが残る。

describe("wellFormed: 片割れのサロゲートだけを置き換える", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["", ""],
    ["abc", "abc"],
    ["日本語の文。", "日本語の文。"],
    ["😀", "😀"],
    ["𠮷野家", "𠮷野家"],
    ["👨‍👩‍👧", "👨‍👩‍👧"],
    ["\uD83D", "\uFFFD"],
    ["\uDE00", "\uFFFD"],
    ["a\uD83Db", "a\uFFFDb"],
    ["\uDE00\uD83D", "\uFFFD\uFFFD"],
    ["😀\uD83D", "😀\uFFFD"],
    ["\uD83D😀", "\uFFFD😀"],
    ["\uD83D\uD83D\uDE00", "\uFFFD😀"],
  ];
  cases.forEach(([input, expected]) => {
    it(JSON.stringify(input), () => {
      const result = wellFormed(input);
      assert.equal(result, expected);
      assert.equal(result.length, input.length, "位置がずれないよう、長さは変えない");
    });
  });
});

describe("解析器に片割れのサロゲートが届いても落ちない", () => {
  before(async () => prepare());

  it("数と単位のあいだの空白の後ろを 8 文字だけ読み直すとき、絵文字を半分に切る", () => {
    // 「３ 年」の後ろを読み直す 8 文字が、😀 の上位サロゲートで終わる。
    assert.doesNotThrow(() => quantities("期間は３ 年のうち半分は😀です。"));
  });

  it("tokenize は片割れを含む文を読み、位置を保つ", () => {
    const tokens = tokenize("壊れた\uD83D文字です。") ?? [];
    assert.ok(tokens.length > 0);
    const last = tokens.at(-1);
    assert.equal(last?.surface, "。");
    assert.equal(last?.span.start, 8);
  });

  it("morphemes は片割れを含む文を読む", () => {
    assert.ok((morphemes("\uDE00と3 年") ?? []).length > 0);
  });
});
