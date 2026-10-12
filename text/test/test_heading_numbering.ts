import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { numberingMinorities, numberingStyleOf, siblingGroups, type NumberedHeading, type NumberLabel } from "../packages/chaff/src/heading-numbering.ts";

// 見出しの番号の付け方（heading-numbering-mix）。例文はすべて自作。

const mixed = (headings: readonly string[], adapter = ja, path = "a.md"): readonly string[] =>
  namedRuleRun("heading-numbering-mix", ["# 題\n", ...headings.map((heading) => `${heading}\n\n本文。\n`)].join("\n"), adapter, path).findings;

describe("heading-numbering-mix: 兄弟の見出しの番号の付け方", () => {
  it("番号の付いた兄弟の中の、番号の無い見出し", () => {
    assert.deepEqual(mixed(["## 1. 概要", "## 2. 手順", "## まとめ"]), [
      "見出し「まとめ」だけ番号がありません（兄弟の見出しは「1. 概要」など 2 個が番号付き）",
    ]);
  });

  it("番号の無い兄弟の中の、番号の付いた見出し", () => {
    assert.deepEqual(mixed(["## 背景", "## 2. 方針", "## 課題"]), ["見出し「2. 方針」だけ番号があります（兄弟の見出しは「背景」など 2 個が番号なし）"]);
  });

  it("番号の書き方の混ざり（1. と 3）、第1章 と 1.）", () => {
    assert.deepEqual(mixed(["## 1. 背景", "## 2. 方針", "## 3）課題"]), ["見出し「3）課題」の番号の書き方が、兄弟の見出し（「1. 背景」など 2 個）と違います"]);
    assert.equal(mixed(["## 第1章 背景", "## 第2章 方針", "## 3. 課題"]).length, 1);
  });

  it("前後の見出し、二つだけの兄弟、同数、深さの違う見出しは比べない", () => {
    assert.deepEqual(mixed(["## 第1章 背景", "## 第2章 方針", "## 参考文献"]), []);
    assert.deepEqual(mixed(["## 1. 背景", "## 2. 方針", "## 付録: 用語"]), []);
    assert.deepEqual(mixed(["## Background", "## Plan", "## Appendix A"], en), []);
    assert.deepEqual(mixed(["## 1. 概要", "## まとめ"]), []);
    assert.deepEqual(mixed(["## 1. 概要", "## 2. 手順", "## まとめ", "## 補足"]), []);
    assert.deepEqual(mixed(["## 1. 概要", "### 1.1 背景", "### 1.2 目的", "### 補足", "## 2. 手順", "## 3. 結果"]), [
      "見出し「補足」だけ番号がありません（兄弟の見出しは「1.1 背景」など 2 個が番号付き）",
    ]);
  });

  it("番号のすぐ後ろがコードや鉤括弧の見出しも、番号付きと読む", () => {
    assert.deepEqual(mixed(["## 30. API", "### 30.1 ファイルの渡し方", "### 30.2 `check(text, options)`", "### 30.3 バンドラ"]), []);
    assert.deepEqual(mixed(["## 1. `chaff tree`", "## 2. 「概要」の読み方", "## 3. 結果"]), []);
    assert.deepEqual(mixed(["## 背景", "## 2. `check()`", "## 課題"]), [
      "見出し「2. `check()`」だけ番号があります（兄弟の見出しは「背景」など 2 個が番号なし）",
    ]);
    assert.deepEqual(mixed(["## 1. 背景", "## 2. 方針", "## `check()`"]), [
      "見出し「`check()`」だけ番号がありません（兄弟の見出しは「1. 背景」など 2 個が番号付き）",
    ]);
  });

  it("期間や催しを名指す番号（Week 1、Day 2、第1回、第1週）は番号と読まない", () => {
    assert.deepEqual(mixed(["## Week 1", "## Week 2", "## Pay summary"], en), []);
    assert.deepEqual(mixed(["## Day 1: Arrival", "## Day 2: Lakes", "## Day 3: Return", "## Packing list"], en), []);
    assert.deepEqual(mixed(["## Phase 1 Discovery", "## Phase 2 Build", "## Risks"], en), []);
    assert.deepEqual(mixed(["## 第1回 打ち合わせ", "## 第2回 打ち合わせ", "## 今後の予定"]), []);
    assert.deepEqual(mixed(["## 第1週", "## 第2週", "## 賃金の見込み"]), []);
    assert.deepEqual(mixed(["## 1日目 京都", "## 2日目 奈良", "## 持ち物"]), []);
  });

  it("区切りの名前の番号（Chapter、Part、Step、第1章）は番号と読み、期間の名前の隣の番号付きの見出しは言う", () => {
    assert.deepEqual(mixed(["## Part 1 Basics", "## Part 2 Practice", "## Summary"], en), [
      'The heading "Summary" has no number, while 2 of its siblings do ("Part 1 Basics")',
    ]);
    assert.deepEqual(mixed(["## Step 1 Install", "## Step 2 Configure", "## Troubleshooting"], en), [
      'The heading "Troubleshooting" has no number, while 2 of its siblings do ("Step 1 Install")',
    ]);
    assert.deepEqual(mixed(["## 第1章 背景", "## 第2章 方針", "## まとめ"]), [
      "見出し「まとめ」だけ番号がありません（兄弟の見出しは「第1章 背景」など 2 個が番号付き）",
    ]);
    assert.deepEqual(mixed(["## Week 1", "## Week 2", "## 3. Pay summary"], en), [
      'The heading "3. Pay summary" is numbered, while 2 of its siblings are not ("Week 1")',
    ]);
  });

  it("番号でない頭の数（2026年、3つ）は番号と読まない", () => {
    assert.deepEqual(mixed(["## 2026年の計画", "## 3つの理由", "## まとめ"]), []);
  });

  it("English, and a document that is not Markdown", () => {
    assert.deepEqual(mixed(["## Chapter 1 Background", "## Chapter 2 Plan", "## Summary"], en), [
      'The heading "Summary" has no number, while 2 of its siblings do ("Chapter 1 Background")',
    ]);
    assert.deepEqual(mixed(["## Background", "## Plan", "## References"], en), []);
    assert.deepEqual(mixed(["## 1. Overview", "## 2. Steps", "## Summary"], en, "a.txt"), []);
  });
});

