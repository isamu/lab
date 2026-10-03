import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { amountsIn, currencyMinorities, type CurrencyForm } from "../packages/chaff/src/detectors/currency-notation.ts";

// 通貨の書き方が混ざっている（currency-notation-consistency）。例文はすべて自作。

const RULE = "currency-notation-consistency";
const NORMAL_LIMIT = 34;

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const FORMS: readonly CurrencyForm[] = [
  { pattern: "¥", position: "before", currency: "JPY" },
  { pattern: "円", position: "after", currency: "JPY" },
  { pattern: "$", position: "before", currency: "USD" },
  { pattern: "US$", position: "before", currency: "USD" },
  { pattern: "USD", position: "before", currency: "USD" },
  { pattern: "USD", position: "after", currency: "USD" },
  { pattern: "ドル", position: "after", currency: "USD" },
  { pattern: "米ドル", position: "after", currency: "USD" },
];
const MULTIPLIERS = ["万", "億", "million"];

const formsIn = (text: string): string[] => amountsIn(text, FORMS, MULTIPLIERS).map((amount) => `${amount.written}=${amount.form}`);

const oddIn = (text: string): string[] => currencyMinorities(amountsIn(text, FORMS, MULTIPLIERS), NORMAL_LIMIT).map((found) => found.odd.written);

describe("currency-notation-consistency: 通貨の書き方が混ざっている", () => {
  it("同じ通貨の少ないほうの書き方を指す", () => {
    assert.deepEqual(findingsOf("基本料金は 3,000円、追加料金は 500円、送料は 800円 です。割引は ¥200 です。\n"), [
      "「¥200」と書いています（この文書はこの通貨をふつう「3,000円」のように書きます。4 箇所のうち 1 箇所が違う）",
    ]);
    assert.deepEqual(findingsOf("The base fee is $300, the add-on is $50 and shipping is $20. The discount is USD 10.\n", en), [
      '"USD 10" here, where the document usually writes this currency like "$300" (1 of 4)',
    ]);
  });

  it("金額の書き方を読む。長い記号（US$、米ドル）を先に、桁の語と全角も", () => {
    assert.deepEqual(formsIn("US$5、$3、100万円、5米ドル、USD 20、20 USD、１，２００円"), [
      "US$5=before:US$",
      "$3=before:$",
      "100万円=after:円",
      "5米ドル=after:米ドル",
      "USD 20=before:USD",
      "20 USD=after:USD",
      "１，２００円=after:円",
    ]);
  });

  it("通貨ごとに比べる。円とドルが並ぶのは混ざりではない", () => {
    assert.deepEqual(oddIn("100円、200円、$3、$4"), []);
  });

  it("少ないほうが三分の一を超えるか、同じ数なら使い分けと読む", () => {
    assert.deepEqual(oddIn("100円、200円、¥300、¥400、500円"), []);
    assert.deepEqual(oddIn("100円、¥300"), []);
    assert.deepEqual(oddIn("100円、200円、300円、¥400"), ["¥400"]);
  });

  it("英字の語の中（USDT）は通貨と読まない", () => {
    assert.deepEqual(formsIn("USDT 5 と 5USDC と $20AUD"), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("料金は 100円、200円、300円 です。`¥400` は例です。\n"), []);
  });

  it("空の文字列と書き方の無い言語", () => {
    assert.deepEqual(amountsIn("", FORMS, MULTIPLIERS), []);
    assert.deepEqual(amountsIn("100円 ¥200", [], []), []);
    assert.deepEqual(currencyMinorities([], NORMAL_LIMIT), []);
  });
});
