import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { fromMarkdown } from "mdast-util-from-markdown";
import { inPageAnchors, isInPageNavigation, isNavigationList, type NavNode } from "../packages/chaff/src/in-page-nav.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 同じページの中へのリンクと記号だけの段落は、ページの案内であって本文ではない。

const firstOfType = (root: NavNode, type: string): NavNode => {
  const found: NavNode[] = [];
  const visit = (node: NavNode): void => {
    if (node.type === type) found.push(node);
    (node.children ?? []).forEach(visit);
  };
  visit(root);
  const first = found[0];
  assert.ok(first !== undefined, `${type} が無い`);
  return first;
};

const isNav = (markdown: string): boolean => {
  const root = fromMarkdown(markdown);
  return isInPageNavigation(firstOfType(root, "paragraph"), inPageAnchors(root));
};

const isNavList = (markdown: string): boolean => {
  const root = fromMarkdown(markdown);
  return isNavigationList(firstOfType(root, "list"), inPageAnchors(root));
};

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

  it("参照形式のリンクは、定義が同じページの中を指すときだけ案内", () => {
    assert.equal(isNav("[▲ 目次に戻る][toc]\n\n[toc]: #目次"), true);
    assert.equal(isNav("[top][]\n\n[top]: #top"), true);
    assert.equal(isNav("[目次][toc]\n\n[toc]: ./index.md#目次"), false);
    assert.equal(isNav("[目次][missing]"), false);
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
    assert.equal(isInPageNavigation({ type: "paragraph", children: [{ type: "linkReference" }] }), false);
    assert.equal(isInPageNavigation({ type: "paragraph", children: [{ type: "text" }, { type: "link", url: "#a" }] }), true);
  });
});

describe("inPageAnchors", () => {
  it("同じページの中を指す定義の名前だけを集める", () => {
    const root = fromMarkdown(["[a]: #a", "[b]: ./b.md", "[C]: #c", "[d]: https://example.com/#d"].join("\n"));
    assert.deepEqual(
      [...inPageAnchors(root)].sort((a, b) => a.localeCompare(b)),
      ["a", "c"],
    );
    assert.deepEqual([...inPageAnchors({ type: "root" })], []);
    assert.deepEqual([...inPageAnchors({ type: "definition", url: "#x" })], []);
    assert.deepEqual([...inPageAnchors({ type: "root", children: [{ type: "link", identifier: "x", url: "#x" }] })], []);
  });
});

describe("isNavigationList: 目次の箇条書き", () => {
  it("項目がどれもページの案内なら、入れ子があっても案内", () => {
    assert.equal(isNavList(["- [概要](#概要)", "  - [背景](#背景)", "- [手順](#手順)"].join("\n")), true);
    assert.equal(isNavList(["1. [一](#一)", "2. [二](#二)"].join("\n")), true);
  });

  it("言葉のある項目・他のページへの項目・空の項目が 1 つでもあれば箇条書きのまま", () => {
    assert.equal(isNavList(["- [概要](#概要)", "- [手順](#手順)は次の節を読む。"].join("\n")), false);
    assert.equal(isNavList(["- [概要](#概要)", "  - 背景の説明"].join("\n")), false);
    assert.equal(isNavList(["- [概要](#概要)", "- [Guide](./guide.md)"].join("\n")), false);
    assert.equal(isNavList(["- [概要](#概要)", "-"].join("\n")), false);
  });

  it("箇条書きでない節・項目の無い箇条書き", () => {
    assert.equal(isNavigationList({ type: "paragraph", children: [{ type: "link", url: "#a" }] }), false);
    assert.equal(isNavigationList({ type: "list" }), false);
    assert.equal(isNavigationList({ type: "list", children: [{ type: "paragraph", children: [{ type: "link", url: "#a" }] }] }), false);
    const navParagraph: NavNode = { type: "paragraph", children: [{ type: "link", url: "#a" }] };
    assert.equal(isNavigationList({ type: "list", children: [{ type: "listItem", children: [navParagraph] }] }), true);
    assert.equal(isNavigationList({ type: "list", children: [{ type: "blockquote", children: [navParagraph] }] }), false);
    assert.equal(isNavigationList({ type: "blockquote", children: [{ type: "listItem", children: [navParagraph] }] }), false);
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

  it("参照形式の「目次に戻る」も文にならない", () => {
    const source = ["一つ目の文。", "", "[▲ 目次に戻る][toc]", "", "[toc]: #目次"].join("\n");
    assert.deepEqual(texts(source), ["一つ目の文。"]);
  });

  it("ページ内リンクだけの目次は文にならない。項目に言葉のある箇条書きは残る", () => {
    const source = ["- [概要](#概要)", "  - [背景](#背景)", "- [手順](#手順)は次の節を読む。", "", "本文の文。"].join("\n");
    assert.deepEqual(texts(source), ["手順は次の節を読む。", "本文の文。"]);
  });

  it("他のページへのリンクの一覧と、リンクを含む文は残る", () => {
    const source = ["- [Guide](./guide.md)", "- [Site](https://example.com/)", "", "Read [the summary](#summary) first."].join("\n");
    assert.deepEqual(texts(source, en), ["Guide", "Site", "Read the summary first."]);
  });

  it("目次の箇条書きは箇条書きとして数えない。他の箇条書きは数える", () => {
    const head = ["- [一](#一)", "- [二](#二)", "- [三](#三)", "", "本文の文。", ""].join("\n");
    const lists = buildDocument("t.md", `${head}\n${["- 一つ目", "- 二つ目", "- 三つ目"].join("\n")}`, ja).lists;
    assert.deepEqual(
      lists.map((found) => ({ start: found.span.start, items: found.items.length })),
      [{ start: head.length + 1, items: 3 }],
    );
  });
});
