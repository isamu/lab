import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { preambleParagraphs } from "../packages/chaff/src/preamble-paragraphs.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Finding, LanguageAdapter, Paragraph } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 本題の前の段落のうち、文が一つも閉じないもの（分類の札、著者の行、ボタンの文字）は前置きに数えない。例文はすべて自作。

const at = (start: number, ...texts: readonly string[]): Paragraph => ({
  span: { start, end: start + texts.join("").length },
  sentences: texts.map((text) => ({ span: { start, end: start + text.length }, text })),
});

const starts = (paragraphs: readonly Paragraph[], bodyStart: number): number[] =>
  preambleParagraphs(paragraphs, bodyStart).map((paragraph) => paragraph.span.start);

describe("preambleParagraphs", () => {
  it("終止符で閉じる文を含む段落だけを、本題より前から数える", () => {
    const paragraphs = [at(0, "前置きです。"), at(10, "エネルギー・環境"), at(20, "Two. ", "Three"), at(30, "Label"), at(40, "本題です。")];
    assert.deepEqual(starts(paragraphs, 40), [0, 20]);
  });

  it("疑問符・感嘆符・全角ピリオドと、閉じ括弧や引用符の後ろの終止符も閉じた文", () => {
    const paragraphs = [at(0, "Now what?"), at(10, "やった！"), at(20, "（注記です。）"), at(30, "「以上。」"), at(40, 'He said "yes."'), at(50, "一．")];
    assert.deepEqual(starts(paragraphs, 60), [0, 10, 20, 30, 40, 50]);
  });

  it("名前と所属、見出し代わりの大文字、コロンで終わる札、日付の行は数えない", () => {
    const paragraphs = [
      at(0, "Jane Roe, Example University (example.edu)"),
      at(10, "PARTICIPANTS"),
      at(20, "License: CC BY 4.0"),
      at(30, "Held online, 2 May 2026 · Revised 9 May 2026"),
      at(40, "The steps are:"),
    ];
    assert.deepEqual(starts(paragraphs, 50), []);
  });

  it("本題の位置ちょうどの段落と後ろの段落は数えない。段落も文も無ければ空", () => {
    assert.deepEqual(starts([at(0, "一。"), at(10, "二。")], 10), [0]);
    assert.deepEqual(starts([at(0, "一。")], 0), []);
    assert.deepEqual(starts([], 10), []);
    assert.deepEqual(starts([at(0)], 10), []);
  });
});

const findingsFor = (source: string, adapter: LanguageAdapter, genre = "business/report"): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre).findings.filter((finding) => finding.rule === "preamble-length");

describe("preamble-length と文でない段落", () => {
  it("日本語: 表題の後の日付と分類の札は数えず、リードと注記だけなら上限まで", () => {
    const source =
      "# 新しい窓口を開きます\n\n2026年1月13日\n\n暮らし・手続\n\n来月から駅前に窓口を開きます。※1\n\n※1 平日の昼だけです。\n\n## 1．概要\n\n中身です。\n";
    assert.deepEqual(findingsFor(source, ja, "business/press-release"), []);
  });

  it("日本語: 札を除いても文の段落が上限を超えれば指摘し、数と位置は最初の文の段落から", () => {
    const source = "# 表題\n\n暮らし・手続\n\n前置き一。\n\n前置き二。\n\n前置き三。\n\n## 本題\n\n中身です。\n";
    const [finding] = findingsFor(source, ja);
    assert.equal(finding?.values["count"], 3);
    assert.equal(finding?.values["offset"], source.indexOf("前置き一"));
  });

  it("終止符の後ろに脚注の印が付いた文も閉じた文として数える", () => {
    const ja3 = "# 表題\n\n前置き一です。※1\n\n前置き二です。[^2]\n\n前置き三です。<sup>3</sup>\n\n## 本題\n\n中身です。\n\n[^2]: 注。\n";
    assert.equal(findingsFor(ja3, ja)[0]?.values["count"], 3);
    const en3 = "# Title\n\nFirst paragraph.[^1]\n\nSecond paragraph.[^2]\n\nThird paragraph.[^3]\n\n## Body\n\nText.\n\n[^1]: A.\n[^2]: B.\n[^3]: C.\n";
    assert.equal(findingsFor(en3, en)[0]?.values["count"], 3);
  });

  it("English: a report's front matter of names, affiliations and labels is not preamble", () => {
    const source = [
      "Assessment After the Chatbot. What Changed?",
      "Report from a workshop on assessment",
      "ORGANISERS",
      "Jane Roe, Example University (example.edu)",
      "John Doe, Sample College (sample.edu)",
      "Names are listed with consent.",
      "Held online, 2 May 2026 · Revised 9 May 2026",
      "### Introduction",
      "This report summarises the workshop.",
    ].join("\n\n");
    assert.deepEqual(findingsFor(source, en), []);
  });

  it("English: a template directive and a link to the next page are not preamble; three sentences are", () => {
    const directive = '{% include "steps.html" current=3 %}\n\n[Next to Reimbursement >](next.html)\n\n';
    assert.deepEqual(findingsFor(`${directive}Now for the fun part.\n\n### Pack light\n\nBody.\n`, en), []);
    const [finding] = findingsFor(`${directive}First.\n\nSecond.\n\nThird.\n\n### Pack light\n\nBody.\n`, en);
    assert.equal(finding?.values["count"], 3);
  });

  it("English: address fields closed by Inc. are not preamble; a field whose value is a sentence is", () => {
    const fields =
      "# Quotation\n\nQuote number: Q-1\n\nTo: Minato Manufacturing Inc.\n\nFrom: Aoba Systems Inc.\n\nWe are pleased to quote as follows.\n\n## Amount\n\nText.\n";
    assert.deepEqual(findingsFor(fields, en), []);
    const notes = "# Guide\n\nNote: This guide covers the setup.\n\nWarning: The steps delete old files.\n\nRead them first.\n\n## Setup\n\nText.\n";
    assert.equal(findingsFor(notes, en)[0]?.values["count"], 3);
    const summary = "# Report\n\nSummary: Sales up 5%.\n\nSecond.\n\nThird.\n\n## Body\n\nText.\n";
    assert.equal(findingsFor(summary, en)[0]?.values["count"], 3);
  });

  it("日本語: 体言止めの結論の欄は前置きに数える", () => {
    const source = "# 表題\n\n結論：売上前年比5%増。\n\n二つ目です。\n\n三つ目です。\n\n## 本題\n\n中身です。\n";
    assert.equal(findingsFor(source, ja)[0]?.values["count"], 3);
  });
});
