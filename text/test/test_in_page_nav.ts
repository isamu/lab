import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromMarkdown } from "mdast-util-from-markdown";
import { isInPageNavigation, type InlineNode } from "../packages/chaff/src/in-page-nav.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 同じページの中へのリンクと記号だけの段落は、ページの案内であって本文ではない。

const firstParagraph = (markdown: string): InlineNode => {
  const found: InlineNode[] = [];
  const visit = (node: InlineNode): void => {
    if (node.type === "paragraph") found.push(node);
    (node.children ?? []).forEach(visit);
  };
  visit(fromMarkdown(markdown));
  const paragraph = found[0];
  assert.ok(paragraph !== undefined, `段落が無い: ${markdown}`);
  return paragraph;
};

const isNav = (markdown: string): boolean => isInPageNavigation(firstParagraph(markdown));

describe("isInPageNavigation: ページの案内", () => {
  it("ページ内リンクだけの段落", () => {
    assert.equal(isNav("[▲ 目次に戻る](#目次)"), true);
    assert.equal(isNav("[Back to top](#top)"), true);
    assert.equal(isNav("[top](#)"), true);
    assert.equal(isNav("[](#a)"), true);
  });

  it("記号で飾った・区切ったページ内リンク", () => {
    assert.equal(isNav("▲ [目次に戻る](#目次)"), true);
    assert.equal(isNav("↑ [Back to top](#top)"), true);
    assert.equal(isNav("[前へ](#a) | [次へ](#b)"), true);
    assert.equal(isNav("[前へ](#a) ・ [次へ](#b)"), true);
    assert.equal(isNav("^ [top](#top) ^"), true);
    assert.equal(isNav("([目次](#目次))"), true);
  });

  it("改行や強調で包んでも案内のまま", () => {
    assert.equal(isNav("[一](#a)\n[二](#b)"), true);
    assert.equal(isNav("[一](#a)  \n[二](#b)"), true);
    assert.equal(isNav("**[目次に戻る](#目次)**"), true);
    assert.equal(isNav("*[top](#top)* | ~~[old](#old)~~"), true);
  });
});

describe("isInPageNavigation: 本文として残すもの", () => {
  it("リンクと言葉が並ぶ段落", () => {
    assert.equal(isNav("詳しくは[第3章](#第3章)を参照"), false);
    assert.equal(isNav("See [the summary](#summary)."), false);
    assert.equal(isNav("[目次](#目次) 1"), false);
    assert.equal(isNav("**注意** [目次](#目次)"), false);
    assert.equal(isNav("**注意 [目次](#目次)**"), false);
  });

  it("他のページへのリンク", () => {
    assert.equal(isNav("[手順](./procedure.md)"), false);
    assert.equal(isNav("[Home](https://example.com/#top)"), false);
    assert.equal(isNav("[a](#a) | [b](other.md#b)"), false);
    assert.equal(isNav("[目次][toc]\n\n[toc]: #目次"), false);
  });

  it("リンクの無い段落・記号だけの段落・インラインコード・画像", () => {
    assert.equal(isNav("▲ ↑ |"), false);
    assert.equal(isNav("ふつうの文です。"), false);
    assert.equal(isNav("`#top` [top](#top)"), false);
    assert.equal(isNav("![図](#fig) [top](#top)"), false);
  });

  it("段落でない節・子の無い節", () => {
    assert.equal(isInPageNavigation({ type: "heading", children: [{ type: "link", url: "#a" }] }), false);
    assert.equal(isInPageNavigation({ type: "listItem", children: [{ type: "link", url: "#a" }] }), false);
    assert.equal(isInPageNavigation({ type: "paragraph" }), false);
    assert.equal(isInPageNavigation({ type: "paragraph", children: [] }), false);
    assert.equal(isInPageNavigation({ type: "paragraph", children: [{ type: "link" }] }), false);
    assert.equal(isInPageNavigation({ type: "paragraph", children: [{ type: "text" }, { type: "link", url: "#a" }] }), true);
  });
});

// リンクの記号は空白で覆われるので、比べる前に空白を詰める。
const texts = (source: string, adapter = ja): string[] =>
  buildDocument("t.md", source, adapter).sentences.map((sentence) => sentence.text.trim().replace(/\s+/gu, adapter === ja ? "" : " "));

describe("ProseDocument: ページの案内を本文として数えない", () => {
  it("節ごとの「目次に戻る」は文にならない", () => {
    const source = ["## 一", "", "一つ目の節の文。", "", "[▲ 目次に戻る](#目次)", "", "## 二", "", "二つ目の節の文。", "", "[▲ 目次に戻る](#目次)"].join("\n");
    assert.deepEqual(texts(source), ["一つ目の節の文。", "二つ目の節の文。"]);
  });

  it("ページ内リンクだけの目次は文にならない。項目に言葉のある箇条書きは残る", () => {
    const source = ["- [概要](#概要)", "  - [背景](#背景)", "- [手順](#手順)は次の節を読む。", "", "本文の文。"].join("\n");
    assert.deepEqual(texts(source), ["手順は次の節を読む。", "本文の文。"]);
  });

  it("他のページへのリンクの一覧と、リンクを含む文は残る", () => {
    const source = ["- [Guide](./guide.md)", "- [Site](https://example.com/)", "", "Read [the summary](#summary) first."].join("\n");
    assert.deepEqual(texts(source, en), ["Guide", "Site", "Read the summary first."]);
  });
});
