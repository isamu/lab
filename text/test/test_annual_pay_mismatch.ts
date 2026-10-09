import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { isAnnualOf, isPlainGap, labelsIn, monthsIn, roundingOf, type AnnualPayWords } from "../packages/chaff/src/structure/annual-pay.ts";

// 月給と賞与から計算した額と合わない年収例（annual-pay-mismatch）。

const RULE = "annual-pay-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["annual"])} / ${String(finding.values["monthly"])} + ${String(finding.values["bonus"])}`);

const table = (...rows: string[]): string => ["| 項目 | 内容 |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(" ", " | ")} |`)].join("\n");
const enTable = (...rows: string[]): string => ["| Item | Details |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(": ", " | ")} |`)].join("\n");

const jaDoc = (...blocks: string[]): string[] => found(["# 求人票", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), ja);
const enDoc = (...blocks: string[]): string[] => found(["# Job Posting", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), en);

const words: AnnualPayWords = {
  labels: { example: ["年収例", "年収"], salary: ["Annual salary"], monthly: ["月給", "Monthly salary"], pay: ["Salary"], bonus: ["賞与"] },
  links: ["は", "of"],
  perMonth: ["a month"],
  none: [{ word: "なし", position: "after" }],
  each: ["各"],
  extra: [],
  times: [],
  totals: [],
  includes: ["残業"],
  markers: [
    { word: "約", position: "before" },
    { word: "以上", position: "after" },
  ],
  months: ["ヶ月", "months"],
  connectors: ["〜"],
  numberWords: [{ word: "three", value: 3 }],
};

describe("annual-pay pieces", () => {
  it("isAnnualOf allows less than the rounding unit either way, and compares a range end for end", () => {
    assert.equal(isAnnualOf({ low: 4200000, high: 4200000 }, 10000, { low: 280000, high: 280000 }, 15), true);
    assert.equal(isAnnualOf({ low: 3520000, high: 3520000 }, 10000, { low: 235000, high: 235000 }, 15), true);
    assert.equal(isAnnualOf({ low: 3530000, high: 3530000 }, 10000, { low: 235000, high: 235000 }, 15), true);
    assert.equal(isAnnualOf({ low: 4210000, high: 4210000 }, 10000, { low: 280000, high: 280000 }, 15), false);
    assert.equal(isAnnualOf({ low: 4500000, high: 4500000 }, 10000, { low: 280000, high: 280000 }, 15), false);
    assert.equal(isAnnualOf({ low: 3750000, high: 4500000 }, 10000, { low: 250000, high: 300000 }, 15), true);
    assert.equal(isAnnualOf({ low: 4000000, high: 4500000 }, 10000, { low: 250000, high: 300000 }, 15), false);
    assert.equal(isAnnualOf({ low: 3360000, high: 3360000 }, 10000, { low: 280000, high: 280000 }, 12), true);
  });

  it("roundingOf is one of the last written place with a word of scale, and a thousand for plain digits", () => {
    assert.equal(roundingOf({ offset: 0, end: 5, currency: "JPY", value: 4200000, scale: 10000 }, "420万円"), 10000);
    assert.equal(roundingOf({ offset: 0, end: 7, currency: "JPY", value: 3525000, scale: 10000 }, "352.5万円"), 1000);
    assert.equal(roundingOf({ offset: 0, end: 7, currency: "USD", value: 72000, scale: undefined }, "$72,000"), 1000);
  });

  it("labelsIn reads the longer label first and gives each its kind", () => {
    assert.deepEqual(
      labelsIn("年収例 420万円、年収 400万円", words).map((label) => label.kind),
      ["example", "example"],
    );
    assert.deepEqual(
      labelsIn("Annual salary: $60,000. Salary: $5,000 a month", words).map((label) => label.kind),
      ["salary", "pay"],
    );
    assert.deepEqual(labelsIn("勤務地 横浜", words), []);
  });

  it("monthsIn reads digits and number words, and marks an approximate count and a range's end", () => {
    assert.deepEqual(
      monthsIn("合計で月給の3ヶ月分", 0, 10, words).map((count) => [count.count, count.marked]),
      [[3, false]],
    );
    assert.deepEqual(
      monthsIn("three months' salary", 0, 20, words).map((count) => count.count),
      [3],
    );
    assert.deepEqual(
      monthsIn("2〜3ヶ月", 0, 6, words).map((count) => count.marked),
      [true],
    );
    assert.deepEqual(
      monthsIn("約3ヶ月", 0, 5, words).map((count) => count.marked),
      [true],
    );
    assert.deepEqual(monthsIn("年2回", 0, 3, words), []);
  });

  it("isPlainGap allows separators, bracketed words and the link words only", () => {
    assert.equal(isPlainGap(" | ", []), true);
    assert.equal(isPlainGap("（モデル） | ", []), true);
    assert.equal(isPlainGap(" of ", ["of"]), true);
    assert.equal(isPlainGap("の場合 ", []), false);
  });
});

describe("annual-pay-mismatch, Japanese", () => {
  it("an annual example that is not the monthly pay on its line times twelve plus the bonus", () => {
    const bonus = "賞与 年2回（合計で月給の3ヶ月分）";
    assert.deepEqual(jaDoc(table("給与 月給25万円〜30万円", bonus, "年収例 450万円（入社3年目、月給28万円の場合）")), ["450万円 / 28万円 + 3ヶ月"]);
    assert.deepEqual(jaDoc(table("給与 月給25万円〜30万円", bonus, "年収例 420万円（入社3年目、月給28万円の場合）")), []);
  });

  it("the posting's one monthly pay and bonus when the annual line names none", () => {
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回（計4ヶ月分）", "想定年収：420万円"), ["420万円 / 25万円 + 4ヶ月"]);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回（計4ヶ月分）", "想定年収：400万円"), []);
  });

  it("no bonus is twelve months", () => {
    assert.deepEqual(jaDoc(table("月給 30万円", "賞与 なし", "年収例 360万円")), []);
    assert.deepEqual(jaDoc(table("月給 30万円", "賞与 なし", "年収例 400万円")), ["400万円 / 30万円 + なし"]);
  });

  it("allows the annual figure's rounding to a 万, and no more", () => {
    assert.deepEqual(jaDoc("月給：23.5万円", "賞与：3ヶ月分", "年収例：352万円"), []);
    assert.deepEqual(jaDoc("月給：23.5万円", "賞与：3ヶ月分", "年収例：353万円"), []);
    assert.deepEqual(jaDoc("月給：23.5万円", "賞与：3ヶ月分", "年収例：350万円"), ["350万円 / 23.5万円 + 3ヶ月"]);
    assert.deepEqual(jaDoc("月給：235,000円", "賞与：3ヶ月分", "年収例：3,525,000円"), []);
  });

  it("says nothing for a posting with an annual salary, whose monthly pay may be a 14th or a 16th of it", () => {
    assert.deepEqual(jaDoc("月給：30万円", "賞与：4ヶ月分", "年俸：400万円"), []);
    assert.deepEqual(jaDoc("年俸制：420万円（14分割、月給30万円）", "賞与：なし"), []);
    assert.deepEqual(jaDoc("給与：年俸制", "月給：30万円", "賞与：なし", "想定年収：420万円"), []);
  });

  it("a bonus paid more than once is read only when its months are called the total", () => {
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回、1ヶ月分", "年収例：350万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回、計1ヶ月分", "年収例：350万円"), ["350万円 / 25万円 + 1ヶ月"]);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：夏1ヶ月、冬1ヶ月", "年収例：350万円"), []);
  });

  it("an annual pay that is not an example is not read", () => {
    assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分", "社員の平均年収：450万円"), []);
  });

  it("both ranges are compared end for end; a range on one side only is not", () => {
    assert.deepEqual(jaDoc("月給：25万円〜30万円", "賞与：3ヶ月分", "年収例：375万円〜450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円〜30万円", "賞与：3ヶ月分", "年収例：400万円〜500万円"), ["400万円〜500万円 / 25万円〜30万円 + 3ヶ月"]);
    assert.deepEqual(jaDoc("月給：25万円〜30万円", "賞与：3ヶ月分", "年収例：500万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分", "年収例：400万円〜500万円"), []);
  });

  it("says nothing when overtime or allowances are in the annual line or a note about it", () => {
    assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分", "年収例：450万円（残業代含む）"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分", "年収例：450万円", "※年収例には各種手当を含みます。"), []);
    assert.deepEqual(jaDoc("月給：25万円（固定残業代3万円を含む）", "賞与：3ヶ月分", "年収例：450万円"), []);
  });

  it("says nothing for 約, 以上, から or an open range", () => {
    for (const annual of ["約450万円", "450万円以上", "450万円から", "450万円〜"]) {
      assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分", `年収例：${annual}`), [], annual);
    }
  });

  it("says nothing without one plain monthly pay and one plain bonus", () => {
    assert.deepEqual(jaDoc("賞与：3ヶ月分", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回（業績による）", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "月給：28万円", "賞与：3ヶ月分", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回（各1ヶ月分）", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：2〜3ヶ月分", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：年2回（夏1ヶ月、冬2ヶ月）", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分、別途決算賞与あり", "年収例：450万円"), []);
    assert.deepEqual(jaDoc("時給：1,100円", "賞与：なし", "年収例：250万円"), []);
  });

  it("says nothing for two annual figures on one line, or across currencies", () => {
    assert.deepEqual(jaDoc("月給：25万円", "賞与：3ヶ月分", "年収例：400万円／450万円"), []);
    assert.deepEqual(jaDoc("月給：$2,500", "賞与：3ヶ月分", "年収例：450万円"), []);
  });
});

