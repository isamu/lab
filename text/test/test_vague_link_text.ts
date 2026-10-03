import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { bareLinkText, isVagueLinkText, linkTextOf } from "../packages/chaff/src/link-text.ts";

// 行き先を言わないリンクの言葉（vague-link-text）。例文はすべて自作。

const vague = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun("vague-link-text", `${source}\n`, adapter, path).findings;

describe("vague-link-text: 行き先を言わないリンクの言葉", () => {
  it("言葉全体が「こちら」「ここ」のリンクを指す", () => {
    assert.deepEqual(vague("料金の一覧は[こちら](https://example.com/pricing)です。"), ["リンクの言葉「こちら」は、行き先を言っていません"]);
    assert.deepEqual(vague("手順は[**ここをクリック**](https://example.com/apply)してください。"), [
      "リンクの言葉「ここをクリック」は、行き先を言っていません",
    ]);
  });

  it("行き先を言う言葉、URL のままのリンク、参照の形は指さない", () => {
    assert.deepEqual(vague("料金は[料金表はこちら](https://example.com/pricing)。"), []);
    assert.deepEqual(vague("案内は <https://example.com/guide> にあります。"), []);
    assert.deepEqual(vague("詳しくは[ここ][1]。\n\n[1]: https://example.com/guide"), []);
  });

  it("English: here, click here, read more; case and emphasis do not matter", () => {
    assert.deepEqual(vague("For prices, click [here](https://example.com/pricing).", en), ['The link text "here" does not say where it goes']);
    assert.deepEqual(vague("[**Read more**](https://example.com/post).", en), ['The link text "Read more" does not say where it goes']);
    assert.deepEqual(vague("Prices are on the [pricing page](https://example.com/pricing).", en), []);
  });

  it("links in code, in a quotation, or in a document that is not Markdown are not read", () => {
    assert.deepEqual(vague("Run `[here](x)` to see the syntax.", en), []);
    assert.deepEqual(vague("> Quoted, click [here](https://example.com).", en), []);
    assert.deepEqual(vague("For prices, click [here](https://example.com/pricing).", en, "a.txt"), []);
  });
});

describe("linkTextOf and isVagueLinkText", () => {
  it("reads the text of an inline link, with nested brackets", () => {
    assert.equal(linkTextOf("[here](https://e.com)"), "here");
    assert.equal(linkTextOf("[a [b] c](https://e.com)"), "a [b] c");
    assert.equal(linkTextOf("[ここ](https://e.com)"), "ここ");
  });

  it("an autolink, a definition, an unclosed bracket and the empty string have no text", () => {
    assert.equal(linkTextOf("<https://e.com>"), undefined);
    assert.equal(linkTextOf("[1]: https://e.com"), undefined);
    assert.equal(linkTextOf("[here"), undefined);
    assert.equal(linkTextOf(""), undefined);
    assert.equal(linkTextOf("[]()"), "");
  });

  it("compares the whole text, without emphasis, quotes or closing punctuation", () => {
    const words = new Set(["here", "こちら"]);
    assert.equal(isVagueLinkText("**Here**.", words), true);
    assert.equal(isVagueLinkText("「こちら」", words), true);
    assert.equal(isVagueLinkText("pricing here", words), false);
    assert.equal(isVagueLinkText("", words), false);
    assert.equal(bareLinkText(" _click  here_ "), "click here");
    assert.equal(isVagueLinkText("here\\.", words), true);
    assert.equal(isVagueLinkText("`here`", words), false);
  });
});
