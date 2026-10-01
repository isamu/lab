import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { labelPatternOf, unlabeledHeading } from "../packages/chaff/src/heading-label.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A number label at the head of a heading (例 3：, Step 3:, 1., 第2章) is never repeated by the text below it, so
// heading-echo measures the heading without it. Every text here is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const labelWordsOf = (adapter: LanguageAdapter): string[] =>
  (adapter.lexicons["numbered-label"] ?? []).filter((entry) => entry.position === "before").map((entry) => entry.pattern);

const strippedBy =
  (adapter: LanguageAdapter) =>
  (heading: string): string =>
    unlabeledHeading(heading, adapter.structure, labelPatternOf(labelWordsOf(adapter)));

describe("unlabeledHeading: the heading without its number label", () => {
  const japanese = strippedBy(ja);
  const english = strippedBy(en);

  it("日本語: 木と同じ読み方の番号（第2章、1.、4.2）と、語彙表の札（例 3：、問3、ステップ 2：）を除く", () => {
    assert.equal(japanese("例 3：証券会社のサイト"), "証券会社のサイト");
    assert.equal(japanese("例6:銀行のサイト"), "銀行のサイト");
    assert.equal(japanese("第2章 概要"), "概要");
    assert.equal(japanese("1. はじめに"), "はじめに");
    assert.equal(japanese("4.2 設定の手順"), "設定の手順");
    assert.equal(japanese("問3 計算の方法"), "計算の方法");
    assert.equal(japanese("ステップ 2：設定を書く"), "設定を書く");
  });

  it("日本語: 札でないものはそのまま（例えば、数量、題の無い札、語の途中の「問」）", () => {
    assert.equal(japanese("銀行のサイト"), "銀行のサイト");
    assert.equal(japanese("例えば 3 つの理由"), "例えば 3 つの理由");
    assert.equal(japanese("1.5 万人が使う道具"), "1.5 万人が使う道具");
    assert.equal(japanese("例 3："), "例 3：");
    assert.equal(japanese("第2章"), "第2章");
    assert.equal(japanese("質問3 計算の方法"), "質問3 計算の方法");
    assert.equal(japanese(""), "");
  });

  it("English: numbering read as the tree reads it (Chapter 2, Section 4.2, 1.) and label words (Step 3:, Example 4:)", () => {
    assert.equal(english("Step 3: Install the tool"), "Install the tool");
    assert.equal(english("Example 4: A bank site"), "A bank site");
    assert.equal(english("Chapter 2: Setup"), "Setup");
    assert.equal(english("Section 4.2 Scope"), "Scope");
    assert.equal(english("1. Introduction"), "Introduction");
  });

  it("English: a word that is not a label stays (Python 3:, Stepping, a bare word)", () => {
    assert.equal(english("Python 3: what changed"), "Python 3: what changed");
    assert.equal(english("Stepping 3 ways forward"), "Stepping 3 ways forward");
    assert.equal(english("Install the tool"), "Install the tool");
    assert.equal(english("2.5 days of leave"), "2.5 days of leave");
    assert.equal(english("Chapter 12"), "Chapter 12");
  });

  it("without structure patterns or label words, the heading stays", () => {
    assert.equal(unlabeledHeading("例 3：銀行のサイト", undefined, undefined), "例 3：銀行のサイト");
    assert.equal(labelPatternOf([]), undefined);
  });

  it("a label word is matched as written, not as a pattern", () => {
    const pattern = labelPatternOf(["Q."]);
    assert.equal(unlabeledHeading("Q. 3: Why", undefined, pattern), "Why");
    assert.equal(unlabeledHeading("Q.3: Why", undefined, pattern), "Why");
    assert.equal(unlabeledHeading("QX3: Why", undefined, pattern), "QX3: Why");
  });
});

const echoesOf = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, "blog/tech-blog")
    .findings.filter((finding) => finding.rule === "heading-echo")
    .map((finding) => String(finding.values["heading"]));

describe("heading-echo measures the heading without its label", () => {
  it("日本語: 「例 6：銀行のサイト」の直後の「ある銀行のサイトです。」は見出しの言い直し", () => {
    const source = ["# 試した結果", "", "### 例 6：銀行のサイト", "", "ある銀行のサイトです。", "", "画面は落ち着いていました。"].join("\n");
    assert.deepEqual(echoesOf(ja, source), ["例 6：銀行のサイト"]);
  });

  it("日本語: 札を除いても、中身を足す文は言い直しではない", () => {
    const source = ["# 試した結果", "", "### 例 6：銀行のサイト", "", "ログインの画面で、別のドメインのスクリプトが三つ動いていました。"].join("\n");
    assert.deepEqual(echoesOf(ja, source), []);
  });

  it("English: under 「Step 3: Install the tool」, 「Install the tool.」 only repeats the heading", () => {
    const source = ["# Setup", "", "## Step 3: Install the tool", "", "Install the tool.", "", "Then open it."].join("\n");
    assert.deepEqual(echoesOf(en, source), ["Step 3: Install the tool"]);
  });
});
