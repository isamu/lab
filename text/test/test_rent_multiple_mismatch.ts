import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { feesFor, monthlyBases, monthsIn, type RentMultipleWords } from "../packages/chaff/src/structure/rent-multiple.ts";
import { intervalOf, isMultiple, isPlainGap, nearestStated } from "../packages/chaff/src/structure/stated-multiple.ts";

// 賃料の月数分と合わない敷金・礼金（rent-multiple-mismatch）。

const RULE = "rent-multiple-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["months"])} ${String(finding.values["amount"])} / ${String(finding.values["rent"])}`);

const table = (...rows: string[]): string => ["| 項目 | 内容 |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(" ", " | ")} |`)].join("\n");
const enTable = (...rows: string[]): string => ["| Item | Details |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(": ", " | ")} |`)].join("\n");

const jaDoc = (...blocks: string[]): string[] => found(["# 物件の案内", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), ja);
const enDoc = (...blocks: string[]): string[] => found(["# For Rent", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), en);

const words: RentMultipleWords = {
  rents: ["賃料"],
  fees: ["管理費"],
  multiples: ["敷金"],
  months: ["か月", "months", "month"],
  links: ["の", "分", "of"],
  periods: [],
  skips: ["税込"],
  connectors: ["〜"],
  numberWords: [
    { word: "six", value: 6 },
    { word: "一", value: 1 },
  ],
};

const stated = (offset: number, low: number, high = low) => ({ offset, currency: "JPY", range: { low, high }, written: "" });

describe("rent-multiple pieces", () => {
  it("intervalOf leaves half the last digit of a word of scale either way, and plain digits exact", () => {
    assert.deepEqual(intervalOf({ offset: 0, end: 5, currency: "JPY", value: 98000, scale: 10000 }, "9.8万円"), { low: 97500, high: 98500 });
    assert.deepEqual(intervalOf({ offset: 0, end: 7, currency: "JPY", value: 98000, scale: undefined }, "98,000円"), { low: 98000, high: 98000 });
  });

  it("isMultiple accepts the count of months of a base within a unit's rounding, and nothing further", () => {
    assert.equal(isMultiple(2, { low: 196000, high: 196000 }, [{ low: 98000, high: 98000 }]), true);
    assert.equal(isMultiple(1.5, { low: 147500, high: 147500 }, [{ low: 98333, high: 98333 }]), true);
    assert.equal(isMultiple(2, { low: 98000, high: 98000 }, [{ low: 98000, high: 98000 }]), false);
    assert.equal(isMultiple(0, { low: 0, high: 0 }, [{ low: 98000, high: 98000 }]), true);
    assert.equal(isMultiple(0, { low: 85000, high: 85000 }, [{ low: 85000, high: 85000 }]), false);
    assert.equal(isMultiple(1, { low: 87000, high: 87000 }, [{ low: 85000, high: 90000 }]), true);
    assert.equal(isMultiple(1, { low: 87000, high: 87000 }, []), false);
  });

  it("monthlyBases is the rent alone, with each fee, and with every fee", () => {
    assert.deepEqual(monthlyBases({ low: 100, high: 100 }, []), [{ low: 100, high: 100 }]);
    assert.deepEqual(
      monthlyBases({ low: 100, high: 100 }, [
        { low: 10, high: 10 },
        { low: 5, high: 5 },
      ]),
      [
        { low: 100, high: 100 },
        { low: 110, high: 110 },
        { low: 105, high: 105 },
        { low: 115, high: 115 },
      ],
    );
  });

  it("nearestStated takes the nearest rent before, and before any rent only the document's one rent", () => {
    const rents = [stated(10, 85000), stated(100, 90000)];
    assert.equal(nearestStated(rents, 50)?.offset, 10);
    assert.equal(nearestStated(rents, 150)?.offset, 100);
    assert.equal(nearestStated(rents, 5), undefined);
    assert.equal(nearestStated([stated(10, 85000), stated(100, 85000)], 5)?.offset, 10);
    assert.equal(nearestStated([], 5), undefined);
  });

  it("feesFor takes the fees after the rent and before the next one, and fees before a rent only for the first", () => {
    const rents = [stated(10, 85000), stated(100, 90000)];
    assert.deepEqual(
      feesFor(rents[0] ?? stated(0, 0), rents, [stated(20, 5000), stated(120, 6000)]).map((fee) => fee.offset),
      [20],
    );
    assert.deepEqual(
      feesFor(rents[0] ?? stated(0, 0), rents, [stated(5, 5000)]).map((fee) => fee.offset),
      [5],
    );
    assert.deepEqual(feesFor(rents[1] ?? stated(0, 0), rents, [stated(50, 5000)]), []);
    assert.deepEqual(feesFor(rents[0] ?? stated(0, 0), rents, [{ ...stated(20, 5000), currency: "USD" }]), []);
  });

  it("monthsIn reads digits, full-width digits and number words, and not a digit inside a longer number", () => {
    assert.deepEqual(
      monthsIn("2か月（98,000円）", 0, words).map((months) => months.count),
      [2],
    );
    assert.deepEqual(
      monthsIn("２か月と一か月", 0, words).map((months) => months.count),
      [2, 1],
    );
    assert.deepEqual(
      monthsIn("Six months' rent", 0, words).map((months) => months.count),
      [6],
    );
    assert.deepEqual(
      monthsIn("1.5 months", 0, words).map((months) => months.count),
      [1.5],
    );
    assert.deepEqual(monthsIn("2026年10月", 0, words), []);
    assert.deepEqual(monthsIn("monthly", 0, words), []);
  });

  it("isPlainGap allows separators, bracketed words, possessives and the given words, and nothing else", () => {
    assert.equal(isPlainGap(" | ", []), true);
    assert.equal(isPlainGap("（月額） | ", []), true);
    assert.equal(isPlainGap("' rent (", ["rent"]), true);
    assert.equal(isPlainGap("分（", ["分"]), true);
    assert.equal(isPlainGap(", due within ", ["of"]), false);
    assert.equal(isPlainGap("の10か月分（", ["の", "分"]), false);
  });
});

describe("rent-multiple-mismatch, Japanese", () => {
  it("an amount that is not the months of the rent", () => {
    assert.deepEqual(jaDoc(table("賃料 98,000円"), table("敷金 2か月（98,000円）", "礼金 1か月（98,000円）")), ["2か月 98,000円 / 98,000円"]);
    assert.deepEqual(jaDoc(table("賃料 98,000円"), table("敷金 1か月（98,000円）", "礼金 1か月（98,000円）")), []);
  });

  it("賃料の何か月分, and the amount before the months", () => {
    assert.deepEqual(jaDoc(table("賃料 1,000,000円（税別）"), table("保証金 賃料の10か月分（12,000,000円）")), ["10か月 12,000,000円 / 1,000,000円"]);
    assert.deepEqual(jaDoc(table("賃料 1,000,000円（税別）"), table("保証金 賃料の10か月分（10,000,000円）")), []);
    assert.deepEqual(jaDoc("賃料は85,000円です。敷金は90,000円（1ヶ月分）です。"), ["1ヶ月 90,000円 / 85,000円"]);
    assert.deepEqual(jaDoc("賃料は85,000円です。敷金は85,000円（1ヶ月分）です。"), []);
  });

  it("several listings on one page: each deposit is compared with its own rent", () => {
    const first = ["## 101号室", "", table("賃料 85,000円", "敷金 1ヶ月（85,000円）")].join("\n");
    const second = ["## 102号室", "", table("賃料 90,000円", "敷金 1ヶ月（85,000円）")].join("\n");
    assert.deepEqual(jaDoc(first, second), ["1ヶ月 85,000円 / 90,000円"]);
    const fixed = ["## 102号室", "", table("賃料 90,000円", "敷金 1ヶ月（90,000円）")].join("\n");
    assert.deepEqual(jaDoc(first, fixed), []);
  });

  it("the months may be of the rent and the fee; neither is reported", () => {
    assert.deepEqual(jaDoc(table("賃料 98,000円", "管理費 6,000円"), table("敷金 2か月（208,000円）")), []);
    assert.deepEqual(jaDoc(table("賃料 98,000円", "管理費 6,000円"), table("敷金 2か月（196,000円）")), []);
    assert.deepEqual(jaDoc(table("賃料 98,000円", "管理費 6,000円"), table("敷金 2か月（200,000円）")), ["2か月 200,000円 / 98,000円"]);
  });

  it("a fee stated for the listing before is not this listing's fee", () => {
    const first = ["## 101号室", "", "賃料：100,000円", "管理費：6,000円"].join("\n");
    const second = ["## 102号室", "", "賃料：100,000円", "敷金：2か月（212,000円）"].join("\n");
    assert.deepEqual(jaDoc(first, second), ["2か月 212,000円 / 100,000円"]);
  });

  it("a rent or fee line with a second amount (a change) is not read", () => {
    assert.deepEqual(jaDoc("賃料：98,000円", "管理費：6,000円から5,000円に改定", "敷金：2か月（206,000円）"), []);
    assert.deepEqual(jaDoc("賃料：98,000円から100,000円に改定", "敷金：2か月（200,000円）"), []);
    assert.deepEqual(jaDoc("賃料：90,000円", "賃料：98,000円から100,000円に改定", "敷金：2か月（200,000円）"), []);
    assert.deepEqual(jaDoc("賃料 98,000円 管理費 6,000円", "敷金：2か月（208,000円）"), []);
  });

  it("a rent per year or per tsubo is not the monthly rent", () => {
    assert.deepEqual(jaDoc("賃料（年額）：1,200,000円", "敷金：1か月（100,000円）"), []);
    assert.deepEqual(jaDoc("賃料：坪単価15,000円", "敷金：6か月（2,970,000円）"), []);
  });

  it("a rent range accepts the months of any rent in it", () => {
    assert.deepEqual(jaDoc("賃料：85,000円〜90,000円", "敷金：1ヶ月（88,000円）"), []);
    assert.deepEqual(jaDoc("賃料：85,000円〜90,000円", "敷金：1ヶ月（95,000円）"), ["1ヶ月 95,000円 / 85,000円〜90,000円"]);
  });

  it("an amount with a word of scale is read to its last digit", () => {
    assert.deepEqual(jaDoc("賃料：9.8万円", "敷金：1ヶ月（98,000円）"), []);
    assert.deepEqual(jaDoc("賃料：98,000円", "敷金：2ヶ月（19.6万円）"), []);
    assert.deepEqual(jaDoc("賃料：98,000円", "敷金：2ヶ月（18万円）"), ["2ヶ月 18万円 / 98,000円"]);
  });

  it("0ヶ月 with 0円 is the multiple, 0ヶ月 with an amount is not", () => {
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 0ヶ月（0円）")), []);
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 0ヶ月（85,000円）")), ["0ヶ月 85,000円 / 85,000円"]);
  });

  it("says nothing without both a months count and an amount", () => {
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 なし", "礼金 0ヶ月")), []);
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 1ヶ月", "礼金 90,000円")), []);
    assert.deepEqual(jaDoc("契約期間は2年間で、更新料は新賃料の1か月分です。"), []);
  });

  it("says nothing without a rent, before a rent the document states twice differently, or across currencies", () => {
    assert.deepEqual(jaDoc(table("敷金 2か月（98,000円）")), []);
    assert.deepEqual(jaDoc("敷金：1ヶ月（85,000円）", "賃料：90,000円", "賃料：95,000円"), []);
    assert.deepEqual(jaDoc("敷金：1ヶ月（85,000円）", "賃料：90,000円"), ["1ヶ月 85,000円 / 90,000円"]);
    assert.deepEqual(jaDoc("賃料：$900", "敷金：1ヶ月（85,000円）"), []);
  });

  it("does not read a range of months, two pairs, or an amount with tax", () => {
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 1〜2ヶ月（85,000円）")), []);
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 1ヶ月（85,000円）または2ヶ月（150,000円）")), []);
    assert.deepEqual(jaDoc(table("賃料 85,000円"), table("敷金 2ヶ月（150,000円）または1ヶ月（85,000円）")), []);
    assert.deepEqual(jaDoc(table("賃料 100,000円"), table("礼金 1ヶ月（110,000円・税込）")), []);
  });
});

describe("rent-multiple-mismatch, English", () => {
  it("an amount that is not the months of the rent", () => {
    assert.deepEqual(enDoc(enTable("Rent: $1,600"), enTable("Deposit: 2 months ($3,000)")), ["2 months $3,000 / $1,600"]);
    assert.deepEqual(enDoc(enTable("Rent: $1,600"), enTable("Deposit: 2 months ($3,200)")), []);
  });

  it("months' rent with a number word, and the amount first", () => {
    assert.deepEqual(enDoc(enTable("Rent: $21,500", "Service charge: $4,300"), enTable("Deposit: Six months' rent ($145,000)")), [
      "Six months $145,000 / $21,500",
    ]);
    assert.deepEqual(enDoc(enTable("Rent: $21,500", "Service charge: $4,300"), enTable("Deposit: Six months' rent ($129,000)")), []);
    assert.deepEqual(enDoc(enTable("Rent: $21,500", "Service charge: $4,300"), enTable("Deposit: Six months' rent ($154,800)")), []);
    assert.deepEqual(enDoc("Monthly rent: $1,850", "Security deposit: $3,000 (2 months' rent)"), ["2 months $3,000 / $1,850"]);
  });

  it("a rent per week or per year is not the monthly rent", () => {
    assert.deepEqual(enDoc("Rent: $1,600 per week", "Security deposit: one month's rent ($6,933)"), []);
    assert.deepEqual(enDoc("Rent: $36 per sq ft per year", "Deposit: 3 months' rent ($27,000)"), []);
  });

  it("a label with words before its amount is not the rent", () => {
    assert.deepEqual(enDoc("Rent: $1,600", "Rent review in 2027 may raise it to $1,700.", "Deposit: 1 month ($1,600)"), []);
  });

  it("a month's rent in a label is not the rent", () => {
    assert.deepEqual(enDoc(enTable("Rent: $1,850", "First month's rent: $1,850", "Security deposit: 1 month's rent ($1,850)")), []);
    assert.deepEqual(enDoc(enTable("Security deposit: 2 months' rent ($1,850)", "First month's rent: $1,850")), []);
  });

  it("says nothing for none, a range of months, a months count not joined to the amount, or no rent", () => {
    assert.deepEqual(enDoc("Rent: $1,600", "Deposit: none"), []);
    assert.deepEqual(enDoc("Rent: $1,600", "Deposit: 1 to 2 months ($2,000)"), []);
    assert.deepEqual(enDoc("Rent: $1,600", "Deposit: $500, due within 2 months"), []);
    assert.deepEqual(enDoc("Deposit: 2 months ($3,000)"), []);
  });
});
