import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { bandWordsOf } from "../packages/chaff/src/detectors/range-band.ts";
import { bandIn, figureIn, tierSetOf } from "../packages/chaff/src/structure/tier-threshold.ts";
import type { BandWords } from "../packages/chaff/src/structure/range-bands.ts";

// 会員の値が、書いたランクの基準に当たらない（tier-threshold-mismatch）。例の明細はすべて自作。

const RULE = "tier-threshold-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;
const doc = (lines: readonly string[]): string => [...lines, ""].join("\n");

const wordsOf = (adapter: typeof ja): BandWords => ({
  ...bandWordsOf(adapter.lexicons),
  units: (adapter.lexicons["tier-unit"] ?? []).map((entry) => ({ pattern: entry.pattern, kind: "integer", position: entry.position ?? "after" })),
  headings: [],
});
const JA_WORDS = wordsOf(ja);
const EN_WORDS = wordsOf(en);

const JA_TABLE = [
  "## ランクの基準",
  "",
  "| 会員ランク | 年間獲得ポイント | 還元率 |",
  "| --- | --- | --- |",
  "| レギュラー | 10,000ポイント未満 | 1% |",
  "| シルバー | 10,000ポイント以上50,000ポイント未満 | 2% |",
  "| ゴールド | 50,000ポイント以上 | 3% |",
];
const jaPoints = (tier: string, points: string, extra: readonly string[] = []): string =>
  doc(["# 明細", "", "## 会員情報", "", `- 会員ランク：${tier}`, `- 年間獲得ポイント：${points}`, ...extra, "", ...JA_TABLE]);

const JA_LIST = [
  "## ステータスの基準",
  "",
  "- ブロンズ：前年度のご宿泊数が10泊未満",
  "- シルバー：前年度のご宿泊数が10泊以上",
  "- ゴールド：前年度のご宿泊数が20泊以上",
  "- プラチナ：前年度のご宿泊数が30泊以上",
];
const jaNights = (status: string, nights: string): string =>
  doc(["# 明細", "", "## 会員資格", "", `- 会員ステータス：${status}`, `- 前年度のご宿泊数：${nights}`, "", ...JA_LIST]);

const EN_TABLE = [
  "## Tiers",
  "",
  "| Tier | Points earned in a year |",
  "| --- | --- |",
  "| Regular | Under 10,000 points |",
  "| Silver | 10,000 points to under 50,000 points |",
  "| Gold | 50,000 points or more |",
];
const enPoints = (tier: string, points: string): string =>
  doc(["# Statement", "", "## Membership", "", `- Tier: ${tier}`, `- Points earned last year: ${points}`, "", ...EN_TABLE]);

const EN_LIST = [
  "## Status levels",
  "",
  "- Bronze: under 10 nights stayed last year",
  "- Silver: 10 nights or more stayed last year",
  "- Gold: 20 nights or more stayed last year",
  "- Platinum: 30 nights or more stayed last year",
];
const enNights = (status: string, nights: string): string =>
  doc(["# Statement", "", "## Membership status", "", `- Status: ${status}`, `- Nights stayed last year: ${nights}`, "", ...EN_LIST]);

describe("tier-threshold-mismatch: the band a threshold text states", () => {
  it("reads a band inside a sentence of the threshold", () => {
    assert.deepEqual(bandIn("前年度のご宿泊数が30泊以上", JA_WORDS), { low: { value: 30, kind: "inclusive", decimals: 0 }, high: undefined, unit: "泊" });
    assert.equal(bandIn("10,000ポイント以上50,000ポイント未満", JA_WORDS)?.high?.value, 50000);
    assert.equal(bandIn("30 nights or more stayed last year", EN_WORDS)?.low?.value, 30);
    assert.equal(bandIn("under 10 nights stayed last year", EN_WORDS)?.high?.kind, "exclusive");
  });
  it("joins a lower end and an upper end written one after the other", () => {
    const band = bandIn("10,000 points to under 50,000 points", EN_WORDS);
    assert.equal(band?.low?.value, 10000);
    assert.equal(band?.high?.value, 50000);
    assert.equal(band?.high?.kind, "exclusive");
  });
  it("reads nothing without a tier unit, or with two separate bands", () => {
    ["3%", "前年度のご宿泊数", "30歳以上", "", "10泊以上、または5,000ポイント以上"].forEach((text) => assert.equal(bandIn(text, JA_WORDS), undefined, text));
    ["30 years or more", "Gold", "10 nights or more and 50 nights or more"].forEach((text) => assert.equal(bandIn(text, EN_WORDS), undefined, text));
  });
  it("reads a member's value only when it is one number in one tier unit", () => {
    assert.deepEqual(figureIn("42,400ポイント", JA_WORDS), { value: 42400, unit: "ポイント" });
    assert.deepEqual(figureIn("24 nights", EN_WORDS), { value: 24, unit: "night" });
    ["約42,400ポイント", "42,400", "24泊（予定）", "ゴールド"].forEach((text) => assert.equal(figureIn(text, JA_WORDS), undefined, text));
  });
});

