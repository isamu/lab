import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { anchorKey } from "../packages/chaff/src/detectors/broken-link.ts";

// 行き先の無いリンク（broken-link）。例文はすべて自作。

const RULE = "broken-link";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

describe("broken-link: 行き先の無いリンク", () => {
  it("行き先が空のリンク", () => {
    assert.deepEqual(findingsOf("[資料]()を見てください。\n"), ["リンク「[資料]()」の行き先が空です"]);
  });

  it("無い見出しを指すリンク", () => {
    assert.deepEqual(findingsOf("## 準備\n\n[手順](#手順)を読んでください。\n"), ["リンク「[手順](#手順)」が指す「#手順」の見出しがこの文書にありません"]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("## Setup\n\nSee [install](#install).\n", en), [
      'The link "[install](#install)" points to "#install", which is not a heading on this page',
    ]);
  });

  it("ある見出しを指すリンクは、名前の作り方の違いを問わない", () => {
    const source = [
      "## Getting Started",
      "## 手順の概要",
      "## M&IE and use of the card",
      "## Setup",
      "## Setup",
      "",
      "[a](#getting-started) [b](#Getting_Started) [c](#手順の概要) [d](#%E6%89%8B%E9%A0%86%E3%81%AE%E6%A6%82%E8%A6%81) [e](#m-and-ie-and-use-of-the-card) [f](#setup-1)",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(source, en), []);
  });

  it("書き手が付けた名前（{#id}、MDX のコメント、HTML の id と name）を指すリンク", () => {
    const source = '## 準備 {#prep}\n\n## 設定 {/*config*/}\n\n<a id="faq"></a>\n\n<a name="old"></a>\n\n[a](#prep) [b](#config) [c](#faq) [d](#old)\n';
    assert.deepEqual(findingsOf(source), []);
  });

  it("-1、-2 の付いた名前は、同じ見出しがその数だけあるときだけ行き先がある", () => {
    const source = "## Setup\n\n## Setup\n\n## Step 3\n\n[a](#setup-1) [b](#setup-2) [c](#step-3)\n";
    assert.deepEqual(findingsOf(source, en), ['The link "[b](#setup-2)" points to "#setup-2", which is not a heading on this page']);
  });

  it("-1 は見出しだけに付く。同じ名前の id は数えない", () => {
    assert.deepEqual(findingsOf('## Setup\n\n<a id="setup"></a>\n\n[bad](#setup-1)\n', en).length, 1);
  });

  it("id の文字参照は字に戻して比べる", () => {
    assert.deepEqual(findingsOf('<a id="a&amp;b"></a>\n\n[x](#a%26b)\n', en), []);
  });

  it("テンプレートの記法の中のリンクは読まない", () => {
    assert.deepEqual(findingsOf("Text {{ [x](#missing) }} here.\n", en), []);
    assert.deepEqual(findingsOf("Text [x](#missing) here.\n", en).length, 1);
  });

  it("書き手が付けた id は書いたとおりに比べる（見出しと違い、記号を畳まない）", () => {
    assert.deepEqual(findingsOf('<a id="foo-bar"></a>\n\n[ok](#foo-bar) [broken](#foobar)\n', en), [
      'The link "[broken](#foobar)" points to "#foobar", which is not a heading on this page',
    ]);
  });

  it("data-id は名前ではない", () => {
    assert.deepEqual(findingsOf('<div data-id="faq"></div>\n\n[FAQ](#faq)\n', en).length, 1);
  });

  it("ページの先頭（#、#top）は見出しが無くても行き先がある", () => {
    assert.deepEqual(findingsOf("本文です。\n\n[戻る](#) [先頭](#top)\n"), []);
  });

  it("定義の無い参照の形", () => {
    assert.deepEqual(findingsOf("詳しくは[報告書][report]を見てください。\n"), [
      "「[報告書][report]」は参照の形ですが、名前の定義がありません（字のまま表示されます）",
    ]);
  });

  it("画像の参照の形は、頭の ! から指摘する", () => {
    assert.deepEqual(findingsOf("See ![alt][missing].\n", en), ['"![alt][missing]" is a reference-style link with no definition (it shows as plain text)']);
  });

  it("名前を省いた参照の形（[text][]）も、定義が無ければ指摘する", () => {
    assert.deepEqual(findingsOf("See [the report][] first.\n", en).length, 1);
  });

  it("定義のある参照はリンクなので指摘しない（大文字小文字と空白の違いは問わない）", () => {
    assert.deepEqual(findingsOf("See [the report][Annual  Report].\n\n[annual report]: https://example.com/\n", en), []);
  });

  it("数だけの括弧は文献の番号、英数字に続く括弧は添字", () => {
    assert.deepEqual(findingsOf("Earlier work [1][2] used A[i][j] and B[0][1].\n", en), []);
  });

  it("逃がした括弧とコードの中は読まない", () => {
    assert.deepEqual(findingsOf("\\[a\\][b] と `[a][b]` と\n\n```\n[x]()\n```\n"), []);
  });

  it("定義の行き先が無い見出しを指すときも指摘する", () => {
    assert.deepEqual(findingsOf("## 準備\n\n[目次][toc]\n\n[toc]: #目次\n").length, 1);
  });

  it("同じ名前の定義は先のものが使われる", () => {
    assert.deepEqual(findingsOf("[x][ref]\n\n[ref]: #ok\n[ref]: #missing\n\n## ok\n", en), []);
  });

  it("使われていない定義は、押されるリンクではないので見ない", () => {
    assert.deepEqual(findingsOf("本文です。\n\n[unused]: #missing\n"), []);
  });

  it("テキストの文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "[資料]()\n", ja, "a.txt").skipped, ["Markdown の文書ではないため"]);
  });
});

describe("見出しの名前をそろえる", () => {
  it("見出しの名前は字と数字だけを小文字で比べる", () => {
    assert.equal(anchorKey("Getting-Started_2!"), "gettingstarted2");
    assert.equal(anchorKey("手順の概要"), "手順の概要");
    assert.equal(anchorKey(""), "");
  });
});
