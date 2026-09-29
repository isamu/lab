import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isExplained, partsOf } from "../packages/chaff/src/detectors/acronym-compound.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// - で繋いだ略語、& で繋いだ通じる語、2 語の強調。例文はすべて自作。

/** 1 個でも出す段階で、出た略語だけを返す。 */
const acronymsIn = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("partsOf / isExplained", () => {
  const known = new Set(["US", "EU", "PCR"]);
  const alone = (word: string): boolean => known.has(word);

  it("- で繋いだ語は部品に分ける。繋いでいなければその語だけ", () => {
    assert.deepEqual(partsOf("RT-PCR"), ["RT", "PCR"]);
    assert.deepEqual(partsOf("SRE"), ["SRE"]);
    assert.deepEqual(partsOf("Q&A-KB"), ["Q&A", "KB"]);
  });

  it("valid: 部品がどれも説明済み", () => assert.ok(isExplained("US-EU", alone)));
  it("valid: 繋いだ形のまま説明済み", () => assert.ok(isExplained("RT-PCR", (word) => word === "RT-PCR")));
  it("valid: 繋いでいない語が説明済み", () => assert.ok(isExplained("PCR", alone)));
  it("invalid: 部品の 1 つが説明されていない", () => assert.equal(isExplained("RT-PCR", alone), false));
  it("invalid: 繋いでいない語が説明されていない", () => assert.equal(isExplained("SRE", alone), false));
  it("invalid: 空の語", () => assert.equal(isExplained("", alone), false));
});

describe("undefined-acronym: - で繋いだ略語は 1 語", () => {
  it("invalid: RT-PCR は RT と PCR に割らず、1 語として数える", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nSamples go to RT-PCR testing."), ["RT-PCR"]);
  });

  it("invalid: 日本語の文の中でも 1 語", () => {
    assert.deepEqual(acronymsIn("# 検査\n\n検体はRT-PCR法で調べます。", ja), ["RT-PCR"]);
  });

  it("invalid: 繋いだ語と、単独の部品は別の略語", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nWe run RT-PCR and then PCR again."), ["RT-PCR", "PCR"]);
  });

  it("valid: 繋いだ形のまま括弧で展開してある", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nWe use reverse transcription PCR (RT-PCR). The RT-PCR run is short."), []);
  });

  it("valid: 角括弧で、直前の語の頭文字と揃う（- は頭文字に数えない）", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nWe use Reverse Transcription Polymerase Chain Reaction [RT-PCR] here."), []);
  });

  it("valid: 括弧の最初の項目で、区切りの後ろの語の頭文字と揃う（- は頭文字に数えない）", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nWe use it (RT-PCR, Reverse Transcription Polymerase Chain Reaction) daily."), []);
  });

  it("valid: 括弧の最初の項目で、直前の語の頭文字と揃う", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nWe use Reverse Transcription Polymerase Chain Reaction (RT-PCR; see below) daily."), []);
  });

  it("invalid: 区切りの後ろの語の頭文字が - の片側にしか揃わない", () => {
    assert.deepEqual(acronymsIn("# Tests\n\nWe use it (RT-PCR, Polymerase Chain Reaction) daily."), ["RT-PCR"]);
  });

  it("valid: 部品がどれも通じる語", () => {
    assert.deepEqual(acronymsIn("# Trade\n\nThe US-EU talks resume."), []);
  });

  it("valid: 部品がどれも本文で展開してある", () => {
    const source = "# Ops\n\nSite Reliability Engineering (SRE) sets each Service Level Objective (SLO). The SRE-SLO review is weekly.";
    assert.deepEqual(acronymsIn(source), []);
  });

  it("invalid: 部品の 1 つだけが通じても、繋いだ語は指摘する", () => {
    assert.deepEqual(acronymsIn("# Trade\n\nThe US-XYZ talks resume."), ["US-XYZ"]);
  });

  it("invalid: 小文字の語と繋いだ略語は、略語だけを数える", () => {
    assert.deepEqual(acronymsIn("# Ops\n\nAn SRE-led review and a GDPR-compliant form."), ["SRE", "GDPR"]);
  });

  it("invalid: 1 文字の大文字と繋いだ略語は、略語だけを数える", () => {
    assert.deepEqual(acronymsIn("# Data\n\nWe write T-XYZ queries."), ["XYZ"]);
    assert.deepEqual(acronymsIn("# Data\n\nThe XYZ-B plan ships."), ["XYZ"]);
  });

  it("invalid: 長すぎる大文字の語と繋いだ略語は、略語だけを数える", () => {
    assert.deepEqual(acronymsIn("# Data\n\nThe XYZ-ABCDEFGH module ships."), ["XYZ"]);
  });

  it("valid: 数字を含むものは識別子（COVID-19、SARS-CoV-2）", () => {
    assert.deepEqual(acronymsIn("# Health\n\nCOVID-19 is caused by SARS-CoV-2."), []);
  });
});

describe("undefined-acronym: & で繋いだ語", () => {
  it("valid: 仕事の文書で通じる語（Q&A、R&D、M&A）", () => {
    assert.deepEqual(acronymsIn("# Notes\n\nSee the Q&A. Our R&D and M&A teams agree."), []);
    assert.deepEqual(acronymsIn("# 連絡\n\nQ&Aを作成しました。R&DとM&Aの担当です。", ja), []);
  });

  it("invalid: 語彙表に無い & の語は指摘する（S&OP）", () => {
    assert.deepEqual(acronymsIn("# Plan\n\nThe S&OP cycle is monthly."), ["S&OP"]);
  });
});

describe("undefined-acronym: 2 語の強調", () => {
  it("valid: 片方が略語にしては長い大文字の語", () => {
    assert.deepEqual(acronymsIn("# Notice\n\nFiled today.\n\nBILLING CODE 1234-56-P\n"), []);
    assert.deepEqual(acronymsIn("# Notice\n\nATTENTION ALL: read this first."), []);
    assert.deepEqual(acronymsIn("# Notice\n\nPlease read the NEW GUIDELINES below."), []);
  });

  it("invalid: 略語 2 つの並びは強調ではない", () => {
    assert.deepEqual(acronymsIn("# Notes\n\nThe AWS KMS key rotates."), ["AWS", "KMS"]);
  });

  it("invalid: 略語の長さの上限ちょうどの語は、略語として数える", () => {
    assert.deepEqual(acronymsIn("# Markets\n\nThe NASDAQ OTC desk opens."), ["NASDAQ", "OTC"]);
  });

  it("invalid: 長い大文字の語でも 1 語だけなら、隣の略語は数える", () => {
    assert.deepEqual(acronymsIn("# Notice\n\nIMPORTANT: the SRE team owns this."), ["SRE"]);
  });

  it("invalid: 長い大文字の語と小文字の語を挟んだ略語は数える", () => {
    assert.deepEqual(acronymsIn("# Notice\n\nThe BILLING team and the SRE team meet."), ["SRE"]);
  });
});