describe("tier-threshold-mismatch: the tiers of a table or a list", () => {
  it("reads tiers whose bands meet or run up to the next tier", () => {
    const set = tierSetOf(
      [
        { name: "シルバー", text: "10泊以上" },
        { name: "ゴールド", text: "20泊以上" },
      ],
      JA_WORDS,
    );
    assert.equal(set?.tiers.length, 2);
  });
  it("reads no tiers that overlap, repeat a name, mix units, or stand alone", () => {
    const sets = [
      [
        { name: "シルバー", text: "10泊以上25泊以下" },
        { name: "ゴールド", text: "20泊以上" },
      ],
      [
        { name: "ゴールド", text: "10泊以上" },
        { name: "ゴールド", text: "20泊以上" },
      ],
      [
        { name: "シルバー", text: "10泊以上" },
        { name: "ゴールド", text: "5,000ポイント以上" },
      ],
      [
        { name: "シルバー", text: "10泊以上" },
        { name: "ゴールド", text: "10泊以上" },
      ],
      [{ name: "ゴールド", text: "20泊以上" }],
      [
        { name: "シルバー", text: "10泊以上" },
        { name: "ゴールド", text: "特典あり" },
      ],
    ];
    sets.forEach((entries) => assert.equal(tierSetOf(entries, JA_WORDS), undefined, JSON.stringify(entries)));
  });
});

describe("tier-threshold-mismatch: ja", () => {
  it("points at a member value below the stated tier's table band", () => {
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "42,400ポイント")), [
      "ランク「ゴールド」の基準は「50,000ポイント以上」ですが、「42,400ポイント」は「シルバー」の基準に当たります",
    ]);
    assert.deepEqual(findingsOf(jaPoints("シルバー", "52,400ポイント")), [
      "ランク「シルバー」の基準は「10,000ポイント以上50,000ポイント未満」ですが、「52,400ポイント」は「ゴールド」の基準に当たります",
    ]);
  });
  it("points at a member value below the stated tier of a list", () => {
    assert.deepEqual(findingsOf(jaNights("プラチナ", "24泊")), [
      "ランク「プラチナ」の基準は「前年度のご宿泊数が30泊以上」ですが、「24泊」は「ゴールド」の基準に当たります",
    ]);
  });
  it("says nothing when the value is in the stated tier's band", () => {
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "52,400ポイント")), []);
    assert.deepEqual(findingsOf(jaPoints("シルバー", "50,000ポイント")), [
      "ランク「シルバー」の基準は「10,000ポイント以上50,000ポイント未満」ですが、「50,000ポイント」は「ゴールド」の基準に当たります",
    ]);
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "50,000ポイント")), []);
    assert.deepEqual(findingsOf(jaNights("プラチナ", "34泊")), []);
    assert.deepEqual(findingsOf(jaNights("ブロンズ", "9泊")), []);
  });
  it("says nothing for a value above a tier written with its lower end only", () => {
    assert.deepEqual(findingsOf(jaNights("ゴールド", "35泊")), []);
  });
  it("says nothing when the tier's name is not the table's or the value is in another unit", () => {
    assert.deepEqual(findingsOf(jaPoints("ゴールド会員", "42,400ポイント")), []);
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "42泊")), []);
    assert.deepEqual(findingsOf(jaNights("プラチナ", "24,000ポイント")), []);
  });
  it("says nothing when the section states two values in the unit", () => {
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "42,400ポイント", ["- 今年の獲得ポイント：3,056ポイント"])), []);
  });
  it("does not count a balance or what the next tier needs as the member's value", () => {
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "42,400ポイント", ["- 今月末の残高：3,056ポイント"])), [
      "ランク「ゴールド」の基準は「50,000ポイント以上」ですが、「42,400ポイント」は「シルバー」の基準に当たります",
    ]);
    const needed = doc(["## 会員情報", "", "- 会員ランク：ゴールド", "- 次のランクまでに必要なポイント：42,400ポイント", "", ...JA_TABLE]);
    assert.deepEqual(findingsOf(needed), []);
  });
  it("says nothing when the value is in another section", () => {
    const source = doc(["## 会員情報", "", "- 会員ランク：ゴールド", "", "## 実績", "", "- 年間獲得ポイント：42,400ポイント", "", ...JA_TABLE]);
    assert.deepEqual(findingsOf(source), []);
  });
  it("says nothing when the line is not a tier label or the value is in a sentence", () => {
    assert.deepEqual(findingsOf(jaPoints("ゴールド", "42,400ポイント").replace("会員ランク：", "目標のランク：")), []);
    const sentence = doc(["## 会員情報", "", "会員ランクはゴールドで、年間獲得ポイントは42,400ポイントです。", "", ...JA_TABLE]);
    assert.deepEqual(findingsOf(sentence), []);
  });
  it("says nothing when the value falls in no tier", () => {
    const gapped = doc([
      "- 会員ランク：ゴールド",
      "- 年間獲得ポイント：12,000ポイント",
      "",
      "| ランク | 基準 |",
      "| --- | --- |",
      "| シルバー | 1,000ポイント以上10,000ポイント未満 |",
      "| ゴールド | 50,000ポイント以上 |",
    ]);
    assert.deepEqual(findingsOf(gapped), []);
  });
});

