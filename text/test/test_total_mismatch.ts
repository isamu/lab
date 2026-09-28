import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 合計が内訳の和と合わない（total-mismatch）。箇条書きと表の行で、合計の語で始まる行を上の金額の和と比べる。

const found = (source: string, adapter: LanguageAdapter = en, language = "en"): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "total-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "total-mismatch")
    .map((finding) => `${String(finding.values["written"])}≠${String(finding.values["sum"])}`);

const doc = (...lines: string[]): string => ["# Quote", "", ...lines].join("\n");
const fixture = (name: string): string => readFileSync(new URL(`fixtures/totals/${name}`, import.meta.url), "utf8");

describe("total-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("a list total that is not the sum of the items above it, shown in the way it is written", () => {
    assert.deepEqual(found(doc("- A: $1,200", "- B: $300.50", "- Total: $1,600.50")), ["$1,600.50≠$1,500.50"]);
    assert.deepEqual(found(doc("- A: $1,200", "- B: $300.50", "- Total: $1,500.50")), []);
  });

  it("a Japanese table total, with the amount in its own column", () => {
    const table = (total: string): string => doc("| 品目 | 金額 |", "| --- | --- |", "| 設計 | 120,000円 |", "| 実装 | 10,000円 |", `| 合計 | ${total} |`);
    assert.deepEqual(found(table("125,000円"), ja, "ja"), ["125,000円≠130,000円"]);
    assert.deepEqual(found(table("130,000円"), ja, "ja"), []);
  });

  it("a subtotal, then tax, then the total: the total is the subtotal plus what follows it", () => {
    const lines = (total: string): string => doc("- A: $100", "- B: $200", "- Subtotal: $300", "- Tax: $30", `- Total: ${total}`);
    assert.deepEqual(found(lines("$330")), []);
    assert.deepEqual(found(lines("$340")), ["$340≠$330"]);
  });

  it("a grand total of subtotals", () => {
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- Subtotal: $300", "- C: $50", "- D: $50", "- Subtotal: $100", "- Total: $400")), []);
  });

  it("a subtotal that is wrong is pointed out before the total that uses it", () => {
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- Subtotal: $310", "- Tax: $31", "- Total: $341")), ["$310≠$300"]);
  });

  it("a discount written with a minus sign or ▲ is taken away; the list's own dash is not a sign", () => {
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- Discount: -$50", "- Total: $250")), []);
    assert.deepEqual(found(doc("- $100 design", "- $200 build", "- Total: $300")), []);
    assert.deepEqual(found(doc("- 設計 100,000円", "- 実装 200,000円", "- 値引き ▲50,000円", "- 合計 250,000円"), ja, "ja"), []);
  });

  it("an amount in parentheses has no known sign, so the total is not judged", () => {
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- Refund: ($50)", "- Total: $999")), []);
  });

  it("a column with another unit, or a line with two amounts in one unit, leaves the total unjudged", () => {
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- C: €50", "- Total: $999")), []);
    assert.deepEqual(found(doc("- A: 2 x $100 = $200", "- B: $300", "- Total: $999")), []);
  });

  it("an amount in another unit on the same line, such as a tax rate, does not stop the check", () => {
    assert.deepEqual(found(doc("- 設計 100,000円", "- 実装 200,000円", "- 消費税 10% 30,000円", "- 合計 340,000円"), ja, "ja"), ["340,000円≠330,000円"]);
  });

  it("each column is added on its own: hours and amounts", () => {
    const table = doc("| Item | Hours | Amount |", "| --- | --- | --- |", "| A | 8 hours | $800 |", "| B | 4 hours | $400 |", "| Total | 13 hours | $1,200 |");
    assert.deepEqual(found(table), ["13≠12"]);
  });

  it("two columns in one unit, a unit price and an amount: the total's own column is added", () => {
    const table = doc("| Item | Unit price | Amount |", "| --- | --- | --- |", "| A | $100 | $200 |", "| B | $50 | $150 |", "| Total | | $400 |");
    assert.deepEqual(found(table), ["$400≠$350"]);
  });

  it("a pipe escaped inside a cell does not move the column; a currency code keeps its space", () => {
    const table = doc("| Item | Amount |", "| --- | --- |", "| A \\| setup | $100 |", "| B | $200 |", "| Total | $999 |");
    assert.deepEqual(found(table), ["$999≠$300"]);
    assert.deepEqual(found(doc("- A: USD 100", "- B: USD 200", "- Total: USD 999")), ["USD 999≠USD 300"]);
  });

  it("a word that only starts like a total word is not a total: 計画, Totally", () => {
    assert.deepEqual(found(doc("- 設計 100,000円", "- 実装 200,000円", "- 計画 999,000円"), ja, "ja"), []);
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- Totally new: $999")), []);
    assert.deepEqual(found(doc("- Search: 10%", "- Ads: 20%", "- Total conversion: 25%")), []);
    assert.deepEqual(found(doc("- A: $100", "- B: $200", "- Total (incl. tax) $999")), ["$999≠$300"]);
    assert.deepEqual(found(doc("- 設計 100,000円", "- 実装 200,000円", "- 合計（税込） 999,000円"), ja, "ja"), ["999,000円≠300,000円"]);
    assert.deepEqual(found(doc("- 設計 100,000円", "- 実装 200,000円", "- **計**: 999,000円"), ja, "ja"), ["999,000円≠300,000円"]);
  });

  it("one item above a total is not a sum; a total in running text is not a line of a list", () => {
    assert.deepEqual(found(doc("- Deposit: $100", "- Total: $500")), []);
    assert.deepEqual(found(doc("A costs $100 and B costs $200.", "", "Total: $999")), []);
  });

  it("a header row holding a total word is not a total", () => {
    assert.deepEqual(found(doc("| Total $999 | Amount |", "| --- | --- |", "| A | $100 |", "| B | $200 |")), []);
  });

  it("the sample invoices: the Japanese one's total is off; the English one adds up", () => {
    assert.deepEqual(found(fixture("invoice-ja.md"), ja, "ja"), ["2,000,000円≠2,090,000円"]);
    assert.deepEqual(found(fixture("invoice-en.md")), []);
    assert.deepEqual(found(fixture("invoice-en.md").replace("$10,260.00", () => "$10,160.00")), ["$10,160.00≠$10,260.00"]);
  });
});
