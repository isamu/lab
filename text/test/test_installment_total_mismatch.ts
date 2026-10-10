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
