import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import {
  intervalOf,
  isTotalOf,
  labelsIn,
  sumOf,
  writtenLike,
  type InstallmentAmount,
  type InstallmentWords,
  type Part,
} from "../packages/chaff/src/structure/installment-total.ts";
import { isWholeSeries, sectionsOf } from "../packages/chaff/src/structure/installment-fee.ts";

// 回数×毎回の額と合わないお支払総額（installment-total-mismatch）。

const RULE = "installment-total-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["payments"])} = ${String(finding.values["sum"])} / ${String(finding.values["total"])}`);

const jaDoc = (...lines: string[]): string[] => found(["# 分割払いのご案内", "", ...lines].join("\n"), ja);
const enDoc = (...lines: string[]): string[] => found(["# Installment Plan", "", ...lines].join("\n"), en);

const yen = (value: number, offset = 0, written = `${value.toLocaleString("en-US")}円`): InstallmentAmount & { written: string } => ({
  offset,
  end: offset + written.length,
  currency: "JPY",
  value,
  scale: undefined,
  written,
});

const part = (count: number, amount: InstallmentAmount & { written: string }): Part => ({ count, amount, written: amount.written });

const words: InstallmentWords = {
  labels: { count: ["お支払回数"], each: ["毎月のお支払額"], first: ["初回", "初回お支払額"], last: ["最終回"], total: ["お支払総額", "Total of payments"] },
  units: ["回"],
  qualifiers: [],
  links: ["は"],
  per: ["×"],
  rounding: [],
  skips: [],
  markers: [],
  connectors: [],
  numberWords: [],
};

describe("installment-total pieces", () => {
  it("intervalOf allows half the last written digit, with a word of scale and with cents", () => {
    assert.deepEqual(intervalOf(yen(32800), "32,800円"), { low: 32799.5, high: 32800.5 });
    assert.deepEqual(intervalOf({ offset: 0, end: 6, currency: "JPY", value: 98000, scale: 10000 }, "9.8万円"), { low: 97500, high: 98500 });
    const cents = intervalOf({ offset: 0, end: 7, currency: "USD", value: 550.53, scale: undefined }, "$550.53");
    assert.ok(Math.abs(cents.low - 550.525) < 1e-9 && Math.abs(cents.high - 550.535) < 1e-9);
  });

  it("sumOf adds first + each × rest + last, and isTotalOf accepts only a total inside the rounding", () => {
    const sum = sumOf([part(1, yen(33000)), part(58, yen(32800)), part(1, yen(32760))]);
    assert.equal((sum.low + sum.high) / 2, 33000 + 58 * 32800 + 32760);
    assert.equal(isTotalOf({ low: 1968160, high: 1968160 }, sum), true);
    assert.equal(isTotalOf({ low: 1968180, high: 1968180 }, sum), true);
    assert.equal(isTotalOf({ low: 1968300, high: 1968300 }, sum), false);
    assert.equal(isTotalOf({ low: 0, high: 0 }, sumOf([])), true);
  });

  it("writtenLike writes the sum as the payment is written", () => {
    assert.equal(writtenLike(1971720, part(60, yen(32862))), "1,971,720円");
    assert.equal(writtenLike(2544, part(24, { ...yen(106), currency: "USD", written: "$106.00" })), "$2,544.00");
    assert.equal(writtenLike(1971720, part(60, { ...yen(32862), scale: 10000, written: "3.2862万円" })), "1,971,720");
  });

  it("labelsIn gives each label its kind and lets the longer label win", () => {
    assert.deepEqual(
      labelsIn("初回お支払額 33,000円、毎月のお支払額 32,800円、お支払総額 1,968,000円", words).map((label) => label.kind),
      ["first", "each", "total"],
    );
    assert.deepEqual(
      labelsIn("Total of payments: $25,800", words).map((label) => label.kind),
      ["total"],
    );
    assert.deepEqual(labelsIn("ご契約日：2026年10月27日", words), []);
  });
});

