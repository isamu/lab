import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { wikitextToMarkdown } from "../scripts/wikitext-markdown.ts";

// Wikivoyage の wikitext を Markdown に。見出し・段落・箇条書き・リンクの文字だけを残す。例文はすべて自作。

describe("wikitextToMarkdown: 見出し・段落・箇条書き", () => {
  it("= の数をそのまま # の数にする", () => {
    assert.equal(wikitextToMarkdown("==Understand==\nA walk.\n\n=== Getting there ===\nBy bus."), "## Understand\nA walk.\n\n### Getting there\nBy bus.\n");
  });

  it("* は - 、# は 1. 、入れ子は字下げ。: と ; は印を外して本文だけ", () => {
    assert.equal(wikitextToMarkdown("* One\n** Inner\n# First\n: Indented note\n; Term"), "- One\n  - Inner\n1. First\nIndented note\nTerm\n");
  });

  it("中身が消えた箇条書きの行と、続く空行は残さない", () => {
    assert.equal(wikitextToMarkdown("Intro.\n\n\n* {{unknown}}\n\n\n\nEnd."), "Intro.\n\nEnd.\n");
  });

  it("空の入力は空", () => {
    assert.equal(wikitextToMarkdown(""), "");
    assert.equal(wikitextToMarkdown("{{Pagebanner|x.jpg}}\n"), "");
  });
});

describe("wikitextToMarkdown: リンクと強調", () => {
  it("[[行き先|表示]] は表示、[[行き先]] は行き先、外部リンクはラベルだけ", () => {
    assert.equal(
      wikitextToMarkdown("Take the [[Harbor Line|harbour tram]] to [[Old Town]] and see [https://example.com/map the map] [https://example.com/x]."),
      "Take the harbour tram to Old Town and see the map .\n",
    );
  });

  it("ファイルと分類のリンクは、説明文の中のリンクごと落とす", () => {
    assert.equal(wikitextToMarkdown("[[File:Pier.jpg|thumb|The pier at [[Old Town]].]]\nText.[[Category:Walks]]"), "Text.\n");
  });

  it("太字・斜体の '' と ''' を外す", () => {
    assert.equal(wikitextToMarkdown("The '''North Gate''' is ''closed'' on '''''Sundays'''''."), "The North Gate is closed on Sundays.\n");
  });

  it("閉じていないリンクはそのまま残す", () => {
    assert.equal(wikitextToMarkdown("Broken [[link here."), "Broken [[link here.\n");
  });
});

describe("wikitextToMarkdown: テンプレート", () => {
  it("地図の印は名前、換算は数と単位、通貨は記号と額を文の中に残す", () => {
    assert.equal(
      wikitextToMarkdown("Stop at {{Marker|type=see|lat=1|long=2|name=Clock Tower}}, walk {{convert|700|m|yd}} and pay {{EUR|3}} or {{usd|4}}."),
      "Stop at Clock Tower, walk 700 m and pay €3 or $4.\n",
    );
  });

  it("施設の一覧は名前と説明を一行に。入れ子のテンプレートも読む", () => {
    const source = "* {{see\n| name=Harbor Museum {{icon|size=16px}} | url=https://example.com\n| content=Old boats and a [[Lighthouse|lighthouse]].\n}}";
    assert.equal(wikitextToMarkdown(source), "- Harbor Museum: Old boats and a lighthouse.\n");
  });

  it("駅のテンプレートは最初の値、名前だけで説明の無い一覧は名前だけ", () => {
    assert.equal(wikitextToMarkdown("* {{Station|North Station|city=xx|rail}}\n* {{do|name=Swim}}"), "- North Station\n- Swim\n");
  });

  it("ほかのテンプレートは落とす。閉じていないものは残す", () => {
    assert.equal(wikitextToMarkdown("{{Pagebanner|a.jpg|star=yes}}\nA day out.{{related|Walks}}"), "A day out.\n");
    assert.equal(wikitextToMarkdown("Open {{Marker|name=X"), "Open {{Marker|name=X\n");
    assert.equal(wikitextToMarkdown("Open {{ then {{EUR|3}} and [[Old Town]]."), "Open {{ then €3 and Old Town.\n");
  });
});

describe("wikitextToMarkdown: 落とすもの", () => {
  it("表は入れ子でも行ごと落とし、表の後の文は残す", () => {
    const source = "Before.\n{| class=wikitable\n! Price\n|-\n|\n{|\n| inner\n|}\n|}\nAfter.";
    assert.equal(wikitextToMarkdown(source), "Before.\nAfter.\n");
  });

  it("注釈・コメント・ギャラリー・__NOTOC__ を落とし、残りのタグは中身だけ", () => {
    const source = "__NOTOC__\nA<ref name=a>Note.</ref> b<ref name=a /> <!-- hidden -->c <u>in</u>side<br/>line.\n<gallery>\nA.jpg\n</gallery>";
    assert.equal(wikitextToMarkdown(source), "A b c inside line.\n");
  });

  it("文字参照を文字に戻す", () => {
    assert.equal(wikitextToMarkdown("Fish &amp; chips &mdash; 7&#189; hours"), "Fish & chips — 7½ hours\n");
  });
});
