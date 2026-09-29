import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { numberInSentence, type NumberedText } from "../packages/chaff/src/structure/number-in-sentence.ts";
import { startsWithParticle } from "../packages/lang-ja/src/particle-after.ts";

// 本文の行頭の「3.11.0 was released on …」は文の中の数で、節の番号ではない（会議録・リリース報告の新しい順の一覧）。
// 見出しの行と、題を書いた番号は、これまでどおり節の番号として並びを比べる。

const lines = (...rows: string[]): string => rows.join("\n");

const gapsOf = (adapter: LanguageAdapter, source: string, path: string): readonly string[] =>
  runRules(buildDocument(path, source, adapter), loadRules(adapter.id), {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => `${String(finding.values["previous"])} -> ${String(finding.values["label"])}`);

const always = (): boolean => true;

/** 本文の行「1.2 rest」。 */
const bodyLine = (number: string, rest: string): NumberedText => ({ number, rest, isHeading: false });
const headingLine = (number: string, rest: string): NumberedText => ({ ...bodyLine(number, rest), isHeading: true });
const never = (): boolean => false;

describe("numberInSentence — 本文の番号の後ろが文の続きか", () => {
  it("本文の行で、続きが小文字の語なら文の中の数", () => {
    assert.equal(numberInSentence(bodyLine("1.2", "was released on 2024-10-17.")), true);
    assert.equal(numberInSentence(bodyLine("1.2", "is the last release of the 3.x line."), never), true);
    assert.equal(numberInSentence(bodyLine("1.2", "wurde veröffentlicht.")), true);
  });

  it("言語パッケージが文の続きと読めば、文の中の数", () => {
    assert.equal(numberInSentence(bodyLine("1.2", "を公開しました。"), always), true);
  });

  it("言語パッケージには番号と続きを渡す", () => {
    const seen: string[] = [];
    numberInSentence(bodyLine("4.2", "を公開しました。"), (number, rest) => {
      seen.push(number, rest);
      return false;
    });
    assert.deepEqual(seen, ["4.2", "を公開しました。"]);
  });

  it("題は小文字で始まらないので、番号のまま", () => {
    assert.equal(numberInSentence(bodyLine("1.2", "Scope")), false);
    assert.equal(numberInSentence(bodyLine("1.2", "The Supplier shall pay the fees."), never), false);
    assert.equal(numberInSentence(bodyLine("1.2", "設定"), never), false);
  });

  it("文として終わらない小文字の題は、番号のまま", () => {
    assert.equal(numberInSentence(bodyLine("3.1", "overview")), false);
    assert.equal(numberInSentence(bodyLine("3.2", "getting started with v2.0")), false);
    assert.equal(numberInSentence(bodyLine("3.2", "を公開"), always), false);
  });

  it("文の終わりは行末でなくてもよい", () => {
    assert.equal(numberInSentence(bodyLine("1.10.1", "was released on 2024-12-31. (pending issue with website)")), true);
    assert.equal(numberInSentence(bodyLine("3.11.0", "を公開しました。次は 3.12.0 です"), always), true);
  });

  it("文字でない始まり（括弧・引用符・数字）は決めない", () => {
    assert.equal(numberInSentence(bodyLine("1.2", "(a) the fees")), false);
    assert.equal(numberInSentence(bodyLine("1.2", "“Agreement” means this agreement.")), false);
    assert.equal(numberInSentence(bodyLine("1.2", "2024-10-17 release")), false);
  });

  it("見出しの行は、続きが小文字でも文の続きと読まれても章番号", () => {
    assert.equal(numberInSentence(headingLine("1.2", "overview")), false);
    assert.equal(numberInSentence(headingLine("1.2", "を公開しました。"), always), false);
  });

  it("テキストの仕様書の小文字の題（URI・ヘッダー名）は文として終わらないので章番号", () => {
    assert.equal(numberInSentence(bodyLine("4.2.1", "about:blank")), false);
    assert.equal(numberInSentence(bodyLine("3.2", "foo-bar directive")), false);
    assert.equal(numberInSentence(bodyLine("4.2.1", "about:blank is used here.")), true);
  });

  it("見出しの行では言語パッケージに聞かない", () => {
    assert.equal(
      numberInSentence(headingLine("1.2", "Scope"), () => {
        throw new Error("見出しでは呼ばない");
      }),
      false,
    );
  });
});

describe("startsWithParticle — 日本語の番号の後ろが助詞で始まるか", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("助詞で始まれば文の続き", () => {
    assert.equal(startsWithParticle("3.11.0", "を公開しました。"), true);
    assert.equal(startsWithParticle("3.11.0", "は廃止しました。"), true);
    assert.equal(startsWithParticle("3.11.0", "が最新です。"), true);
    assert.equal(startsWithParticle("4.2", "で配布しました。"), true);
  });

  it("名詞で始まる節の題は文の続きではない", () => {
    assert.equal(startsWithParticle("3.11.0", "設定"), false);
    assert.equal(startsWithParticle("3.11.0", "適用範囲"), false);
    assert.equal(startsWithParticle("3.11.0", "はじめに"), false);
    assert.equal(startsWithParticle("3.11.0", "甲は乙に対し、委託料を支払う。"), false);
  });

  it("空の続きは文の続きではない", () => {
    assert.equal(startsWithParticle("3.11.0", ""), false);
  });
});

