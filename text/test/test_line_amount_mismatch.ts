import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { cellNumber, lineAmountMismatches, quantityOf } from "../packages/chaff/src/structure/line-amount.ts";

// 数量×単価が金額と合わない（line-amount-mismatch）。例文はすべて自作。

const RULE = "line-amount-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const table = (rows: readonly string[]): string => ["| 品目 | 数量 | 単価 | 金額 |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";
const enTable = (rows: readonly string[]): string => ["| Item | Quantity | Unit price | Amount |", "| --- | --- | --- | --- |", ...rows].join("\n") + "\n";

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
  });

  it("語の無い言語と空の入力", () => {
    assert.deepEqual(lineAmountMismatches(table(["| 開発 | 4 | 150,000円 | 650,000円 |"]), { quantity: [], unitPrice: [], amount: [] }), []);
    assert.deepEqual(lineAmountMismatches("", { quantity: ["数量"], unitPrice: ["単価"], amount: ["金額"] }), []);
    assert.deepEqual(findingsOf(""), []);
  });
});
