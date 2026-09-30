import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 代替テキストの無い画像（image-alt-text）。例文はすべて自作。

const RULE = "image-alt-text";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

describe("image-alt-text: 代替テキストの無い画像", () => {
  it("空の代替テキストを指摘する", () => {
    assert.deepEqual(findingsOf("売上の図です。\n\n![](figure.png)\n"), ["画像「![](figure.png)」に代替テキストがありません"]);
  });

  it("空白だけの代替テキストも空", () => {
    assert.deepEqual(findingsOf("![  ](figure.png)\n").length, 1);
  });

  it("代替テキストがあれば指摘しない", () => {
    assert.deepEqual(findingsOf("![4月の売上](figure.png)\n"), []);
  });

  it("alt 属性の無い HTML の img を指摘する", () => {
    assert.deepEqual(findingsOf('Logo:\n\n<img src="logo.png" width="40">\n', en), ['Image "<img src="logo.png" width="40">" has no alt text']);
  });

  it('alt="" は飾りと明示したので指摘しない', () => {
    assert.deepEqual(findingsOf('<img src="line.png" alt="">\n\n<img src="logo.png" alt="Logo">\n', en), []);
  });

  it("data-alt は代替テキストではなく、引用符の中の > で img は閉じない", () => {
    assert.deepEqual(findingsOf('<img src="x.png" data-alt="chart">\n\n<img title="2 > 1" alt="" src="y.png">\n', en), [
      'Image "<img src="x.png" data-alt="chart">" has no alt text',
    ]);
  });

  it("段落の中の img も読む", () => {
    assert.deepEqual(findingsOf('See <img src="a.png"> here.\n', en).length, 1);
  });

  it("参照の形の画像も読む", () => {
    assert.deepEqual(findingsOf("![][fig]\n\n[fig]: figure.png\n").length, 1);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf('```md\n![](figure.png)\n```\n\n`<img src="a.png">`\n'), []);
  });
});
