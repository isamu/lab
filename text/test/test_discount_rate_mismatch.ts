import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { discountIn, discountMatches, unitOf, type DiscountWord } from "../packages/chaff/src/structure/discount-rate.ts";

// 割引率が定価と単価から出る率と合わない（discount-rate-mismatch）。例の価格表はすべて自作。

const RULE = "discount-rate-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;
const doc = (lines: readonly string[]): string => [...lines, ""].join("\n");

const JA_LIST = ["定価は1枚8.0円（税抜）です。", ""];
const JA_HEAD = ["| ご注文数 | 1枚の単価（税抜） | 定価からの割引率 |", "| --- | --- | --- |"];
const EN_LIST = ["The list price is $0.080 per envelope, excluding tax.", ""];
const EN_HEAD = ["| Order quantity | Price per envelope | Discount from list price |", "| --- | --- | --- |"];

describe("discount-rate-mismatch: the discount as written", () => {
  it("reads a percentage, a reduction sign and tenths (1割5分 is 15%)", () => {
    assert.deepEqual(discountIn("10%"), { value: 10, decimals: 0, written: "10%" });
    assert.equal(discountIn("12.5 %")?.value, 12.5);
    assert.equal(discountIn("12.5%")?.decimals, 1);
    assert.equal(discountIn("△10%")?.value, 10);
    assert.equal(discountIn("1割")?.value, 10);
    assert.equal(discountIn("1割5分")?.value, 15);
    assert.equal(discountIn("0%")?.value, 0);
  });
  it("reads nothing else as a discount", () => {
    ["", "10", "100%", "150%", "約10%", "10%以上", "8.0円", "—", "abc", "10割"].forEach((text) => assert.equal(discountIn(text), undefined, text));
  });
});

describe("discount-rate-mismatch: the unit of a price", () => {
  const marks: DiscountWord[] = ["1", "/", "per"].map((pattern) => ({ pattern, role: "per" }));
  it("reads the word after a unit mark", () => {
    assert.equal(unitOf("1枚の単価（税抜）", marks), "枚");
    assert.equal(unitOf("単価（円/枚）", marks), "枚");
    assert.equal(unitOf("Price per envelope (excl. tax)", marks), "envelope");
  });
  it("reads no unit inside a number or a word, or when two are named", () => {
    assert.equal(unitOf("21枚", marks), undefined);
    assert.equal(unitOf("10〜49箱", marks), undefined);
    assert.equal(unitOf("upper box", marks), undefined);
    assert.equal(unitOf("1枚と1箱", marks), undefined);
    assert.equal(unitOf("単価", marks), undefined);
  });
});

describe("discount-rate-mismatch: the arithmetic", () => {
  it("the rate rounded down, to nearest or up at its digits", () => {
    assert.equal(discountMatches(8, 7.2, 10, 0, 0.1), true);
    assert.equal(discountMatches(1980, 1683, 15, 0, 1), true);
    assert.equal(discountMatches(3, 2.6, 13, 0, 0.1), true);
    assert.equal(discountMatches(3, 2.6, 14, 0, 0.1), true);
    assert.equal(discountMatches(3, 2.6, 13.3, 1, 0.1), true);
  });
  it("a tier price the rate gives once rounded to the price's digits", () => {
    assert.equal(discountMatches(1980, 1680, 15, 0, 1), true);
  });
  it("a rate that is off", () => {
    assert.equal(discountMatches(8, 6.8, 12, 0, 0.1), false);
    assert.equal(discountMatches(8, 7.2, 15, 0, 0.1), false);
    assert.equal(discountMatches(3, 2.6, 13.0, 1, 0.1), true);
    assert.equal(discountMatches(3, 2.6, 12.5, 1, 0.01), false);
  });
});

describe("discount-rate-mismatch: a list price in a sentence", () => {
  it("ja: points at the discount the tier price does not give", () => {
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...JA_HEAD, "| 1〜9箱 | 8.0円 | 0% |", "| 10〜49箱 | 7.2円 | 10% |", "| 50〜99箱 | 6.8円 | 12% |"])), [
      "割引率「12%」が、定価「8.0円」と単価「6.8円」から出る率（15%）と合いません",
    ]);
  });
  it("ja: says nothing when every discount is the tier price's", () => {
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...JA_HEAD, "| 1〜9箱 | 8.0円 | 0% |", "| 10〜49箱 | 7.2円 | 10% |", "| 50〜99箱 | 6.8円 | 15% |"])), []);
    assert.deepEqual(findingsOf(doc(["定価：1,980円", "", "| 数量 | 単価 | 割引率 |", "| --- | --- | --- |", "| 10個以上 | 1,680円 | 15% |"])), []);
  });
  it("en: points at the discount the tier price does not give", () => {
    assert.deepEqual(findingsOf(doc([...EN_LIST, ...EN_HEAD, "| 10–49 boxes | $0.072 | 10% |", "| 50–99 boxes | $0.068 | 12% |"]), en), [
      "The discount 12% is not what the list price $0.080 and the price $0.068 give (15%)",
    ]);
    assert.deepEqual(findingsOf(doc([...EN_LIST, ...EN_HEAD, "| 10–49 boxes | $0.072 | 10% |", "| 50–99 boxes | $0.068 | 15% |"]), en), []);
  });
  it("en: a list price on a labelled line", () => {
    assert.deepEqual(
      findingsOf(doc(["List price: $20.00", "", "| Quantity | Unit price | Discount |", "| --- | --- | --- |", "| 100+ | $17.00 | 20% |"]), en),
      ["The discount 20% is not what the list price $20.00 and the price $17.00 give (15%)"],
    );
  });
});

