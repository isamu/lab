import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { cellNumber, lineAmountMismatches, quantityOf } from "../packages/chaff/src/structure/line-amount.ts";
import { perUnitPrice, quantityUnit, unitsAgree } from "../packages/chaff/src/structure/line-amount-unit.ts";

// 数量×単価が金額と合わない（line-amount-mismatch）。例文はすべて自作。

const RULE = "line-amount-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const table = (rows: readonly string[]): string => ["| 品目 | 数量 | 単価 | 金額 |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
const enTable = (rows: readonly string[]): string => ["| Item | Quantity | Unit price | Amount |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";

const NO_UNITS = { units: [], perUnitMarks: [], headerUnits: [] };

const cell = (text: string): { start: number; text: string } => ({ start: 0, text });

describe("line-amount-mismatch: 数量×単価が金額と合わない", () => {
  it("数量×単価と違う金額を指す", () => {
    assert.deepEqual(findingsOf(table(["| 画面開発 | 4画面 | 160,000円 | 600,000円 |"])), [
      "金額「600,000円」が、数量×単価（4画面 × 160,000円 = 640,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(enTable(["| Screens | 4 | $1,600 | $6,000 |"]), en), ["The amount $6,000 is not quantity × unit price (4 × $1,600 = $6,400)"]);
    assert.deepEqual(findingsOf(enTable(["| Support | 3 days | $19.99 | $59.00 |"]), en), [
      "The amount $59.00 is not quantity × unit price (3 days × $19.99 = $59.97)",
    ]);
  });

  it("合えば言わない。端数の丸めも合っていると読む", () => {
    assert.deepEqual(findingsOf(table(["| 画面開発 | 4画面 | 150,000円 | 600,000円 |", "| 設計 | 1式 | 400,000円 | 400,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 部品 | 3個 | 333.5円 | 1,000円 |", "| 部品 | 3個 | 333.5円 | 1,001円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| Hours | 2.5 hours | $90.00 | $225.00 |"]), en), []);
  });

  it("単価と金額の書き方が違う行、負の数、数で始まらない数量は比べない", () => {
    assert.deepEqual(findingsOf(table(["| 開発 | 4画面 | 15万円 | 650,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 値引き | 1 | -50,000円 | -60,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 保守 | 一式 | 80,000円 | 90,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 小計 | | | 1,200,000円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| A | 2 x 3 | $10 | $60 |"]), en), []);
    assert.deepEqual(findingsOf(enTable(["| A | 2 | $10- | $25- |"]), en), []);
  });

  it("ほかの列に数のある行（値引き、税率）と、数量と別の単位あたりの単価は比べない", () => {
    assert.deepEqual(findingsOf("| 品目 | 数量 | 単価 | 値引 | 金額 |\n| --- | --- | --- | --- | --- |\n| 設計 | 10 | 5,000円 | 5,000円 | 45,000円 |\n"), []);
    assert.deepEqual(
      findingsOf("| Item | Qty | Unit price | Discount | Amount |\n| --- | --- | --- | --- | --- |\n| Widget | 10 | $50.00 | 10% | $450.00 |\n", en),
      [],
    );
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 days | $100/hour | $1,600 |\n", en), []);
    assert.deepEqual(findingsOf("| 品目 | 数量 | 単価 | 備考 | 金額 |\n| --- | --- | --- | --- | --- |\n| 設計 | 10 | 5,000円 | 急ぎ | 45,000円 |\n"), [
      "金額「45,000円」が、数量×単価（10 × 5,000円 = 50,000円）と合いません",
    ]);
  });

  it("三つの列がそろわない表と、コードの中の表は読まない", () => {
    assert.deepEqual(findingsOf("| 品目 | 数量 | 金額 |\n| --- | --- | --- |\n| 開発 | 4 | 650,000円 |\n"), []);
    assert.deepEqual(findingsOf(`# 例\n\n\`\`\`\n${table(["| 開発 | 4 | 150,000円 | 650,000円 |"])}\`\`\`\n`), []);
  });

  it("升の数を読む", () => {
    assert.deepEqual(cellNumber(cell(" $1,500.00 ")), {
      before: "$",
      value: 1500,
      after: "",
      offset: 1,
      written: "$1,500.00",
      grouped: true,
      decimals: 2,
    });
    assert.equal(cellNumber(cell("15万円"))?.after, "万円");
    assert.equal(cellNumber(cell("１２０円"))?.value, 120);
    assert.equal(cellNumber(cell("1,000円〜2,000円")), undefined);
    assert.equal(cellNumber(cell("▲500円")), undefined);
    assert.equal(cellNumber(cell("")), undefined);
    assert.equal(quantityOf(cell("3人日")), 3);
    assert.equal(quantityOf(cell(" 2.5 hours")), 2.5);
    assert.equal(quantityOf(cell("一式")), undefined);
    assert.equal(quantityOf(cell("2 x 3")), undefined);
  });

  it("語の無い言語と空の入力", () => {
    assert.deepEqual(lineAmountMismatches(table(["| 開発 | 4 | 150,000円 | 650,000円 |"]), { quantity: [], unitPrice: [], amount: [], ...NO_UNITS }), []);
    assert.deepEqual(lineAmountMismatches("", { quantity: ["数量"], unitPrice: ["単価"], amount: ["金額"], ...NO_UNITS }), []);
    assert.deepEqual(findingsOf(""), []);
  });

  it("単価が何かあたりで、数量が別の単位なら比べない", () => {
    assert.deepEqual(findingsOf(table(["| 保守 | 2日 | 月額300,000円 | 30,000円 |", "| 作業 | 2日 | 10,000円/時 | 160,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 作業 | 3人日 | 10,000円/時 | 240,000円 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| Hosting | 10 days | $300/month | $100 |", "| Engineer | 2 days | $100 per hour | $1,600 |"]), en), []);
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 days | $100 | $1,600 |\n", en), []);
    assert.deepEqual(findingsOf("| Item | Hours | Unit price | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 | $800/day | $200 |\n", en), []);
  });

  it("同じ単位なら、単位あたりの単価でも比べる。単位の無い数量と、ただの単価も比べる", () => {
    assert.deepEqual(findingsOf(table(["| 保守 | 1か月 | 月額80,000円 | 90,000円 |", "| 作業 | 3時間 | 10,000円/時 | 35,000円 |"])), [
      "金額「90,000円」が、数量×単価（1か月 × 月額80,000円 = 80,000円）と合いません",
      "金額「35,000円」が、数量×単価（3時間 × 10,000円/時 = 30,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(table(["| 部品 | 3 | ¥1,000 | ¥3,500 |"])), ["金額「¥3,500」が、数量×単価（3 × ¥1,000 = ¥3,000）と合いません"]);
    assert.deepEqual(findingsOf(enTable(["| Engineer | 2 hours | $100/hour | $250 |", "| Engineer | 2 | $100/hour | $250 |"]), en), [
      "The amount $250 is not quantity × unit price (2 hours × $100/hour = $200)",
      "The amount $250 is not quantity × unit price (2 × $100/hour = $200)",
    ]);
    assert.deepEqual(findingsOf("| Item | Quantity | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 | $100 | $250 |\n", en), [
      "The amount $250 is not quantity × unit price (2 × $100 = $200)",
    ]);
    assert.deepEqual(findingsOf("| Item | Hours | Rate | Amount |\n| --- | --- | --- | --- |\n| Engineer | 2 | $100/hr | $250 |\n", en), [
      "The amount $250 is not quantity × unit price (2 × $100/hr = $200)",
    ]);
  });

  it("単位を読む", () => {
    const marks = [
      { pattern: "/h", unit: "hour" },
      { pattern: "/hour", unit: "hour" },
      { pattern: "月額", unit: "month" },
    ];
    assert.deepEqual(perUnitPrice("$", "/hour", marks), { before: "$", after: "", unit: "hour" });
    assert.deepEqual(perUnitPrice("$", "/H", marks), { before: "$", after: "", unit: "hour" });
    assert.deepEqual(perUnitPrice("月額", "円", marks), { before: "", after: "円", unit: "month" });
    assert.equal(perUnitPrice("$", "", marks), undefined);
    assert.equal(perUnitPrice("", "/hours", marks), undefined);
    assert.equal(perUnitPrice("$", "/hour", []), undefined);
    const units = [{ pattern: "days", unit: "day" }];
    assert.equal(quantityUnit("Days", units), "day");
    assert.equal(quantityUnit("days.", units), "day");
    assert.equal(quantityUnit("", units), "");
    assert.equal(quantityUnit("  ", units), "");
    assert.equal(quantityUnit("人日", units), undefined);
    assert.equal(unitsAgree(undefined, undefined), true);
    assert.equal(unitsAgree("day", undefined), true);
    assert.equal(unitsAgree("", "hour"), true);
    assert.equal(unitsAgree("hour", "hour"), true);
    assert.equal(unitsAgree("day", "hour"), false);
    assert.equal(unitsAgree(undefined, "hour"), false);
    assert.equal(unitsAgree("hour", "unstated"), false);
  });
});