describe("tier-threshold-mismatch: en", () => {
  it("points at a member value below the stated tier's table band", () => {
    assert.deepEqual(findingsOf(enPoints("Gold", "42,400 points"), en), [
      'The tier "Gold" needs "50,000 points or more", but "42,400 points" falls in "Silver"',
    ]);
  });
  it("points at a member value below the stated tier of a list", () => {
    assert.deepEqual(findingsOf(enNights("Platinum", "24 nights"), en), [
      'The tier "Platinum" needs "30 nights or more stayed last year", but "24 nights" falls in "Gold"',
    ]);
  });
  it("reads a dollar threshold", () => {
    const source = doc(["- Your tier: Gold", "- Spent this year: $1,200", "", "- Silver: $500 or more", "- Gold: $2,000 or more"]);
    assert.deepEqual(findingsOf(source, en), ['The tier "Gold" needs "$2,000 or more", but "$1,200" falls in "Silver"']);
    assert.deepEqual(findingsOf(source.split("$1,200").join("$2,400"), en), []);
  });
  it("says nothing when the value is in the band or the name differs", () => {
    assert.deepEqual(findingsOf(enPoints("Gold", "52,400 points"), en), []);
    assert.deepEqual(findingsOf(enNights("Platinum", "34 nights"), en), []);
    assert.deepEqual(findingsOf(enNights("Gold", "35 nights"), en), []);
    assert.deepEqual(findingsOf(enNights("Platinum Elite", "24 nights"), en), []);
    assert.deepEqual(findingsOf(enNights("Platinum", "24 points"), en), []);
  });
  it("says nothing for a value that is not the one the tier is earned by", () => {
    const source = doc(["## Membership", "", "- Tier: Gold", "- Points needed for next reward: 42,400 points", "", ...EN_TABLE]);
    assert.deepEqual(findingsOf(source, en), []);
    assert.deepEqual(findingsOf(source.split("Points needed for next reward").join("Points balance"), en), []);
  });
  it("compares the tier's name with its letter case", () => {
    assert.deepEqual(findingsOf(enPoints("gold", "42,400 points"), en), []);
  });
  it("says nothing for a status that is not a tier", () => {
    const source = doc(["- Status: Active", "- Nights stayed last year: 24 nights", "", ...EN_LIST]);
    assert.deepEqual(findingsOf(source, en), []);
  });
});