describe("discount-rate-mismatch: a list price in a row or a column", () => {
  it("ja: a 定価 row of the tier table itself", () => {
    const rows = ["| ご注文数 | 単価 | 割引率 |", "| --- | --- | --- |", "| 定価 | 500円 | — |", "| 100個以上 | 450円 | 20% |"];
    assert.deepEqual(findingsOf(doc(rows)), ["割引率「20%」が、定価「500円」と単価「450円」から出る率（10%）と合いません"]);
  });
  it("ja: a two-cell row of another table", () => {
    const rows = [
      "| 項目 | 内容 |",
      "| --- | --- |",
      "| 定価 | 500円 |",
      "",
      "| ご注文数 | 単価 | 割引率 |",
      "| --- | --- | --- |",
      "| 100個以上 | 450円 | 20% |",
    ];
    assert.deepEqual(findingsOf(doc(rows)), ["割引率「20%」が、定価「500円」と単価「450円」から出る率（10%）と合いません"]);
  });
  it("en: a list price column, row by row", () => {
    const rows = [
      "| Item | List price | Discount | Sale price |",
      "| --- | --- | --- | --- |",
      "| Pen | $4.00 | 25% | $3.00 |",
      "| Pad | $10.00 | 25% | $8.00 |",
    ];
    assert.deepEqual(findingsOf(doc(rows), en), ["The discount 25% is not what the list price $10.00 and the price $8.00 give (20%)"]);
  });
});

describe("discount-rate-mismatch: what is not compared", () => {
  it("no list price, or two different ones", () => {
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 50〜99箱 | 6.8円 | 12% |"])), []);
    assert.deepEqual(findingsOf(doc(["定価は1枚8.0円です。", "", "別の品の定価は1枚9.0円です。", "", ...JA_HEAD, "| 50〜99箱 | 6.8円 | 12% |"])), []);
  });
  it("a list price in another unit or currency", () => {
    assert.deepEqual(findingsOf(doc(["定価は1箱8,000円です。", "", ...JA_HEAD, "| 50〜99箱 | 6.8円 | 12% |"])), []);
    assert.deepEqual(findingsOf(doc(["The list price is €0.080 per envelope.", "", ...EN_HEAD, "| 50–99 boxes | $0.068 | 12% |"]), en), []);
    assert.deepEqual(findingsOf(doc(["The list price is $80.00 per box.", "", ...EN_HEAD, "| 50–99 boxes | $0.068 | 12% |"]), en), []);
    const column = [
      "| Quantity | List price per box | Price per envelope | Discount |",
      "| --- | --- | --- | --- |",
      "| 50–99 boxes | $80.00 | $0.068 | 15% |",
    ];
    assert.deepEqual(findingsOf(doc(column), en), []);
    const row = ["| Item | Value |", "| --- | --- |", "| List price per box | $80.00 |", "", ...EN_HEAD, "| 50–99 boxes | $0.068 | 12% |"];
    assert.deepEqual(findingsOf(doc(row), en), []);
  });
  it("an amount after a list word that is not the list price", () => {
    assert.deepEqual(findingsOf(doc(["定価から1枚あたり1.2円を割り引きます。", "", ...JA_HEAD, "| 50〜99箱 | 6.8円 | 12% |"])), []);
    assert.deepEqual(findingsOf(doc(["定価から10円を割り引きます。", "", ...JA_HEAD, "| 50〜99箱 | 6.8円 | 12% |"])), []);
  });
  it("a rate column that is a tax rate or a markup", () => {
    const tax = ["| 品名 | 単価 | 割引率（消費税率） |", "| --- | --- | --- |", "| 封筒 | 6.8円 | 10% |"];
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...tax])), []);
    const markup = ["| Item | Unit price | Discount (markup) |", "| --- | --- | --- |", "| Envelope | $0.068 | 12% |"];
    assert.deepEqual(findingsOf(doc([...EN_LIST, ...markup]), en), []);
  });
  it("a price not below the list price (an invoice's price before its discount), and two price columns", () => {
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...JA_HEAD, "| 1箱 | 9.0円 | 5% |"])), []);
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...JA_HEAD, "| 1箱 | 8.0円 | 5% |"])), []);
    const two = ["| ご注文数 | 単価 | 卸価格 | 割引率 |", "| --- | --- | --- | --- |", "| 50〜99箱 | 6.8円 | 6.8円 | 12% |"];
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...two])), []);
  });
  it("a price after the discount is a price column, not a discount (割引後の単価)", () => {
    const rows = ["| ご注文数 | 割引後の単価 | 割引率 |", "| --- | --- | --- |", "| 50〜99箱 | 6.8円 | 12% |"];
    assert.deepEqual(findingsOf(doc([...JA_LIST, ...rows])), ["割引率「12%」が、定価「8.0円」と単価「6.8円」から出る率（15%）と合いません"]);
  });
});