describe("installment-total-mismatch (ja)", () => {
  it("flags a monthly payment that does not make the total", () => {
    assert.deepEqual(jaDoc("- お支払回数：24回", "- 毎月のお支払額：10,600円", "- お支払総額：249,600円"), ["10,600円 × 24 = 254,400円 / 249,600円"]);
    assert.deepEqual(jaDoc("お支払回数 60回、毎月のお支払額 32,800円、お支払総額 1,970,000円。"), ["32,800円 × 60 = 1,968,000円 / 1,970,000円"]);
  });

  it("is silent when the payments make the total, within a yen of rounding each", () => {
    assert.deepEqual(jaDoc("- お支払回数：24回", "- 毎月のお支払額：10,400円", "- お支払総額：249,600円"), []);
    assert.deepEqual(jaDoc("お支払回数 60回、毎月のお支払額 32,800円、お支払総額 1,968,000円。"), []);
    assert.deepEqual(jaDoc("- お支払回数：60回", "- 毎月のお支払額：32,826円", "- お支払総額：1,969,575円"), []);
  });

  it("adds a first and a final payment as written", () => {
    const lines = ["- お支払回数：60回", "- 初回お支払額：33,000円", "- 2回目以降：32,800円"];
    assert.deepEqual(jaDoc(...lines, "- お支払総額：1,968,200円"), []);
    assert.deepEqual(jaDoc(...lines, "- お支払総額：1,968,000円"), ["33,000円 + 32,800円 × 59 = 1,968,200円 / 1,968,000円"]);
    assert.deepEqual(jaDoc(...lines, "- 最終回：32,500円", "- お支払総額：1,967,900円"), []);
  });

  it("reads a sentence of payments without labels", () => {
    assert.deepEqual(jaDoc("お支払いは 33,000円×1回、32,800円×59回 です。", "", "お支払総額：1,968,200円"), []);
    assert.deepEqual(jaDoc("お支払いは 33,000円×1回、32,800円×59回 です。", "", "お支払総額：1,969,000円"), [
      "33,000円 + 32,800円 × 59 = 1,968,200円 / 1,969,000円",
    ]);
  });

  it("does not add two repeated payments of one sentence, which are choices", () => {
    assert.deepEqual(jaDoc("12回×10,000円または24回×6,000円から選べます。", "", "お支払総額：120,000円"), []);
  });

  it("is silent on rough amounts, ranges, stated rounding, bonus payments and plans side by side", () => {
    assert.deepEqual(jaDoc("- お支払回数：60回", "- 毎月のお支払額：約32,800円", "- お支払総額：1,970,000円"), []);
    assert.deepEqual(jaDoc("- お支払回数：60回", "- 毎月のお支払額：32,800円〜33,000円", "- お支払総額：1,970,000円"), []);
    assert.deepEqual(jaDoc("- お支払回数：60回", "- 毎月のお支払額：32,800円", "- お支払総額：1,970,000円", "", "端数は初回のお支払いで調整します。"), []);
    assert.deepEqual(jaDoc("- お支払回数：60回", "- 毎月のお支払額：30,000円", "- ボーナス加算額：50,000円", "- お支払総額：2,300,000円"), []);
    assert.deepEqual(
      jaDoc("- お支払回数：36回", "- 毎月のお支払額：10,000円", "- お支払回数：48回", "- 毎月のお支払額：8,000円", "- お支払総額：380,000円"),
      [],
    );
  });

  it("is silent without a total, and does not read a date after 初回 or 最終回 as a payment", () => {
    assert.deepEqual(jaDoc("- お支払回数：60回", "- 毎月のお支払額：32,800円"), []);
    assert.deepEqual(
      jaDoc(
        "- 初回お支払日：2026年11月27日",
        "- お支払回数：24回",
        "- 毎月のお支払額：10,600円",
        "- お支払総額：249,600円",
        "",
        "最終回のお支払日：2028年10月10日",
      ),
      ["10,600円 × 24 = 254,400円 / 249,600円"],
    );
  });
});

describe("installment-total-mismatch (en)", () => {
  it("flags a monthly payment that does not make the total", () => {
    assert.deepEqual(enDoc("- Number of payments: 24", "- Monthly payment: $106.00", "- Total of payments: $2,496.00"), [
      "$106.00 × 24 = $2,544.00 / $2,496.00",
    ]);
    assert.deepEqual(enDoc("You will make 48 monthly payments of $537.50; total of payments $25,900."), ["$537.50 × 48 = $25,800.00 / $25,900"]);
  });

  it("is silent when the payments make the total, within half a cent each", () => {
    assert.deepEqual(enDoc("You will make 48 monthly payments of $537.50; total of payments $25,800."), []);
    assert.deepEqual(enDoc("- Number of payments: 48", "- Monthly payment: $550.53", "- Total of payments: $26,425.62"), []);
  });

  it("adds a final payment stated in the same sentence or under its label", () => {
    assert.deepEqual(enDoc("Your schedule: 47 payments of $550.53 and 1 final payment of $550.71.", "", "Total of payments: $26,425.62"), []);
    assert.deepEqual(enDoc("Your schedule: 47 payments of $550.53 and 1 final payment of $550.71.", "", "Total of payments: $26,452.62"), [
      "$550.53 × 47 + $550.71 = $26,425.62 / $26,452.62",
    ]);
    assert.deepEqual(enDoc("- Number of payments: 48", "- Monthly payment: $550.53", "- Final payment: $550.71", "- Total of payments: $26,425.62"), []);
  });

  it("is silent on rough amounts, a stated rounding, a balloon and a count that disagrees with the sentence", () => {
    assert.deepEqual(enDoc("- Number of payments: 48", "- Monthly payment: about $540", "- Total of payments: $26,425.44"), []);
    assert.deepEqual(enDoc("- Number of payments: 48", "- Monthly payment: $550.53", "- Total of payments: $26,500.00", "", "The final payment may vary."), []);
    assert.deepEqual(enDoc("- Number of payments: 48", "- Monthly payment: $400.00", "- Balloon payment: $5,000.00", "- Total of payments: $24,200.00"), []);
    assert.deepEqual(enDoc("Number of payments: 36", "", "You will make 48 monthly payments of $537.50; total of payments $25,900."), []);
  });

  it("does not add two repeated payments of one sentence, which are choices", () => {
    assert.deepEqual(enDoc("Choose either 12 payments of $100.00 or 24 payments of $60.00.", "", "Total of payments: $1,200.00"), []);
  });

  it("does not read a first payment date as a first payment", () => {
    assert.deepEqual(
      enDoc("- First payment date: December 16, 2026", "- Number of payments: 48", "- Monthly payment: $550.53", "- Total of payments: $26,425.44"),
      [],
    );
  });
});

