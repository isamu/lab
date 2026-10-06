import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isRunInLabel } from "../packages/chaff/src/detectors/run-in-label.ts";

// 項目や段落の頭の太字の札（**速く書ける。** 説明…）。例文はすべて自作。

/** source の中の sentence を文の範囲として、札かどうか。 */
const labelled = (source: string, sentence: string): boolean => {
  const start = source.indexOf(sentence);
  assert.ok(start >= 0, `${sentence} is not in ${source}`);
  return isRunInLabel(source, { start, end: start + sentence.length });
};

describe("isRunInLabel: 行の頭の太字の札", () => {
  it("箇条の項目と段落の頭の、太字だけの文で、同じ行に続きがある", () => {
    assert.equal(labelled("- **速く書ける。** 細かな文法を覚えなくても書けます。", "速く書ける。"), true);
    assert.equal(labelled("* __速く書ける。__ 説明です。", "速く書ける。"), true);
    assert.equal(labelled("1. **速く書ける。**説明です。", "速く書ける。"), true);
    assert.equal(labelled("- [x] **済んだ。** 説明です。", "済んだ。"), true);
    assert.equal(labelled("> - **速く書ける。** 説明です。", "速く書ける。"), true);
    assert.equal(labelled("**結論。** 来月から始めます。", "結論。"), true);
    assert.equal(labelled("前の行\n  - **速く書ける**。 説明です。", "速く書ける**。"), true);
  });

  it("太字だけの行、行の途中の太字、途中で閉じる太字、太字でない文は札ではない", () => {
    assert.equal(labelled("- **注意してください。**", "注意してください。"), false);
    assert.equal(labelled("- **注意してください。**\n次の行です。", "注意してください。"), false);
    assert.equal(labelled("- 先に **速く書ける。** 説明です。", "速く書ける。"), false);
    assert.equal(labelled("- **速く** 書ける。 説明です。", "書ける。"), false);
    assert.equal(labelled("- **a** と **b。** 説明です。", "a** と **b。"), false);
    assert.equal(labelled("- 速く書ける。 説明です。", "速く書ける。"), false);
    assert.equal(labelled("- **速く書ける。 説明です。", "速く書ける。"), false);
    assert.equal(labelled("", ""), false);
  });

  it("折り返した段落の続きの行の頭は、段落の頭ではない。空の行と見出しの後ろは頭", () => {
    assert.equal(labelled("- 前の文です。\n  **注意する。** 確認してください。", "注意する。"), false);
    assert.equal(labelled("前の文です。\n**注意する。** 確認してください。", "注意する。"), false);
    assert.equal(labelled("前の文です。\n\n**注意する。** 確認してください。", "注意する。"), true);
    assert.equal(labelled("## 見出し\n**注意する。** 確認してください。", "注意する。"), true);
    assert.equal(labelled("> 前の文です。\n>\n> **注意する。** 確認してください。", "注意する。"), true);
  });
});

describe("no-mixed-desumasu: 太字の札は文として数えない", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const findingsOf = (source: string): readonly string[] => namedRuleRun("no-mixed-desumasu", source, ja, "a.md").findings;

  it("札が言い切り、説明が ですます の項目がそろった箇条書きは揃っている", () => {
    const list = [
      "## 利点",
      "",
      "- **速く書ける。** 決まった形をつなげるだけなので、細かな文法を覚えなくても書けます。",
      "- **間違いに気づける。** 型と組み合わせると、無い名前を打った瞬間にエディタが知らせてくれます。",
      "- **違いを吸収してくれる。** どの環境でも、ほぼ同じ書き方が通じることが多いです。",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(list), []);
  });

  it("説明の中の混ざりは、札を除いても指す", () => {
    const list = [
      "- **速く書ける。** 細かな文法を覚えなくても書けます。形をつなげるだけです。",
      "- **間違いに気づける。** エディタが知らせてくれます。型と組み合わせます。",
      "- **違いを吸収する。** ほぼ同じ書き方が通じます。どの環境でも動く。",
      "",
    ].join("\n");
    assert.equal(findingsOf(list).length, 1);
  });
});
