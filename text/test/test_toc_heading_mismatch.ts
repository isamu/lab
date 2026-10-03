import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { strayTocEntries } from "../packages/chaff/src/detectors/toc-heading.ts";

// 見出しの無い目次の項目（toc-heading-mismatch）。例文はすべて自作。

const RULE = "toc-heading-mismatch";
const TOC_WORDS = ["目次", "Table of Contents", "Contents"];

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const strayIn = (source: string): string[] => strayTocEntries(source, TOC_WORDS).map((stray) => stray.entry);

const DOC_JA = "## 目次\n\n- 1 概要\n- 2 費用\n- 3 日程\n\n## 1 概要\n\n本書の概要です。\n\n## 2 料金\n\n料金の説明です。\n\n## 3 日程\n\n日程の説明です。\n";

describe("toc-heading-mismatch: 見出しの無い目次の項目", () => {
  it("どの見出しとも合わない目次の項目を言う", () => {
    assert.deepEqual(findingsOf(DOC_JA), ["目次の「2 費用」に合う見出しがありません"]);
    assert.deepEqual(
      findingsOf("## Contents\n\n- 1 Overview\n- 2 Costs\n- 3 Schedule\n\n## 1 Overview\n\nText.\n\n## 2 Fees\n\nText.\n\n## 3 Schedule\n\nText.\n", en),
      ['No heading matches the contents entry "2 Costs"'],
    );
  });

  it("空白・記号・大文字小文字、頭の番号、ページ番号、リンクを外して比べる", () => {
    const source = [
      "# Guide",
      "## Table of Contents",
      "- [Data Types](#data-types)",
      "  - 1.1 背景 ........ 3",
      "- 2-1個人情報（法第2条関係）",
      "- Overview",
      "- ４「勧告」等の考え方",
      "## 4　「勧告」等の考え方",
      "## Data types",
      "### 1.1　背景",
      "### 2-1　個人情報（法第2条関係）",
      "## 1 Overview {#overview}",
    ].join("\n");
    assert.deepEqual(strayIn(source), []);
  });

  it("番号の後ろのリンク、第N章、全角のページ番号、字下げした見出しも読む", () => {
    const source = "## 目次\n\n- 1. [Overview](#overview)\n- 第1章 概要\n- 使い方……３\n- API\n\n   ## Overview\n## 概要\n## 使い方\n## API\n";
    assert.deepEqual(strayIn(source), []);
  });

  it("リンクの項目は字の所を指す", () => {
    const source = "## Contents\n\n- [Costs](#costs)\n- Usage\n- API\n\n## Fees\n## Usage\n## API\n";
    const [stray] = strayTocEntries(source, TOC_WORDS);
    assert.equal(stray?.entry, "Costs");
    assert.equal(source.slice(stray?.offset ?? 0, (stray?.offset ?? 0) + "Costs".length), "Costs");
  });

  it("目次の項目の半分より多くが合わなければ、別の章立ての目次と読んで言わない", () => {
    assert.deepEqual(strayIn("## 目次\n\n- 甲\n- 乙\n- 丙\n\n## 甲\n\n## 丁\n"), []);
  });

  it("目次の見出しの無い文書と、項目の無い目次は言わない", () => {
    assert.deepEqual(strayIn("## 概要\n\n- 費用\n\n## 料金\n"), []);
    assert.deepEqual(strayIn("## Contents\n\nThis article is for students.\n\n## Why\n"), []);
  });

  it("コードの囲みの中の見出しと項目は読まない", () => {
    assert.deepEqual(strayIn("## 目次\n\n- 概要\n- 料金\n\n## 概要\n\n```\n## 料金\n```\n\n## 料金\n"), []);
    assert.deepEqual(strayIn("```\n## 目次\n- 無い節\n```\n\n## 概要\n"), []);
  });

  it("空の文字列と目次の語の無い言語", () => {
    assert.deepEqual(strayTocEntries("", TOC_WORDS), []);
    assert.deepEqual(strayTocEntries(DOC_JA, []), []);
  });
});