describe("annual-pay-mismatch, English", () => {
  it("an example annual pay that is not the monthly salary on its line times twelve plus the bonus", () => {
    const bonus = "Bonus: Twice a year, three months' salary in total";
    assert.deepEqual(enDoc(enTable(bonus, "Example annual pay: $75,000 (third year, with a monthly salary of $4,800)")), ["$75,000 / $4,800 + three months"]);
    assert.deepEqual(enDoc(enTable(bonus, "Example annual pay: $72,000 (third year, with a monthly salary of $4,800)")), []);
  });

  it("a salary label is monthly only beside a per-month word", () => {
    assert.deepEqual(enDoc("Salary: $4,000 a month", "Bonus: 2 months", "Expected annual pay: $60,000"), ["$60,000 / $4,000 + 2 months"]);
    assert.deepEqual(enDoc("Salary: $4,000 a month", "Bonus: 2 months", "Expected annual pay: $56,000"), []);
    assert.deepEqual(enDoc("Salary: $4,000", "Bonus: 2 months", "Expected annual pay: $60,000"), []);
  });

  it("no bonus before the label is twelve months", () => {
    assert.deepEqual(enDoc("Monthly salary: $4,000. No bonus.", "Expected annual pay: $48,000"), []);
    assert.deepEqual(enDoc("Monthly salary: $4,000. No bonus.", "Expected annual pay: $50,000"), ["$50,000 / $4,000 + No bonus"]);
  });

  it("No before a bonus label is no bonus only when nothing else follows it", () => {
    assert.deepEqual(enDoc("Monthly salary: $4,000", "No bonus cap: target 2 months", "Expected annual pay: $56,000"), []);
  });

  it("says nothing for overtime, an open amount, or a bonus per payment", () => {
    assert.deepEqual(enDoc("Monthly salary: $4,000", "Bonus: 2 months", "Expected annual pay: $60,000 including overtime"), []);
    assert.deepEqual(enDoc("Monthly salary: $4,000", "Bonus: 2 months", "Expected annual pay: from $60,000"), []);
    assert.deepEqual(enDoc("Monthly salary: $4,000", "Bonus: 2 months", "Expected annual pay: about $60,000"), []);
    assert.deepEqual(enDoc("Monthly salary: $4,000", "Bonus: 2 months", "Expected annual pay: $60,000+"), []);
    assert.deepEqual(enDoc("Monthly salary: $4,000", "Bonus: one month each, twice a year", "Expected annual pay: $60,000"), []);
  });
});
