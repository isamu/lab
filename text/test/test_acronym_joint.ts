import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { expansionAt, type DefinitionWords } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 1 つの略語を空白で繋いだ 2 語以上で書き、括弧の中に置く形（overnight reverse repurchase agreement (ON RRP)）。
// FOMC の議事録で ON と RRP が別々に、説明の無い略語として報告されていた。例文は自作。

const NO_WORDS: DefinitionWords = { markers: [], verbs: [] };

const explainedAt = (text: string, acronym: string, at: number): boolean => expansionAt(NO_WORDS)(text, acronym, at);
const explained = (text: string, acronym: string): boolean => explainedAt(text, acronym, text.indexOf(acronym));

/** [何の形か, 例文, 見る略語]。 */
type Case = readonly [string, string, string];

const EXPLAINED: readonly Case[] = [
  ["2 語の最初", "the overnight reverse repurchase agreement (ON RRP) facility", "ON"],
  ["2 語の最後", "the overnight reverse repurchase agreement (ON RRP) facility", "RRP"],
  ["3 語の真ん中", "the long name (AB CDE FG) here", "CDE"],
  ["引用符に包む", "the long name (“ON RRP”) here", "ON"],
  ["全角の括弧", "翌日物リバースレポ（ON RRP）の残高", "RRP"],
  ["& と - を含む語", "the index (S&P GSCI) and (US-EU TTC) here", "GSCI"],
];

const REPORTED: readonly Case[] = [
  ["括弧の中に小文字の語", "the facility (see ON RRP) here", "RRP"],
  ["括弧の中の列挙（読点）", "the agencies (EPA, FDIC) here", "EPA"],
  ["括弧の外の並び", "use AWS KMS today", "AWS"],
  ["括弧の前の並びの頭（括弧の直前の語だけが展開される）", "use AWS KMS (Key Management Service) today", "AWS"],
  ["括弧が閉じない", "the facility (ON RRP is used", "ON"],
  ["2 つの語の間に空白が 2 つ", "the facility (ON  RRP) here", "ON"],
  ["1 文字の語と並ぶ", "the facility (A RRP) here", "RRP"],
  ["数字を含む語と並ぶ", "the facility (ON RRP2) here", "ON"],
];

describe("expansionAt: 括弧の中の、空白で繋いだ略語", () => {
  EXPLAINED.forEach(([form, text, acronym]) => {
    it(`valid: ${form}`, () => assert.equal(explained(text, acronym), true));
  });

  REPORTED.forEach(([form, text, acronym]) => {
    it(`invalid: ${form}`, () => assert.equal(explained(text, acronym), false));
  });

  it("異常な入力: 文の端の略語、空の本文", () => {
    assert.equal(explained("ON RRP", "ON"), false);
    assert.equal(explained("(ON RRP", "RRP"), false);
    assert.equal(explainedAt("", "ON", 0), false);
  });
});

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("undefined-acronym と空白で繋いだ略語", () => {
  it("en: 括弧で展開した ON RRP は、後ろで並べて使っても数えない", () => {
    const source =
      "# Notes\n\nTake-up at the overnight reverse repurchase agreement (ON RRP) facility fell. Usage of the ON RRP facility was flat. The SRE joins.\n";
    assert.deepEqual(reported(en, source), ["SRE"]);
  });

  it("en: 括弧の中に小文字の語があれば、展開ではないので数える", () => {
    assert.deepEqual(reported(en, "# Notes\n\nThe facility (see ON RRP) fell. The SRE joins.\n"), ["ON", "RRP", "SRE"]);
  });

  it("ja: 全角の括弧で展開した ON RRP は数えない", () => {
    assert.deepEqual(reported(ja, "# 手引き\n\n翌日物リバースレポ（ON RRP）の残高を見ます。SREも見ます。\n"), ["SRE"]);
  });
});
