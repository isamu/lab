import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { headingKey, repeatedSiblingHeadings } from "../packages/chaff/src/detectors/duplicate-heading.ts";
import type { MarkupHeading } from "../packages/chaff/src/plugin.ts";

// 兄弟の見出しの重複（duplicate-heading）。例文はすべて自作。

const RULE = "duplicate-heading";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

/** [深さ, 言葉] の並びを見出しにする。位置は並びの順。 */
const headingsOf = (outline: readonly (readonly [number, string])[]): MarkupHeading[] =>
  outline.map(([depth, text], index) => ({ depth, text, start: index * 10, end: index * 10 + 5 }));

const repeatedIn = (outline: readonly (readonly [number, string])[]): string[] =>
  repeatedSiblingHeadings(headingsOf(outline)).map(({ heading, first }) => `${heading.text}@${String(first.start / 10)}`);

describe("duplicate-heading: 同じ見出しが兄弟に二つある", () => {
  it("同じ親の下の同じ見出し。前の見出しの行を添える", () => {
    assert.deepEqual(findingsOf("# 手順書\n\n## 準備\n\n道具をそろえます。\n\n## 準備\n\n手袋をはめます。\n"), [
      "見出し「準備」は、同じ親の下の 3 行目の見出しと同じです",
    ]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("# Guide\n\n## Steps\n\nOne.\n\n## Steps\n\nTwo.\n", en), [
      'The heading "Steps" repeats the one on line 3 under the same parent',
    ]);
  });

  it("親が違えば同じ言葉でもよい（変更履歴の版ごとの Added / Fixed）", () => {
    assert.deepEqual(
      repeatedIn([
        [1, "Changelog"],
        [2, "1.1.0"],
        [3, "Added"],
        [3, "Fixed"],
        [2, "1.0.0"],
        [3, "Added"],
        [3, "Fixed"],
      ]),
      [],
    );
  });

  it("大文字と小文字、全角と半角、空白の数は同じ見出しとして比べる", () => {
    assert.deepEqual(
      repeatedIn([
        [2, "Next  Steps"],
        [2, "next steps"],
        [2, "ＦＡＱ"],
        [2, "FAQ"],
      ]),
      ["next steps@0", "FAQ@2"],
    );
    assert.equal(headingKey(" Ａ  b "), "a b");
  });

  it("深さが飛んでも、親が同じなら兄弟として比べる", () => {
    assert.deepEqual(
      repeatedIn([
        [1, "Guide"],
        [3, "Notes"],
        [2, "Setup"],
        [2, "Notes"],
      ]),
      ["Notes@1"],
    );
  });

  it("文書のいちばん上の見出しどうしも兄弟", () => {
    assert.deepEqual(
      repeatedIn([
        [1, "Soup"],
        [1, "Soup"],
      ]),
      ["Soup@0"],
    );
  });

  it("言葉の無い見出しは比べない", () => {
    assert.deepEqual(
      repeatedIn([
        [2, ""],
        [2, " "],
      ]),
      [],
    );
  });

  it("二行にわたる下線の見出し（メールの区切り線の上の段落）は見出しとして読まない", () => {
    const footer = "※ 本メールは送信専用です。\nご了承ください。\n----------\n\n";
    assert.deepEqual(findingsOf(`# お知らせ\n\n本文です。\n\n${footer}次のお知らせです。\n\n${footer}`), []);
  });

  it("違う見出しなら何も言わない", () => {
    assert.deepEqual(findingsOf("# 手順書\n\n## 準備\n\n道具をそろえます。\n\n## 安全の確認\n\n手袋をはめます。\n"), []);
    assert.deepEqual(repeatedIn([]), []);
  });

  it("Markdown でない文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "準備\n\n準備\n", ja, "a.txt").skipped, ["Markdown の文書ではないため"]);
  });
});
