import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { reversedAmountRanges, type AmountRangeWords, type RangeAmount } from "../packages/chaff/src/structure/amount-range.ts";

// 金額の範囲の上限が下限より小さい（amount-range-reversed）。

const RULE = "amount-range-reversed";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["range"]));

const doc = (...lines: string[]): string => ["# Posting", "", ...lines, ""].join("\n");

describe("amount-range-reversed, Japanese", () => {
  it("two amounts joined by a range mark, the second smaller", () => {
    assert.deepEqual(found(doc("給与は月給30万円〜25万円です。"), ja), ["30万円〜25万円"]);
    assert.deepEqual(found(doc("想定年収：600万円～450万円"), ja), ["600万円～450万円"]);
    assert.deepEqual(found(doc("給与は月給25万円〜30万円です。"), ja), []);
  });

  it("a unit written once reads the first number with it", () => {
    assert.deepEqual(found(doc("月給30〜25万円"), ja), ["30〜25万円"]);
    assert.deepEqual(found(doc("月給30万〜25万円"), ja), ["30万〜25万円"]);
    assert.deepEqual(found(doc("月給25〜30万円"), ja), []);
    assert.deepEqual(found(doc("想定年収：1,370万～1,050万円"), ja), ["1,370万～1,050万円"]);
    assert.deepEqual(found(doc("想定年収：1,050万～1,370万円"), ja), []);
  });

  it("a shared unit ten times apart is not a reversal (5,000〜1万円 is 5,000円 to 1万円)", () => {
    assert.deepEqual(found(doc("参加費は5,000〜1万円です。"), ja), []);
  });

  it("から … まで is a range; から alone with a change of price is not", () => {
    assert.deepEqual(found(doc("予算は50万円から40万円までとします。"), ja), ["50万円から40万円"]);
    assert.deepEqual(found(doc("月額を5,000円から3,000円に値下げします。"), ja), []);
    assert.deepEqual(found(doc("料金を5,000円〜3,000円に改定しました。"), ja), []);
  });

  it("labelled lower and upper bounds on one line", () => {
    assert.deepEqual(found(doc("給与：下限30万円・上限25万円"), ja), ["30万円・上限25万円"]);
    assert.deepEqual(found(doc("上限は25万円、下限は30万円です。"), ja), ["25万円、下限は30万円"]);
    assert.deepEqual(found(doc("給与：下限25万円・上限30万円"), ja), []);
  });

  it("different currencies, words between, a sum, and numbers without a currency are not compared", () => {
    assert.deepEqual(found(doc("価格は30ドル〜25円です。"), ja), []);
    assert.deepEqual(found(doc("基本給30万円、手当は2万円〜1万円の範囲で支給します。"), ja), ["2万円〜1万円"]);
    assert.deepEqual(found(doc("基本給30万円、手当2万円です。"), ja), []);
    assert.deepEqual(found(doc("差額は5,000円-2,000円=3,000円です。"), ja), []);
    assert.deepEqual(found(doc("差額は(5,000円-2,000円)=3,000円です。"), ja), []);
    assert.deepEqual(found(doc("式は3,000円=5,000円-2,000円です。"), ja), []);
    assert.deepEqual(found(doc("対象は第10版〜第3版、120〜90ページです。"), ja), []);
  });
});

