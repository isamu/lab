import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { headingKey, repeatedSiblingHeadings } from "../packages/chaff/src/detectors/duplicate-heading.ts";
import { recordLabelOf, recordRhythmMask } from "../packages/chaff/src/detectors/heading-record-rhythm.ts";
import { presetLevels } from "../packages/chaff/src/genre-load.ts";
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
        [1, "Menu"],
        [1, "Soup"],
        [1, "Soup"],
      ]),
      ["Soup@1"],
    );
  });

  it("番号付きの見出しと同じ深さに並べた例は、その番号付きの節の中で比べる（節ごとに数え直す「Example 1」）", () => {
    const notice = [
      "# Record keeping",
      "## 7. Electronic account",
      "### 7.2 Supplies made",
      "Keep a record of each supply.",
      "### Example 1",
      "A shop sells a meal.",
      "### Example 2",
      "A shop sells a drink.",
      "### 7.3 Supplies made by agents",
      "Keep the agent's records too.",
      "### Example 1",
      "An agent sells a ticket.",
    ].join("\n\n");
    assert.deepEqual(findingsOf(`${notice}\n`, en), []);
    assert.deepEqual(
      repeatedIn([
        [2, "3. 記録"],
        [3, "3.1 売上"],
        [3, "例1"],
        [3, "3.2 仕入れ"],
        [3, "例1"],
      ]),
      [],
    );
  });

  it("番号を持つ語（Chapter 2、第2章）の見出しも、同じ深さの見出しを区切る", () => {
    assert.deepEqual(findingsOf("# Guide\n\n## Chapter 1\n\nA.\n\n## Overview\n\nB.\n\n## Chapter 2\n\nC.\n\n## Overview\n\nD.\n", en), []);
    assert.deepEqual(findingsOf("# 手引き\n\n## 第1章　準備\n\nA。\n\n## 概要\n\nB。\n\n## 第2章　実行\n\nC。\n\n## 概要\n\nD。\n"), []);
  });

  it("同じ番号付きの節の中の重複と、番号付きの見出しどうしの重複は言う", () => {
    assert.deepEqual(
      repeatedIn([
        [2, "7. Electronic account"],
        [3, "7.2 Supplies made"],
        [3, "Example 1"],
        [3, "Example 1"],
      ]),
      ["Example 1@2"],
    );
    assert.deepEqual(
      repeatedIn([
        [2, "1. Setup"],
        [2, "Notes"],
        [2, "2. Run"],
        [2, "1. Setup"],
      ]),
      ["1. Setup@0"],
    );
    assert.deepEqual(
      repeatedIn([
        [1, "Guide"],
        [2, "1. Setup"],
        [2, "Notes"],
        [3, "2.1 Inner"],
        [2, "Notes"],
      ]),
      ["Notes@2"],
    );
  });

  it("文書の題（最初の # の見出し）をもう一度掲げた所は言わない", () => {
    const report = [
      "# 社会人受入れの推進方策について（答申）",
      "## 社会人受入れの推進方策について（答申）",
      "### 目次",
      "- はじめに",
      "## 社会人受入れの推進方策について（答申）",
      "### はじめに",
      "本文です。",
    ].join("\n\n");
    assert.deepEqual(findingsOf(`${report}\n`), []);
    assert.deepEqual(findingsOf("# Vegetable Soup\n\nBack to search\n\n# Vegetable Soup\n\nServes four.\n", en), []);
  });

  it("題でない見出しの重複と、# で始まらない文書の最初の見出しの重複は言う", () => {
    assert.deepEqual(findingsOf("# 答申\n\n## 目次\n\n- はじめに\n\n## はじめに\n\nA。\n\n## はじめに\n\nB。\n"), [
      "見出し「はじめに」は、同じ親の下の 7 行目の見出しと同じです",
    ]);
    assert.deepEqual(findingsOf("## 添付一覧\n\nA。\n\n## 添付一覧\n\nB。\n"), ["見出し「添付一覧」は、同じ親の下の 1 行目の見出しと同じです"]);
  });

  it("文学の文書（詩集の同じ題の詩）では止め、ほかのジャンルでは動く", () => {
    assert.equal(presetLevels("literature/poetry")[RULE], "off");
    assert.equal(presetLevels("literature/fiction")[RULE], "off");
    assert.notEqual(presetLevels("business/report")[RULE], "off");
    assert.equal(findingsOf("# 詩集\n\n## 春\n\n花がさく\n\n## 冬\n\n雪がふる\n\n## 春\n\n鳥がなく\n").length, 1);
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

  it("閉じの # と属性を付けた ATX の見出しも、見える言葉で比べる", () => {
    assert.deepEqual(findingsOf("# Guide\n\n## Install ## {#install}\n\nA.\n\n## Install\n\nB.\n", en), [
      'The heading "Install" repeats the one on line 3 under the same parent',
    ]);
  });

  it("句点の無い二行の下線の見出しも、区切り線の上の段落", () => {
    const footer = "発行元\n総務課\n----------\n\n";
    assert.deepEqual(findingsOf(`# お知らせ\n\n本文です。\n\n${footer}次の本文です。\n\n${footer}`), []);
  });

  it("事例ごとに決まった見出しの組をくり返す FAQ は、重複と言わない", () => {
    const faq = [
      "# 相談事例集",
      "## 1. 借入れの相談",
      "### 【相談事例】",
      "返済が苦しいという相談です。",
      "### 【回答】",
      "窓口を紹介しました。",
      "### 【相談事例】",
      "取立てが強いという相談です。",
      "### 【回答】",
      "記録を残すよう伝えました。",
    ].join("\n\n");
    assert.deepEqual(findingsOf(`${faq}\n`), []);
  });

  it("添え書きの違う事例見出しも、同じ型の組のくり返しとして読む", () => {
    assert.deepEqual(
      repeatedIn([
        [2, "1. 契約の相談"],
        [3, "【事例（約款）】"],
        [3, "【回答】"],
        [3, "【事例（解約）】"],
        [3, "【回答】"],
        [3, "【事例（約款）】"],
        [3, "【回答】"],
      ]),
      [],
    );
    assert.deepEqual(
      repeatedIn([
        [2, "Questions"],
        [3, "Question"],
        [3, "Answer"],
        [3, "Question"],
        [3, "Answer"],
      ]),
      [],
    );
  });

  it("組の途中に違う見出しが一つ挟まっても、残りがくり返していれば言わない", () => {
    assert.deepEqual(
      repeatedIn([
        [2, "2. 本人確認"],
        [3, "【事例】"],
        [3, "【回答とお願い】"],
        [3, "【事例】"],
        [3, "【回答】"],
        [3, "【事例】"],
        [3, "【回答】"],
      ]),
      [],
    );
  });

  it("組にならない重複は、括弧の見出しでも言う", () => {
    assert.deepEqual(
      repeatedIn([
        [1, "Changelog"],
        [2, "1.1.0"],
        [3, "Added"],
        [3, "Fixed"],
        [3, "Added"],
      ]),
      ["Added@2"],
    );
    assert.deepEqual(
      repeatedIn([
        [2, "相談"],
        [3, "【事例】"],
        [3, "【事例】"],
        [3, "【回答】"],
      ]),
      ["【事例】@1"],
    );
    assert.deepEqual(
      repeatedIn([
        [2, "手順"],
        [3, "準備"],
        [3, "確認"],
        [3, "片付け"],
        [3, "準備"],
      ]),
      ["準備@1"],
    );
  });

  it("型は括弧の添え書きを除いた言葉。組の中の型はみな違う", () => {
    assert.equal(recordLabelOf("【事例（約款）】"), "【事例】");
    assert.equal(recordLabelOf("examples (draft)"), "examples");
    assert.equal(recordLabelOf("（注）"), "（注）");
    assert.deepEqual(recordRhythmMask(["a", "b", "a", "b"]), [true, true, true, true]);
    assert.deepEqual(recordRhythmMask(["a", "a", "a", "a"]), [false, false, false, false]);
    assert.deepEqual(recordRhythmMask(["a", "b", "a"]), [false, false, false]);
    assert.deepEqual(recordRhythmMask(["x", "a", "b", "c", "a", "b", "c", "y"]), [false, true, true, true, true, true, true, false]);
    assert.deepEqual(recordRhythmMask([]), []);
  });

  it("違う見出しなら何も言わない", () => {
    assert.deepEqual(findingsOf("# 手順書\n\n## 準備\n\n道具をそろえます。\n\n## 安全の確認\n\n手袋をはめます。\n"), []);
    assert.deepEqual(repeatedIn([]), []);
  });

  it("Markdown でない文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "準備\n\n準備\n", ja, "a.txt").skipped, ["Markdown の文書ではないため"]);
  });
});
