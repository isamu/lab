import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { abbreviates, expansionAt, type DefinitionWords } from "../packages/chaff/src/detectors/acronym-expansion.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 1 つの略語を空白で繋いだ 2 語以上で書き、括弧の中に置く形（overnight reverse repurchase agreement (ON RRP)）。
// FOMC の議事録で ON と RRP が別々に、説明の無い略語として報告されていた。例文は自作。

const NO_WORDS: DefinitionWords = { markers: [], verbs: [] };

const explainedAt = (text: string, acronym: string, at: number): boolean => expansionAt(NO_WORDS)(text, acronym, at);
const explained = (text: string, acronym: string): boolean => explainedAt(text, acronym, text.indexOf(acronym));

/** 括弧の前に置く、ON RRP の文字が順に拾える名前。 */
const NAME = "the overnight reverse repurchase agreement";

/** [何の形か, 例文, 見る略語]。 */
type Case = readonly [string, string, string];

const EXPLAINED: readonly Case[] = [
  ["2 語の最初", `${NAME} (ON RRP) facility`, "ON"],
  ["2 語の最後", `${NAME} (ON RRP) facility`, "RRP"],
  ["3 語の真ん中", "the alpha beta cde fg name (AB CDE FG) here", "CDE"],
  ["引用符に包む", `${NAME} (“ON RRP”) here`, "ON"],
  ["全角の括弧", `${NAME}（ON RRP）の残高`, "RRP"],
  ["& を含む語", "the Standard and Poor's Goldman Sachs Commodity Index (S&P GSCI) here", "GSCI"],
];

const REPORTED: readonly Case[] = [
  ["空白で並べた略語の列挙（名前から文字を拾えない）", "The regulators (SEC FINRA) issued guidance.", "SEC"],
  ["列挙の 2 語目", "The regulators (SEC FINRA) issued guidance.", "FINRA"],
  ["日本語の名前（文字を確かめられない）", "翌日物リバースレポ（ON RRP）の残高", "RRP"],
  ["名前の文字の順が違う", "the reverse overnight repurchase agreement (ON RRP) facility", "ON"],
  ["名前の頭の文字が語の頭にない", "the nonovernight reverse repurchase agreement (ON RRP) facility", "ON"],
  ["括弧の中に小文字の語", `${NAME} (see ON RRP) here`, "RRP"],
  ["括弧の中の列挙（読点）", `${NAME} (ON, RRP) here`, "ON"],
  ["括弧の外の並び", `${NAME}, ON RRP today`, "ON"],
  ["括弧の前の並びの頭（括弧の直前の語だけが展開される）", "use AWS KMS (Key Management Service) today", "AWS"],
  ["括弧が閉じない", `${NAME} (ON RRP is used`, "ON"],
  ["2 つの語の間に空白が 2 つ", `${NAME} (ON  RRP) here`, "ON"],
  ["1 文字の語と並ぶ", `${NAME} (O RRP) here`, "RRP"],
  ["数字を含む語と並ぶ", `${NAME} (ON RRP2) here`, "ON"],
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
    assert.equal(explained("(ON RRP)", "RRP"), false);
    assert.equal(explainedAt("", "ON", 0), false);
  });
});

describe("abbreviates", () => {
  it("valid: 語の頭から始まり、語の途中の文字も順に拾う", () => {
    assert.equal(abbreviates("overnight reverse repurchase agreement", "ON RRP"), true);
    assert.equal(abbreviates("Key Management Service", "KMS"), true);
    assert.equal(abbreviates("Standard and Poor's", "S&P"), true);
  });

  it("invalid: 順が違う、頭の文字が語の頭にない、文字が足りない", () => {
    assert.equal(abbreviates("reverse overnight repurchase", "ON RRP"), false);
    assert.equal(abbreviates("nonovernight reverse repurchase", "ON RRP"), false);
    assert.equal(abbreviates("the regulators", "SEC FINRA"), false);
  });

  it("invalid: 見るのは略語の文字数の 2 倍の語まで", () => {
    assert.equal(abbreviates("key one two three four five m", "KM"), false);
    assert.equal(abbreviates("key one two m", "KM"), true);
  });

  it("異常な入力: 空の名前、空の略語、英字の無い名前", () => {
    assert.equal(abbreviates("", "ON"), false);
    assert.equal(abbreviates("overnight", ""), false);
    assert.equal(abbreviates("翌日物リバースレポ", "ON RRP"), false);
  });
});

describe("undefined-acronym と空白で繋いだ略語", () => {
  it("en: 括弧で展開した ON RRP は、後ろで並べて使っても数えない", () => {
    const source =
      "# Notes\n\nTake-up at the overnight reverse repurchase agreement (ON RRP) facility fell. Usage of the ON RRP facility was flat. The SRE joins.\n";
    assert.deepEqual(reportedAcronyms(en, source), ["SRE"]);
  });

  it("en: 括弧の中に小文字の語があれば、展開ではないので数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe overnight reverse repurchase facility (see ON RRP) fell. The SRE joins.\n"), ["ON", "RRP", "SRE"]);
  });

  it("en: 空白で並べた略語の列挙は展開ではないので数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe regulators (SEC FINRA) issued guidance. The SRE joins.\n"), ["SEC", "FINRA", "SRE"]);
  });

  it("ja: 英語の名前を全角の括弧で展開した ON RRP は数えない", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\novernight reverse repurchase agreement（ON RRP）の残高を見ます。SREも見ます。\n"), ["SRE"]);
  });
});
