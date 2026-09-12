import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

const build = (source: string) => buildDocument("t.md", source, ja);
const texts = (source: string): string[] => build(source).sentences.map((sentence) => sentence.text.trim());

describe("ProseDocument の組み立て", () => {
  it("コードブロックを本文として数えない", () => {
    // これが入ると 1 文が数百文字になる。いまの CLI が現に間違えている。
    const source = ["説明の文です。", "", "```ts", "const a = 1; const b = 2; foo(); bar(); baz();", "```", "", "続きの文です。"].join("\n");
    assert.deepEqual(texts(source), ["説明の文です。", "続きの文です。"]);
  });

  it("インラインコードの中身を本文として数えない", () => {
    const doc = build("まず `npm i chaff. そして foo.` を実行する。");
    assert.equal(doc.sentences.length, 1);
  });

  it("表の行を文として数えない", () => {
    const source = ["前置きの文。", "", "| a | b |", "| --- | --- |", "| 1 | 2 |", "", "後の文。"].join("\n");
    assert.deepEqual(texts(source), ["前置きの文。", "後の文。"]);
  });

  it("引用を本文として数えない", () => {
    // 引用は自分の文章ではない。「2 文に割ってください」と言えない相手を指摘しない。
    const source = ["前置きの文。", "", "> 引用された長い文がここにあります。これも引用の続きです。", "", "後の文。"].join("\n");
    assert.deepEqual(texts(source), ["前置きの文。", "後の文。"]);
  });

  it("引用の中の太字も数えない", () => {
    const doc = build("## 節\n\n> **a** と **b** と **c** です。\n\n本文です。");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [0],
    );
  });

  it("front matter を本文として数えない", () => {
    const source = ["---", "title: テスト", "lang: ja", "---", "", "本文の文です。"].join("\n");
    assert.deepEqual(texts(source), ["本文の文です。"]);
  });

  it("見出しは本文の文にせず、節の見出しとして持つ", () => {
    const doc = build("# 題\n\n本文です。\n\n## 節\n\n節の本文です。");
    assert.deepEqual(
      doc.sections.map((section) => section.heading),
      ["題", "節"],
    );
    assert.deepEqual(texts("# 題\n\n本文です。"), ["本文です。"]);
  });

  it("リンクの表示文字は残し、URL は数えない", () => {
    const doc = build("詳細は [この記事](https://example.com/a.b.c) を読んでください。");
    assert.equal(doc.sentences.length, 1);
    assert.ok(doc.sentences[0]?.text.includes("この記事"), doc.sentences[0]?.text ?? "文がない");
  });

  it("覆ってもオフセットが元文字列と一致する", () => {
    const source = "説明です。\n\n```\ncode\n```\n\n続きです。";
    build(source).sentences.forEach((sentence) => {
      assert.equal(sentence.text, source.slice(sentence.span.start, sentence.span.end));
    });
  });

  it("節ごとに強調の数を数える", () => {
    const doc = build("## 一\n\n**a** と **b** です。\n\n## 二\n\n**c** だけ。");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [2, 1],
    );
  });

  it("表のセルの中の太字は数えない", () => {
    // ラベルであって強調ではない。「読者の目を止める道具」という理屈が当てはまらない。
    const doc = build("## 表\n\n| 道 | いつ |\n| --- | --- |\n| **直す** | A |\n| **黙らせる** | B |\n| **変える** | C |");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [0],
    );
  });

  it("見出しの中の太字も数えない", () => {
    const doc = build("## **強い**見出し\n\n本文です。");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [0],
    );
  });

  it("コードブロックの中の ** も数えない", () => {
    const doc = build("## 節\n\n```\n**a** **b** **c**\n```\n\n本文です。");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [0],
    );
  });

  it("表のある節でも、本文の太字は数える", () => {
    // 表を除いた結果、本文まで数え落とさないこと。
    const doc = build("## 節\n\n本文で **強調** します。\n\n| a | b |\n| --- | --- |\n| **x** | y |");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [1],
    );
  });

  it("見出しの前の導入部も節として扱う", () => {
    const doc = build("導入の文です。\n\n## 節\n\n節の文です。");
    assert.equal(doc.sections.length, 2);
    assert.equal(doc.sections[0]?.heading, "");
    assert.equal(doc.sections[0]?.depth, 0);
  });

  it("強調の記号は本文に数えない。囲まれた文字は残す", () => {
    // 読み手が読むのは「強調」の 2 文字で、`**` の 4 文字ではない。
    const [plain] = texts("これは強調です。");
    const [marked] = texts("これは**強調**です。");
    assert.equal(marked?.replace(/\s/gu, ""), plain);
  });

  it("強調で終わる文が、次の文を飲み込まない", () => {
    // `**。` は解析器に 1 語として読まれ、文の終わりが消える。記号を覆うことで閉じる。
    assert.equal(texts("これは**大事です**。次の文です。").length, 2);
  });

  it("強調の記号を覆っても、太字そのものは数える", () => {
    // 記号を「覆った場所」と同じ集合にすると、太字が自分の記号に覆われて 1 つも数えられなくなる。
    const doc = build("## 節\n\n本文で **強調** します。");
    assert.deepEqual(
      doc.sections.map((section) => section.strongCount),
      [1],
    );
  });

  it("::: のディレクティブは本文ではない", () => {
    // Zenn / Docusaurus / VitePress の囲み記法。標準 Markdown に無く、段落として解析される。
    assert.deepEqual(texts(":::message\n中の文です。\n:::"), ["中の文です。"]);
  });

  it("空文書でも落ちない", () => {
    assert.deepEqual(texts(""), []);
    assert.deepEqual(build("").sections, []);
  });
});

describe("裸の URL", () => {
  it("本文として数えない", () => {
    // GFM の autolink 拡張を入れていないので mdast ではただのテキストになる。
    // 残すと、見出しと URL の中の識別子が一致して「見出しの繰り返し」と読まれる。
    const [text] = texts("参照は https://example.com/mulmo_script_validator です。");
    assert.ok(!(text ?? "").includes("mulmo_script"));
    assert.match(text ?? "", /^参照は\s+です。$/u);
  });

  it("リンクの表示文字は残す", () => {
    const [text] = texts("参照は [説明](https://example.com/x) です。");
    assert.match(text ?? "", /説明/u);
    assert.ok(!(text ?? "").includes("example.com"));
  });
});