// 分納の並びと同じ節の費用（修学旅行・林間学校の積立金）。文はすべて自作。
const jaTrip = (...lines: string[]): string[] => found(["# 修学旅行のお知らせ", "", "## 旅行代金", "", ...lines].join("\n"), ja);
const enTrip = (...lines: string[]): string[] => found(["# Year 9 Trip", "", "## Cost", "", ...lines].join("\n"), en);
const JA_FEE = "旅行代金は、1人あたり62,000円です。";
const JA_TABLE = ["積立金として次の2回に分けて納めていただきます。", "", "| 回 | 金額 | 納入期限 |", "| --- | --- | --- |"];
const EN_FEE = "The trip costs £300 per student.";

describe("installment-total-mismatch, numbered instalments against the fee", () => {
  it("flags instalments in a table or a list that do not make the fee (ja)", () => {
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 30,000円 | 2026年5月15日 |", "| 第2回 | 30,000円 | 2026年6月5日 |"), [
      "30,000円 + 30,000円 = 60,000円 / 62,000円",
    ]);
    assert.deepEqual(jaTrip("費用は、児童1人あたり13,000円です。学年積立金から引き落とします。", "", "- 第1回：8,000円", "- 第2回：6,000円"), [
      "8,000円 + 6,000円 = 14,000円 / 13,000円",
    ]);
  });

  it("flags instalments numbered in words, with a final one (en)", () => {
    assert.deepEqual(
      enTrip(
        EN_FEE,
        "",
        "The cost is paid in two instalments:",
        "",
        "| Instalment | Amount |",
        "| --- | --- |",
        "| 1st payment | £170 |",
        "| 2nd payment | £150 |",
      ),
      ["£170 + £150 = £320 / £300"],
    );
    assert.deepEqual(
      enTrip("The camp costs $130 per student. It is paid in three payments:", "", "- First payment: $50", "- Second payment: $40", "- Final payment: $50"),
      ["$50 + $40 + $50 = $140 / $130"],
    );
  });

  it("is silent when the instalments make the fee", () => {
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 32,000円 | 2026年5月15日 |", "| 第2回 | 30,000円 | 2026年6月5日 |"), []);
    assert.deepEqual(enTrip(EN_FEE, "", "Payments:", "", "- 1st payment: £150", "- 2nd payment: £150"), []);
    assert.deepEqual(enTrip("The camp costs $130 per student, paid in payments:", "", "- First payment: $70", "- Final payment: $60"), []);
  });

  it("counts a deposit listed as one of the instalments", () => {
    assert.deepEqual(enTrip(EN_FEE, "", "Payments:", "", "- Deposit: £50", "- 1st payment: £125", "- 2nd payment: £125"), []);
    assert.deepEqual(enTrip(EN_FEE, "", "Payments:", "", "- Deposit: £50", "- 1st payment: £150", "- 2nd payment: £150"), ["£50 + £150 + £150 = £350 / £300"]);
  });

  it("does not compare when a deposit is named outside the series", () => {
    assert.deepEqual(enTrip(EN_FEE, "A deposit of £50 was paid in March.", "", "Payments:", "", "- 1st payment: £150", "- 2nd payment: £100"), []);
    assert.deepEqual(
      jaTrip(JA_FEE, "申込金10,000円は別にお納めください。", "", ...JA_TABLE, "| 第1回 | 30,000円 | 5月15日 |", "| 第2回 | 22,000円 | 6月5日 |"),
      [],
    );
  });

  it("does not compare a series with a gap, a repeat or an unread amount", () => {
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 30,000円 | 5月15日 |", "| 第3回 | 30,000円 | 6月5日 |"), []);
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 30,000円 | 5月15日 |", "| 第1回 | 30,000円 | 6月5日 |"), []);
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 30,000円 | 5月15日 |", "| 第2回 | 未定 | 6月5日 |"), []);
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 30,000円 | 2,000円 |", "| 第2回 | 30,000円 | 2,000円 |"), []);
    assert.deepEqual(enTrip(EN_FEE, "", "Payments:", "", "- 1st payment: about £150", "- 2nd payment: £100"), []);
    assert.deepEqual(jaTrip(JA_FEE, "", ...JA_TABLE, "| 第1回 | 30,000円程度 | 5月15日 |", "| 第2回 | 30,000円 | 6月5日 |"), []);
  });

  it("does not compare when the section states two fees, none, or a fee in another currency", () => {
    assert.deepEqual(enTrip(EN_FEE, "The fee is £280 for siblings.", "", "Payments:", "", "- 1st payment: £150", "- 2nd payment: £100"), []);
    assert.deepEqual(enTrip("Payments:", "", "- 1st payment: £150", "- 2nd payment: £100"), []);
    assert.deepEqual(enTrip("The trip costs $300 per student.", "", "Payments:", "", "- 1st payment: £150", "- 2nd payment: £100"), []);
  });

  it("does not compare a fee charged at each payment, which is not split", () => {
    assert.deepEqual(enTrip("The club fee is $50 per child.", "", "Payments:", "", "- Payment 1: $50", "- Payment 2: $50", "- Payment 3: $50"), []);
    assert.deepEqual(jaTrip("参加費は、1人あたり5,000円です。分納は次のとおりです。", "", "- 第1回：5,000円", "- 第2回：4,000円"), []);
  });

  it("compares a fee only with the instalments of its own section", () => {
    const lines = [
      "# Year 9 Trip",
      "",
      "## Overview",
      "",
      EN_FEE,
      "It is paid in instalments.",
      "",
      "## Payments",
      "",
      "Instalments:",
      "",
      "- 1st payment: £150",
      "- 2nd payment: £100",
    ];
    assert.deepEqual(found(lines.join("\n"), en), []);
  });

  it("does not read numbered items without a word of paying, or numbers that do not open an item", () => {
    assert.deepEqual(jaTrip("参加費は、1人あたり3,000円です。", "", "- 第1回：1,000円の教材", "- 第2回：1,000円の教材"), []);
    assert.deepEqual(enTrip(EN_FEE, "Your 1st payment of £150 and 2nd payment of £100 are taken online."), []);
    assert.deepEqual(jaTrip(JA_FEE, "積立金は次のとおりです。", "", "- 説明会の第1回：30,000円", "- 説明会の第2回：30,000円"), []);
  });
});

