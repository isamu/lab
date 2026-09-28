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

  it("a grand total of subtotal rows alone is their sum, not the last one", () => {
    const table = (total: string): string =>
      doc("| Part | Amount |", "| --- | --- |", "| Subtotal: A | $300 |", "| Subtotal: B | $100 |", `| Grand total | ${total} |`);
    assert.deepEqual(found(table("$400")), []);
    assert.deepEqual(found(table("$100")), ["$100≠$400"]);
    assert.deepEqual(found(doc("- Subtotal: $300", "- Total: $999")), []);
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

  const hours = (...rows: string[]): string => doc("| Room | Hours booked | Hours used |", "| --- | --- | --- |", ...rows);

  it("a table column of bare numbers is added, the unit being in its header; the numbers are shown as written", () => {
    const table = (total: string): string => hours("| A | 410 | 352 |", "| B | 380 | 301 |", "| C | 415 | 210 |", `| Total | ${total} | 863 |`);
    assert.deepEqual(found(table("1,205")), []);
    assert.deepEqual(found(table("1,105")), ["1,105≠1,205"]);
    assert.deepEqual(found(table("**1,105**")), ["1,105≠1,205"]);
    assert.deepEqual(found(hours("| A | 410.5 | 1 |", "| B | 380 | 2 |", "| Total | 790 | 3 |")), ["790≠790.50"]);
    assert.deepEqual(found(hours("| A | 1200 | 1 |", "| B | 100 | 2 |", "| Total | 1250 | 3 |")), ["1250≠1300"]);
    assert.deepEqual(found(doc("| 部屋 | 予約時間 |", "| --- | --- |", "| A | 410 |", "| B | 380 |", "| 合計 | 800 |"), ja, "ja"), ["800≠790"]);
  });

  it("a bare number after a minus sign or ▲ is taken away; one in parentheses leaves the column unjudged", () => {
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | -10 | 2 |", "| Total | 400 | 3 |")), []);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | -10 | 2 |", "| Total | 390 | 3 |")), ["390≠400"]);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | ▲10 | 2 |", "| Total | 420 | 3 |")), ["420≠400"]);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | (10) | 2 |", "| Total | 999 | 3 |")), []);
    assert.deepEqual(found(hours("| A | -10 | 1 |", "| B | -20 | 2 |", "| Total | -25 | 3 |")), ["-25≠-30"]);
    assert.deepEqual(found(hours("| A | ▲10 | 1 |", "| B | ▲20 | 2 |", "| Total | ▲25 | 3 |")), ["▲25≠▲30"]);
    assert.deepEqual(found(hours("| A | -10 | 1 |", "| B | -20 | 2 |", "| Total | 5 | 3 |")), ["5≠-30"]);
    assert.deepEqual(found(doc("- A: -$10", "- B: -$20", "- Total: -$25")), ["-$25≠-$30"]);
  });

  it("a column mixing bare numbers and numbers with a unit is not added", () => {
    const table = (total: string): string => doc("| Item | Amount |", "| --- | --- |", "| A | $100 |", "| B | 200 |", "| C | $300 |", `| Total | ${total} |`);
    assert.deepEqual(found(table("$999")), []);
    assert.deepEqual(found(table("999")), []);
  });

  it("a bare column is added only when every cell above the total is a number, and there are two of them", () => {
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | | 2 |", "| C | 380 | 3 |", "| Total | 999 | 6 |")), []);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | n/a | 2 |", "| Total | 999 | 3 |")), []);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| Total | 999 | 1 |")), []);
  });

  it("a column of years or IDs beside a total is not added: its total cell holds no number", () => {
    const years = doc("| Year | Sales |", "| --- | --- |", "| 2024 | $100 |", "| 2025 | $200 |", "| Total | $300 |");
    assert.deepEqual(found(years), []);
    const ids = doc(
      "| ID | Year | Item | Cost |",
      "| --- | --- | --- | --- |",
      "| 1041 | 2024 | A | $100 |",
      "| 1042 | 2025 | B | $200 |",
      "| Total | | | $300 |",
    );
    assert.deepEqual(found(ids), []);
    assert.deepEqual(found(doc("| Code | Hours |", "| --- | --- |", "| 007 | 4 |", "| 012 | 5 |", "| Total | 020 |")), []);
    assert.deepEqual(found(doc("| Item | Year |", "| --- | --- |", "| A | 2024 |", "| B | 2025 |", "| Total | 2026 |")), []);
    assert.deepEqual(found(doc("| Item | ID |", "| --- | --- |", "| A | 1041 |", "| B | 1042 |", "| Total | 9999 |")), []);
    assert.deepEqual(found(doc("| Item | Hours |", "| --- | --- |", "| A | 1041 |", "| B | 1,042 |", "| Total | 9,999 |")), ["9,999≠2,083"]);
    assert.deepEqual(found(doc("| Item | Hours |", "| --- | --- |", "| A | 1200 |", "| B | 10500 |", "| Total | 12000 |")), ["12000≠11700"]);
  });

  it("a bare column whose header holds % is a rate, and is not added", () => {
    assert.deepEqual(found(doc("| Channel | Conversion % |", "| --- | --- |", "| Search | 30 |", "| Ads | 40 |", "| Total | 75 |")), []);
    assert.deepEqual(found(doc("| Channel | Visits |", "| --- | --- |", "| Search | 30 |", "| Ads | 40 |", "| Total | 75 |")), ["75≠70"]);
  });

  it("a bare column whose total is not above every item is a rate, an average or a year, and is not added", () => {
    const rates = doc("| Room | Hours | Use rate |", "| --- | --- | --- |", "| A | 410 | 85.9 |", "| B | 380 | 79.2 |", "| Total | 790 | 82.7 |");
    assert.deepEqual(found(rates), []);
    assert.deepEqual(found(doc("| Item | Year |", "| --- | --- |", "| A | 2024 |", "| B | 2025 |", "| Total | 2025 |")), []);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | 380 | 2 |", "| Total | 410 | 3 |")), []);
    assert.deepEqual(found(hours("| A | 410 | 1 |", "| B | 380 | 2 |", "| Total | 411 | 3 |")), ["411≠790"]);
    assert.deepEqual(found(doc("| Item | Amount |", "| --- | --- |", "| A | $100 |", "| B | $200 |", "| Total | $150 |")), ["$150≠$300"]);
  });

  it("a list of bare numbers is not added", () => {
    assert.deepEqual(found(doc("- A 410", "- B 380", "- Total 999")), []);
    assert.deepEqual(found(doc("- A | 410", "- B | 380", "- Total | 999")), []);
  });

  it("the sample invoices: the Japanese one's total is off; the English one adds up", () => {
    assert.deepEqual(found(fixture("invoice-ja.md"), ja, "ja"), ["2,000,000円≠2,090,000円"]);
    assert.deepEqual(found(fixture("invoice-en.md")), []);
    assert.deepEqual(found(fixture("invoice-en.md").replace("$10,260.00", () => "$10,160.00")), ["$10,160.00≠$10,260.00"]);
  });
});
