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

  it("空文書でも落ちない", () => {
    assert.deepEqual(texts(""), []);
    assert.deepEqual(build("").sections, []);
  });
});