describe("installment-fee pieces", () => {
  const amount = { offset: 0, end: 1, currency: "GBP", value: 1, scale: undefined };
  const item = (number: number | undefined, read = true) => ({ line: { start: 0, end: 1 }, number, amount: read ? amount : undefined });

  it("takes a series numbered from 1 without gaps, a final one last, deposits anywhere", () => {
    assert.equal(isWholeSeries([item(1), item(2)]), true);
    assert.equal(isWholeSeries([item(undefined), item(1), item(2), item(Number.POSITIVE_INFINITY)]), true);
    assert.equal(isWholeSeries([item(1), item(3)]), false);
    assert.equal(isWholeSeries([item(2), item(3)]), false);
    assert.equal(isWholeSeries([item(1), item(1)]), false);
    assert.equal(isWholeSeries([item(Number.POSITIVE_INFINITY), item(1)]), false);
    assert.equal(isWholeSeries([item(1)]), false);
    assert.equal(isWholeSeries([]), false);
    assert.equal(isWholeSeries([item(undefined), item(undefined)]), false);
    assert.equal(isWholeSeries([item(1), item(2, false)]), false);
  });

  it("cuts the text at its headings", () => {
    assert.deepEqual(sectionsOf("abcdef", []), [{ start: 0, end: 6 }]);
    assert.deepEqual(sectionsOf("abcdef", [4, 2]), [
      { start: 0, end: 2 },
      { start: 2, end: 4 },
      { start: 4, end: 6 },
    ]);
    assert.deepEqual(sectionsOf("abcdef", [0, 9]), [{ start: 0, end: 6 }]);
  });
});
