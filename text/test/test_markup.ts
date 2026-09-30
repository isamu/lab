import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { namedHeading } from "../packages/chaff/src/markup.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Markup } from "../packages/chaff/src/plugin.ts";

// 文書の記法の手がかり（doc.markup）。記法の rule はこれだけを読む。例文はすべて自作。

const markupOf = (source: string, path = "a.md"): Markup => {
  const markup = buildDocument(path, source, ja).markup;
  assert.ok(markup !== undefined);
  return markup;
};

const textsOf = (source: string, path = "a.md"): string[] => markupOf(source, path).texts.map((span) => source.slice(span.start, span.end));

describe("doc.markup", () => {
  it("見出しの深さと言葉。付けた名前は外して ids に入れる", () => {
    const markup = markupOf("# 表題\n\n## 準備 {#prep}\n\n### 設定 {/*config*/}\n\n#### 閉じ ##\n");
    assert.deepEqual(
      markup.headings.map((heading) => `${String(heading.depth)}:${heading.text}`),
      ["1:表題", "2:準備", "3:設定", "4:閉じ"],
    );
    assert.deepEqual([...markup.ids], ["prep", "config"]);
  });

  it("HTML の id と name、img の alt", () => {
    const markup = markupOf('<a id="faq"></a>\n\n<p name=\'old\'>x</p>\n\n<img src="a.png"> <img src="b.png" alt="">\n');
    assert.deepEqual([...markup.ids], ["faq", "old"]);
    assert.deepEqual(
      markup.images.map((image) => image.alt),
      [undefined, ""],
    );
  });

  it("リンクの行き先と、参照の定義の行き先", () => {
    const markup = markupOf("[a](https://x.jp) [b]() [c][Ref]\n\n[Ref]: #top\n");
    assert.deepEqual(
      markup.links.map((link) => link.destination),
      ["https://x.jp", "", "#top"],
    );
  });

  it("メールの引用した返信の中は、ほかの人の文書なので読まない", () => {
    const source = ["はい、大丈夫です。", "", "山田太郎 さんは書きました:", "> ![](figure.png) 詳しくは https://example.jp/aを。", "> [資料]()", ""].join("\n");
    const markup = markupOf(source);
    assert.deepEqual(markup.images, []);
    assert.deepEqual(markup.links, []);
    assert.deepEqual(textsOf(source), ["はい、大丈夫です。"]);
  });

  it("字のまま見える範囲は、リンク・コード・HTML の外", () => {
    assert.deepEqual(textsOf("見る [資料](https://x.jp) と `code` と <b>太</b> と https://y.jp。\n"), ["見る ", " と ", " と ", "太", " と https://y.jp。"]);
  });

  it("テキストの文書は記法を持たず、文書全体が字のまま見える", () => {
    const source = "## 準備\n\n[資料]()\n";
    const markup = markupOf(source, "a.txt");
    assert.equal(markup.markdown, false);
    assert.deepEqual(markup.headings, []);
    assert.deepEqual(textsOf(source, "a.txt"), [source]);
  });

  it("文書ごとに一度だけ作る", () => {
    const doc = buildDocument("a.md", "# 表題\n", ja);
    assert.equal(doc.markup, doc.markup);
  });
});

describe("namedHeading", () => {
  it("属性とコメントの名前を外す", () => {
    assert.deepEqual(namedHeading("準備 {#prep .wide}"), { text: "準備", id: "prep" });
    assert.deepEqual(namedHeading("設定 {/* config */}"), { text: "設定", id: "config" });
  });

  it("名前でない波括弧は言葉のうち", () => {
    assert.deepEqual(namedHeading("{name} の設定"), { text: "{name} の設定", id: undefined });
    assert.deepEqual(namedHeading("値 {x}"), { text: "値 {x}", id: undefined });
    assert.deepEqual(namedHeading(""), { text: "", id: undefined });
  });
});
