import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";
import { mentionedSpellingSpans } from "../packages/chaff/src/spelling-mention.ts";

// orthographic-variant: かなの「たつ」は、時が経つにも、立つ・建つ・発つにも読める。別の書き方を言う文（（曇）とも書く。）の
// 括弧の中は、書き方そのものが話題。例文は自作。

const RULES = loadRules("ja");

const variants = (source: string, genre = "speech/address"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre)
    .findings.filter((finding) => finding.rule === "orthographic-variant")
    .map((finding) => `${String(finding.values?.["written"])}/${String(finding.values?.["other"])}`);

describe("orthographic-variant: たつ", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 時がたつと、壇に立つ", () => {
    assert.deepEqual(variants("壇上に立ちました。演台に立ちました。前に立ちました。あれから８０年がたちました。\n"), []);
    assert.deepEqual(variants("あと２５年たつと人口は半分になる。私はこの場に立つ。皆さんの前に立つ。会場に立つ。\n"), []);
  });

  it("invalid: ほかの語の書き方のゆれは、同じ文書でも比べる", () => {
    assert.deepEqual(variants("平和を揺るがす。秩序を揺るがす。土台を揺るがす。信頼をゆるがす。あれから８０年がたちました。壇に立ちました。\n"), [
      "ゆるがす/揺るがす",
    ]);
  });
});

describe("mentionedSpellingSpans", () => {
  const phrases = ["とも書く"];
  it("言い方の語句のすぐ前に並ぶ、丸括弧に入れた語", () => {
    assert.deepEqual(mentionedSpellingSpans("（くもり）、（曇）とも書く。", phrases), [
      { start: 0, end: 5 },
      { start: 6, end: 9 },
    ]);
    assert.deepEqual(mentionedSpellingSpans("晴れ(晴)とも書く。", phrases), [{ start: 2, end: 5 }]);
  });

  it("言い方の語句が無いか、その後ろの括弧、すぐ前に並ばない括弧、句読点を含む括弧は数えない", () => {
    assert.deepEqual(mentionedSpellingSpans("（くもり）の日が多い。", phrases), []);
    assert.deepEqual(mentionedSpellingSpans("とも書く（曇）。", phrases), []);
    assert.deepEqual(mentionedSpellingSpans("（雨、雪）とも書く。", phrases), []);
    assert.deepEqual(mentionedSpellingSpans("説明（例）を経て、（曇）とも書く。", phrases), [{ start: 9, end: 12 }]);
    assert.deepEqual(mentionedSpellingSpans("（晴）とも書くが、後で（例）を見る。", phrases), [{ start: 0, end: 3 }]);
    assert.deepEqual(mentionedSpellingSpans("", phrases), []);
    assert.deepEqual(mentionedSpellingSpans("（曇）とも書く。", []), []);
  });
});

describe("orthographic-variant: 別の書き方を言う文", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: （くもり）、（曇）とも書く。", () => {
    const glossary = "曇りの日が多い。曇りのところが多い。晴れか曇りか分からない。曇りや雨が続く。\n\n（くもり）、（曇）とも書く。\n";
    assert.deepEqual(variants(glossary, "docs/glossary"), []);
  });

  it("invalid: 言い方の語句の無い文の括弧の中は、本文の書き方と比べる", () => {
    const glossary = "曇りの日が多い。曇りのところが多い。晴れか曇りか分からない。曇りや雨が続く。\n\n明日は（曇）の予報。\n";
    assert.deepEqual(variants(glossary, "docs/glossary"), ["曇/曇り"]);
  });
});