describe("amount-range-reversed, English", () => {
  it("two amounts joined by a dash or to, the second smaller", () => {
    assert.deepEqual(found(doc("- Salary: $90,000–$70,000 a year, depending on experience")), ["$90,000–$70,000"]);
    assert.deepEqual(found(doc("Rent is ¥5,000 to ¥3,000 per month.")), ["¥5,000 to ¥3,000"]);
    assert.deepEqual(found(doc("- Salary: $70,000–$90,000 a year")), []);
  });

  it("a currency or a k written once", () => {
    assert.deepEqual(found(doc("The band is $90–70k.")), ["$90–70k"]);
    assert.deepEqual(found(doc("The band is $90,000–70,000.")), ["$90,000–70,000"]);
    assert.deepEqual(found(doc("The budget is $1.5–1.2 million.")), ["$1.5–1.2 million"]);
    assert.deepEqual(found(doc("The band is $70–90k.")), []);
    assert.deepEqual(found(doc("Salary is $90K–$70K.")), ["$90K–$70K"]);
    assert.deepEqual(found(doc("Shares traded at $2.22 - 2.15 and ¥7,000-4,000.")), ["$2.22 - 2.15", "¥7,000-4,000"]);
    assert.deepEqual(found(doc("Shares traded at $2.15 - 2.22 and ¥4,000-7,000.")), []);
  });

  it("a change of price is not a range", () => {
    assert.deepEqual(found(doc("The fee was reduced from $90 to $70.")), []);
    assert.deepEqual(found(doc("Prices dropped from $90 to $70 last week.")), []);
    assert.deepEqual(found(doc("We cut the plan from $90 to $70.")), []);
    assert.deepEqual(found(doc("The fee was reduced, e.g. from $90 to $70.")), []);
    assert.deepEqual(found(doc("We cut costs. The band is $90–$70.")), ["$90–$70"]);
    assert.deepEqual(found(doc("Down payment: $90–$70.")), ["$90–$70"]);
    assert.deepEqual(found(doc("The budget ranges from $90 to $70.")), ["$90 to $70"]);
  });

  it("labelled minimum and maximum on one line", () => {
    assert.deepEqual(found(doc("Pay: minimum $90,000, maximum $70,000.")), ["$90,000, maximum $70,000"]);
    assert.deepEqual(found(doc("Pay: min. $70,000, max. $90,000.")), []);
    assert.deepEqual(found(doc("Salary from $70,000; bonus up to $5,000.")), []);
  });

  it("different currencies, a sum, versions, pages and dates are not compared", () => {
    assert.deepEqual(found(doc("Fees run $90–€70.")), []);
    assert.deepEqual(found(doc("The saving is $90 - $70 = $20.")), []);
    assert.deepEqual(found(doc("See pages 90–70 of version 3.0–2.0, 5 April 2026 – 2 April 2026.")), []);
  });
});

const WORDS: AmountRangeWords = {
  connectors: ["〜", "–", "to"],
  openers: ["から"],
  closers: ["まで"],
  changes: ["reduced"],
  lowers: ["min"],
  uppers: ["max"],
  links: ["of"],
  scales: [{ word: "万", value: 10000 }],
  number: "[0-9]+(?:,[0-9]{3})*",
};

const yen = (text: string, written: string, value: number, scale?: number): RangeAmount => {
  const offset = text.indexOf(written);
  return { offset, end: offset + written.length, currency: "JPY", value, scale, position: "after" };
};

describe("reversedAmountRanges", () => {
  it("nothing is read from no amounts or an empty text", () => {
    assert.deepEqual(reversedAmountRanges("", [], WORDS), []);
    assert.deepEqual(reversedAmountRanges("30〜25", [], WORDS), []);
  });

  it("equal ends are not reversed", () => {
    const text = "30万円〜30万円";
    assert.deepEqual(
      reversedAmountRanges(text, [yen(text, "30万円", 300000, 10000), { ...yen(text, "30万円", 300000, 10000), offset: 6, end: 10 }], WORDS),
      [],
    );
  });

  it("two ends on different lines are not a range", () => {
    const text = "30万円〜\n25万円";
    const first = yen(text, "30万円", 300000, 10000);
    const second = { ...yen(text, "25万円", 250000, 10000) };
    assert.deepEqual(reversedAmountRanges(text, [first, second], WORDS), []);
  });

  it("empty word lists read nothing", () => {
    const text = "30万円〜25万円";
    const none: AmountRangeWords = { ...WORDS, connectors: [], openers: [], scales: [] };
    assert.deepEqual(reversedAmountRanges(text, [yen(text, "30万円", 300000, 10000), yen(text, "25万円", 250000, 10000)], none), []);
  });
});
