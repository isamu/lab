import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { skippedHeadings } from "../packages/chaff/src/detectors/heading-level-skip.ts";
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

  it("テキストの文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "## 準備\n\n#### 細かい話\n", ja, "a.txt"), { findings: [], skipped: ["Markdown の文書ではないため"] });
  });
});