describe("numbering-gap — 新しい順のリリース一覧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const releasesEn = lines(
    "# Report",
    "",
    "## Project Activity",
    "",
    "3.11.0 was released on 2024-10-17.",
    "3.10.0 was released on 2024-08-13.",
    "3.9.0 was released on 2024-03-29.",
  );

  it("英語の会議録（Markdown）の新しい順の一覧は、番号の抜けではない", () => {
    assert.deepEqual(gapsOf(en, releasesEn, "minutes.md"), []);
  });

  it("英語の会議録（テキスト）でも同じ", () => {
    assert.deepEqual(gapsOf(en, releasesEn, "minutes.txt"), []);
  });

  it("日本語の報告の新しい順の一覧は、番号の抜けではない", () => {
    const source = lines("# 報告", "", "## リリース", "", "3.11.0 を2024年10月17日に公開しました。", "3.10.0 を2024年8月13日に公開しました。");
    assert.deepEqual(gapsOf(ja, source, "report.md"), []);
  });

  it("テキストの仕様書で小文字の題の節（4.2.1.  about:blank）は、参照先として残る", () => {
    const source = lines(
      "4.  Types",
      "",
      "4.1.  Registering",
      "",
      "4.2.  Predefined Types",
      "",
      "4.2.1.  about:blank",
      "",
      "   The type is described in Section 4.2.1.",
    );
    const dangling = runRules(buildDocument("rfc.txt", source, en), loadRules("en"), {}, true, "technical/spec").findings.filter(
      (finding) => finding.rule === "dangling-reference",
    );
    assert.deepEqual(dangling, []);
  });

  it("題を書いた番号の抜けは、英語でもこれまでどおり言う", () => {
    const source = lines("# Terms", "", "3.1 Scope", "", "Text.", "", "3.3 Fees", "", "Text.");
    assert.deepEqual(gapsOf(en, source, "terms.txt"), ["3.1 -> 3.3"]);
  });

  it("本文の行の小文字の短い題の番号の抜けも言う", () => {
    const source = lines("# API", "", "3.1 overview", "", "Text.", "", "3.3 setup", "", "Text.");
    assert.deepEqual(gapsOf(en, source, "api.md"), ["3.1 -> 3.3"]);
  });

  it("小文字で始まる題でも、見出しの行の番号の抜けは言う", () => {
    const source = lines("# Guide", "", "## 3.1 overview", "", "Text.", "", "## 3.3 setup", "", "Text.");
    assert.deepEqual(gapsOf(en, source, "guide.md"), ["3.1 -> 3.3"]);
  });

  it("日本語の題を書いた番号の抜けも言う", () => {
    const source = lines("# 規程", "", "3.1 適用範囲", "", "本文。", "", "3.3 運用", "", "本文。");
    assert.deepEqual(gapsOf(ja, source, "rules.md"), ["3.1 -> 3.3"]);
  });
});
