import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { seriesLabelSpans } from "../packages/chaff/src/detectors/series-label.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 番号の前の大文字の語は、文書番号の一部（SP 800-61、BOD 25-01、NSF 19-582）で、略語ではない。例文は自作。
// cloud.gov の手順書の NIST SP 800-61 で SP が報告されていた。発行元の NIST は番号の直前ではないので、略語のまま数える。

const labelsIn = (text: string): string[] => seriesLabelSpans(text).map((span) => text.slice(span.start, span.end));

describe("seriesLabelSpans", () => {
  [
    ["文書番号", "following NIST SP 800-61, as", ["SP 800-61"]],
    ["版の印が続く番号", "see NIST SP 800-53r5 today", ["SP 800-53r5"]],
    ["番号の区切りが 2 つ", "the GIF 491-3-1 entry", ["GIF 491-3-1"]],
    ["同じ桁数でも大きいほうから", "the SP 800-100 guide", ["SP 800-100"]],
    ["区切りが 2 つ（範囲ではない）", "the ISO 100-200-1 part", ["ISO 100-200-1"]],
    ["公募の番号", "under NSF 19-582 grants", ["NSF 19-582"]],
    ["文の終わり", "under NSF 19-582.", ["NSF 19-582"]],
    ["日本語の文の中", "NIST SP 800-61に従う", ["SP 800-61"]],
  ].forEach(([form, text, labels]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(labelsIn(String(text)), labels));
  });

  [
    ["区切りの無い番号", "the RFC 9110 text and the EO 14028 order"],
    ["版の番号（. で区切る）", "the SDK 3.1 release"],
    ["年の範囲", "the FY 2024-25 budget and the NFL 1999-2000 season"],
    ["範囲や得点（短い）", "the SRE 1-2 handoff, the NFL 3-1 win and UK 5-10 days and NSF 19-1"],
    ["2 桁ずつの番号（日付や範囲と見分けられない）", "the SRE 01-02 handoff and BOD 25-01"],
    ["同じ桁数で小さいほうからの範囲", "the SLO 100-200 ms tier and the SLA 500-599 errors"],
    ["語と番号の間に空白が 2 つ以上", "the SP  800-61 text"],
    ["語と番号の間に別の文字", "the SP, 800-61 text and SP-800-61"],
    ["小文字を含む語", "the Sp 800-61 text"],
    ["番号の後ろに英字が続かない形が崩れている", "the SP 800- text and SP -61"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(labelsIn(String(text)), []));
  });

  it("異常な入力: 空文字、語だけ、番号だけ", () => {
    assert.deepEqual(labelsIn(""), []);
    assert.deepEqual(labelsIn("SP"), []);
    assert.deepEqual(labelsIn("800-61"), []);
  });
});

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("undefined-acronym と文書番号", () => {
  it("en: 番号の前の SP は数えず、発行元の NIST は数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nWe define it broadly, following [NIST SP 800-61](https://example.gov/sp.pdf), as a violation.\n"), ["NIST"]);
  });

  it("en: 番号の外の SP は数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nThe SP 800-61 guide applies. The SP signs it.\n"), ["SP"]);
  });

  it("en: 範囲の前の SRE は数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nThe SRE 1-2 handoff failed.\n"), ["SRE"]);
  });

  it("en: 年の範囲の前の FY は数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nThe FY 2024-25 budget is final.\n"), ["FY"]);
  });

  it("ja: 番号の前の SP は数えず、SRE は数える", () => {
    assert.deepEqual(reported(ja, "# 手引き\n\nNIST SP 800-61（米国標準技術研究所の文書）に従います。SREも見ます。\n"), ["NIST", "SRE"]);
  });
});