describe("numberingStyleOf", () => {
  const labels: readonly NumberLabel[] = [
    { word: "章", position: "after" },
    { word: "Chapter", position: "before" },
    { word: "回", position: "after" },
  ];

  it("reads each style", () => {
    const styles = [
      "1. 概要",
      "1.2 概要",
      "1) 概要",
      "1）概要",
      "(1) 概要",
      "（1）概要",
      "① 概要",
      "一、概要",
      "第1章 概要",
      "2章 概要",
      "Chapter 3: Plan",
      "CHAPTER 4 Plan",
      "II. Plan",
      "A. Plan",
      "2a. Gemini",
      "**1. 概要**",
      "30.2 `check(text, options)`",
      "1. `chaff tree`",
      "2. 「概要」の読み方",
      "3. “Quoted” words",
    ];
    assert.deepEqual(
      styles.map((text) => numberingStyleOf(text, labels)),
      [
        "dot",
        "dotted",
        "close-paren",
        "close-paren",
        "paren",
        "paren",
        "circled",
        "kanji",
        "label:章",
        "label:章",
        "label:chapter",
        "label:chapter",
        "letter",
        "letter",
        "dot",
        "dot",
        "dotted",
        "dot",
        "dot",
        "dot",
      ],
    );
  });

  it("a number that is not a heading number, and the empty string", () => {
    assert.deepEqual(
      [
        "2026年の計画",
        "3つの理由",
        "100 ways",
        "10 reasons",
        "1 Introduction",
        "1.5倍速",
        "8.2.3 (2026-08-06)",
        "一回だけの設定",
        "S. 3853",
        "chapter 2",
        "Chapters",
        "",
        "Apple",
        "3 `reasons`",
        "2026 「計画」",
        "8.2.3 (`beta`)",
      ].map((text) => numberingStyleOf(text, labels)),
      Array<string>(16).fill("none"),
    );
  });
});

describe("siblingGroups and numberingMinorities", () => {
  const heading = (depth: number, style: string, skipped = false): NumberedHeading => ({ depth, style, skipped });

  it("siblings share a parent and a depth", () => {
    assert.deepEqual(siblingGroups([heading(1, "none"), heading(2, "dot"), heading(3, "dot"), heading(2, "dot"), heading(3, "dot")]), [[0], [1, 3], [2], [4]]);
    assert.deepEqual(siblingGroups([]), []);
  });

  it("the minority side, and nothing on a tie or with fewer than three", () => {
    assert.deepEqual(numberingMinorities([heading(2, "dot"), heading(2, "dot"), heading(2, "none")]), [
      { at: 2, kind: "numbered", majority: "numbered", count: 2, example: 0 },
    ]);
    assert.deepEqual(numberingMinorities([heading(2, "dot"), heading(2, "dot"), heading(2, "none"), heading(2, "none")]), []);
    assert.deepEqual(numberingMinorities([heading(2, "dot"), heading(2, "none")]), []);
    assert.deepEqual(numberingMinorities([heading(2, "dot"), heading(2, "dot"), heading(2, "none", true)]), []);
  });

  it("styles are compared among the numbered siblings only", () => {
    assert.deepEqual(numberingMinorities([heading(2, "dot"), heading(2, "dot"), heading(2, "paren"), heading(2, "none")]), [
      { at: 3, kind: "numbered", majority: "numbered", count: 3, example: 0 },
      { at: 2, kind: "style", majority: "dot", count: 2, example: 0 },
    ]);
  });
});
