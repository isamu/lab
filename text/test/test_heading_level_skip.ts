import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { outlineHeadings, skippedHeadings } from "../packages/chaff/src/detectors/heading-level-skip.ts";
import type { MarkupHeading } from "../packages/chaff/src/plugin.ts";

// 見出しの深さの飛び（heading-level-skip）。例文はすべて自作。

const heading = (depth: number, text = "h"): MarkupHeading => ({ depth, text, start: 0, end: 0 });

const RULE = "heading-level-skip";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

describe("heading-level-skip: 見出しの深さの飛び", () => {
  it("## の次の #### を指摘する", () => {
    assert.deepEqual(findingsOf("# 表題\n\n## 準備\n\n本文です。\n\n#### 細かい話\n\n本文です。\n"), [
      "見出し「細かい話」の深さが 2 から 4 へ飛んでいます（3 のはず）",
    ]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("# Title\n\n## Setup\n\nText here.\n\n#### Details\n\nText here.\n", en), [
      'Heading "Details" goes from level 2 to level 4 (expected 3)',
    ]);
  });

  it("一段ずつ深くなる見出しと、浅くなる見出しは指摘しない", () => {
    assert.deepEqual(findingsOf("# 表題\n\n## 一\n\n### 二\n\n#### 三\n\n# 次\n\n## 四\n"), []);
  });

  it("最初の見出しは何段から始めてもよい", () => {
    assert.deepEqual(findingsOf("### 始まり\n\n本文です。\n\n#### 続き\n"), []);
  });

  it("飛んだ後は、飛んだ先の深さを基準にする", () => {
    assert.deepEqual(
      skippedHeadings([heading(2), heading(4), heading(4), heading(5), heading(2)]).map((skip) => `${String(skip.from)}->${String(skip.heading.depth)}`),
      ["2->4"],
    );
  });

  it("見出しが無ければ何も言わない", () => {
    assert.deepEqual(skippedHeadings([]), []);
  });

  it("setext の見出しも深さで数える", () => {
    assert.deepEqual(findingsOf("表題\n====\n\n### 細かい話\n"), ["見出し「細かい話」の深さが 1 から 3 へ飛んでいます（2 のはず）"]);
  });

  it("コードの中の # は見出しではない", () => {
    assert.deepEqual(findingsOf("## 準備\n\n```sh\n#### 見出しではない\n```\n"), []);
  });

  it("文字の無い見出し（プレスリリースの終わりの印「###」）は見出しとして数えない", () => {
    assert.deepEqual(findingsOf("# New app launched\n\nThe app is out today.\n\n**Media contact:** Jane Doe\n\n###\n", en), []);
    assert.deepEqual(findingsOf("# 表題\n\n本文です。\n\n###\n\n#### 細かい話\n"), ["見出し「細かい話」の深さが 1 から 4 へ飛んでいます（2 のはず）"]);
  });

  const paper = [
    "# A study of things",
    "###### Abstract",
    "We study things.",
    "## 1 Introduction",
    "### 1.1 Contributions",
    "## 2 Related work",
    "#### Prior surveys.",
    "Run-in paragraph heading.",
    "#### Field studies.",
    "## 3 Method",
    "### 3.1 Data",
    "##### On statistics.",
    "## Appendix A",
    "#### Corpus",
  ].join("\n\n");

  it("節番号が入れ子の文書では、一番深い番号より深い番号無しの見出し（段落の頭の小見出し）を比べない", () => {
    assert.deepEqual(findingsOf(paper, en), []);
  });

  it("節番号の付いた見出しの飛びは、番号のある文書でも指摘する", () => {
    assert.deepEqual(findingsOf("# A study\n\n### 1 Introduction\n\n### 2 Method\n\n#### 2.1 Data\n\n###### Note\n", en), [
      'Heading "1 Introduction" goes from level 1 to level 3 (expected 2)',
    ]);
  });

  it("番号の段より浅いところで飛ぶ見出しは、番号の無い見出しでも指摘する", () => {
    assert.deepEqual(findingsOf("# 表題\n\n### 前書き\n\n#### 1. 目的\n\n#### 2. 範囲\n\n#### 2.1 対象\n"), [
      "見出し「前書き」の深さが 1 から 3 へ飛んでいます（2 のはず）",
    ]);
  });

  it("番号が一段だけの文書では、番号無しの深い見出しも指摘する", () => {
    assert.deepEqual(findingsOf("# 手順書\n\n## 1. 準備\n\n#### 注意\n\n## 2. 作業\n\n## 3. 片付け\n"), [
      "見出し「注意」の深さが 2 から 4 へ飛んでいます（3 のはず）",
    ]);
  });

  it("版番号が並ぶだけの変更履歴は節番号の入れ子ではなく、飛びを指摘する", () => {
    assert.deepEqual(
      findingsOf(
        "# Changelog\n\n## 1.2.0 (2021-03-01)\n\n### Features\n\n## 1.1.0 (2021-02-01)\n\n### Bug Fixes\n\n# 1.0.0 (2021-01-07)\n\n### Features\n",
        en,
      ),
      ['Heading "Features" goes from level 1 to level 3 (expected 2)'],
    );
  });

  it("番号の付いた見出しが少なければ、番号の段で見出しを外さない", () => {
    assert.deepEqual(
      outlineHeadings([heading(1, "Title"), heading(2, "1 Intro"), heading(3, "1.1 Scope"), heading(5, "Note")]).map((kept) => kept.text),
      ["Title", "1 Intro", "1.1 Scope", "Note"],
    );
  });

  it("テキストの文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "## 準備\n\n#### 細かい話\n", ja, "a.txt"), { findings: [], skipped: ["Markdown の文書ではないため"] });
  });
});
