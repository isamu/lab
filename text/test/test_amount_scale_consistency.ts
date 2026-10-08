import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { amountScale } from "../packages/chaff/src/detectors/amount-scale.ts";
import { amountValue, scaleMixes, type ScaleWord, type ScaledAmount } from "../packages/chaff/src/structure/amount-scale.ts";

// 同じ桁の金額を二通りに書いている（amount-scale-consistency）。例文はすべて自作。

const RULE = "amount-scale-consistency";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const WORDS: readonly ScaleWord[] = [
  { word: "千", value: 1_000 },
  { word: "万", value: 10_000 },
  { word: "億", value: 100_000_000 },
  { word: "million", value: 1_000_000 },
];

const MAN = 10_000;

const amount = (offset: number, written: string, value: number, unit: number | undefined, currency = "JPY"): ScaledAmount => ({
  offset,
  written,
  currency,
  value,
  unit,
});

const oddOf = (amounts: readonly ScaledAmount[]): string[] => scaleMixes(amounts).map((mix) => `${mix.odd.written}<${mix.usual.written}`);

describe("amount-scale-consistency: 同じ桁の金額を二通りに書いている", () => {
  it("同じ桁で少ないほうの書き方を指す", () => {
    assert.deepEqual(findingsOf("お見積もりの総額は55万円（税込）です。内訳は、設計費30万円、制作費250,000円です。\n"), [
      "「250,000円」と書いています（この文書は同じ桁の金額を「55万円」のように書きます）",
    ]);
    assert.deepEqual(findingsOf("The total is $4 million: $1.5 million for design and $2,500,000 for building.\n", en), [
      '"$2,500,000" here, where the document writes amounts of this size like "$4 million"',
    ]);
  });

  it("同じ金額を二通りに書けば、後に書いたほうを指す", () => {
    assert.deepEqual(findingsOf("損害の額は5,000,000円を上限とする。\n\n前項の上限額500万円には、弁護士費用を含む。\n"), [
      "「500万円」と書いています（この文書は同じ桁の金額を「5,000,000円」のように書きます）",
    ]);
  });

  it("その桁で同じ数なら、その桁より大きい金額の書き方で決める", () => {
    assert.deepEqual(oddOf([amount(0, "30,000円", 30_000, undefined), amount(10, "55万円", 550_000, MAN), amount(20, "3万円", 30_000, MAN)]), [
      "30,000円<3万円",
    ]);
  });

  it("桁の違う金額は比べない。小さな金額を数字で、大きな金額を万で書くのはふつう", () => {
    assert.deepEqual(findingsOf("月額480円のプランと、年額3,000円のプランがあります。初期費用は30万円、保守は100万円です。\n"), []);
    assert.deepEqual(findingsOf("The fee is $480 a month, and the setup is $3 million.\n", en), []);
  });

  it("端数のある金額は万で書けないので比べない", () => {
    assert.deepEqual(findingsOf("売上は1,234,567円で、目標の500万円に届かなかった。\n"), []);
    assert.deepEqual(oddOf([amount(0, "250,500円", 250_500, undefined), amount(10, "30万円", 300_000, MAN)]), []);
  });

  it("単位に満たない桁の語の金額（£0.2 million）は、並ぶ大きな金額に合わせた書き方と読んで比べない", () => {
    assert.deepEqual(findingsOf("There was £15.6 million spent in August, an increase of £0.2 million. Outside the sequence, use £200,000.\n", en), []);
    assert.deepEqual(oddOf([amount(0, "0.5万円", 5_000, MAN), amount(10, "5,000円", 5_000, undefined)]), []);
  });

  it("通貨ごとに比べる", () => {
    assert.deepEqual(oddOf([amount(0, "$300,000", 300_000, undefined, "USD"), amount(10, "30万円", 300_000, MAN)]), []);
  });

  it("一つの書き方しか無い文書と、空の入力", () => {
    assert.deepEqual(findingsOf("設計費30万円、制作費25万円、合計55万円です。\n"), []);
    assert.deepEqual(findingsOf("設計費300,000円、制作費250,000円です。\n"), []);
    assert.deepEqual(scaleMixes([]), []);
    assert.deepEqual(oddOf([amount(0, "0円", 0, undefined), amount(5, "0万円", 0, MAN)]), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("設計費30万円、制作費25万円です。`250,000円` は例です。\n"), []);
  });

  it("表の升の金額も比べる。見積書や請求書の金額は表にある", () => {
    const table = "| 品目 | 金額 |\n| --- | --- |\n| 設計 | 1,200,000円 |\n| 合計 | 1,320,000円 |\n";
    assert.deepEqual(findingsOf(`# 見積\n\nお見積金額は132万円です。\n\n${table}`), [
      "「132万円」と書いています（この文書は同じ桁の金額を「1,200,000円」のように書きます）",
    ]);
    assert.deepEqual(findingsOf(`# 見積\n\nお見積金額は1,320,000円です。\n\n${table}`), []);
    const enTable = "| Item | Amount |\n| --- | --- |\n| Design | $1,200,000 |\n| Total | $1,320,000 |\n";
    assert.deepEqual(findingsOf(`# Quote\n\nThe quoted amount is $1.32 million.\n\n${enTable}`, en), [
      '"$1.32 million" here, where the document writes amounts of this size like "$1,200,000"',
    ]);
  });

  it("本文の丸めた額（概算・上限）は、表の細かい金額と比べない。表に同じ金額があれば比べる", () => {
    const table = "| 項目 | 金額 |\n| --- | --- |\n| 本体 | 1,200,000円 |\n| 税込合計 | 1,320,000円 |\n";
    assert.deepEqual(findingsOf(`# 見積\n\n総額は約130万円を見込んでいます。\n\n${table}`), []);
    assert.deepEqual(findingsOf(`# 見積\n\n予算の上限は150万円です。\n\n${table}`), []);
    assert.deepEqual(findingsOf(`# 見積\n\n本体は120万円です。\n\n${table}`), [
      "「120万円」と書いています（この文書は同じ桁の金額を「1,200,000円」のように書きます）",
    ]);
    const enTable = "| Item | Amount |\n| --- | --- |\n| Base | $1,200,000 |\n| Total | $1,320,000 |\n";
    assert.deepEqual(findingsOf(`# Budget\n\nThe project will cost about $1.3 million.\n\n${enTable}`, en), []);
    assert.deepEqual(findingsOf(`# Budget\n\nThe budget cap is $1.5 million.\n\n${enTable}`, en), []);
  });

  it("目安の印（約、程度、about）の付いた金額は比べない", () => {
    assert.deepEqual(findingsOf("設計費は300,000円、制作費は250,000円、保守費は約30万円です。\n"), []);
    assert.deepEqual(findingsOf("設計費は300,000円、制作費は250,000円、保守費は30万円程度です。\n"), []);
    assert.deepEqual(findingsOf("Design is $300,000, build is $250,000, and support is about $0.3 million.\n", en), []);
  });

  it("表の升のコードの中と、コードの塊の中の表の形は読まない", () => {
    assert.deepEqual(findingsOf("設計費30万円、制作費25万円です。\n\n| 例 | 書き方 |\n| --- | --- |\n| 数字 | `250,000円` |\n"), []);
    assert.deepEqual(findingsOf("# 例\n\n```\n| 項目 | 金額 |\n| --- | --- |\n| 設計 | 30万円 |\n| 制作 | 250,000円 |\n```\n"), []);
  });

  it("升にコードのある行も、ほかの升の金額は比べる", () => {
    assert.deepEqual(findingsOf("# 見積\n\n| 項目 | 金額 |\n| --- | --- |\n| `設計` | 30万円 |\n| 制作 | 25万円 |\n| 研修 | 250,000円 |\n"), [
      "「250,000円」と書いています（この文書は同じ桁の金額を「30万円」のように書きます）",
    ]);
  });

  it("金額の値を読む。大きい桁から続けて書いた金額（1億2,000万円）も一つに", () => {
    assert.equal(amountValue("1億2,000万", WORDS), 120_000_000);
    assert.equal(amountValue("3万5千", WORDS), 35_000);
    assert.equal(amountValue("1.5 million", WORDS), 1_500_000);
    assert.equal(amountValue("２５０，０００", WORDS), 250_000);
    assert.equal(amountValue("250,000", WORDS), 250_000);
    assert.equal(amountValue("12 dozen", WORDS), undefined);
    assert.equal(amountValue("", WORDS), undefined);
    assert.deepEqual(findingsOf("総額は1億2,000万円で、うち120,000,000円を前払いとする。前払いの残りは1億円とする。\n"), [
      "「120,000,000円」と書いています（この文書は同じ桁の金額を「1億2,000万円」のように書きます）",
    ]);
  });

  it("大きい桁から続けて書いた金額を指すときは、その頭（1億）から指す", () => {
    const source = "総額は1億2,000万円です。前払いは120,000,000円、残りも120,000,000円です。\n";
    const found = amountScale(buildDocument("a.md", source, ja), { limit: 1 });
    assert.deepEqual(
      found.map((finding) => [finding.values["written"], finding.values["offset"]]),
      [["1億2,000万円", source.indexOf("1億")]],
    );
  });
});
