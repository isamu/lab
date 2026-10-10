import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTotalLine, type TotalLineWords } from "../packages/chaff/src/structure/total-line.ts";
import { loadLexicons as loadEnglish } from "../packages/lang-en/src/lexicons.ts";
import { loadLexicons as loadJapanese } from "../packages/lang-ja/src/lexicons.ts";

// A total line's label: a total word alone, or with only qualifier words around it (total-label-qualifier).

const english = loadEnglish();
const japanese = loadJapanese();
const patterns = (lexicons: ReturnType<typeof loadEnglish>, id: string): string[] => (lexicons[id] ?? []).map((entry) => entry.pattern);

const en: TotalLineWords = { labels: patterns(english, "total-label"), qualifiers: english["total-label-qualifier"] ?? [] };
const ja: TotalLineWords = { labels: patterns(japanese, "total-label"), qualifiers: japanese["total-label-qualifier"] ?? [] };

describe("isTotalLine", () => {
  it("reads a total word with a period, a due or a grand around it as a total line", () => {
    [
      "| Total per month | $2,080 |",
      "| Monthly total | $2,080 |",
      "| Total (incl. tax) | $2,080 |",
      "| Grand total | $2,080 |",
      "| Total due | $2,080 |",
      "| Total monthly cost | $2,080 |",
      "- Total a month: $2,080",
      "- **Total per month**: $2,080",
      "- Annual total (estimated): $24,960",
      "| Subtotal per year | $24,960 |",
      "- Total per month (2 units): $2,080",
      "- Total per month $2,080",
    ].forEach((line) => assert.equal(isTotalLine(line, en), true, line));
  });

  it("keeps the total lines it read before", () => {
    ["| Total | $2,080 |", "- Total: $1,500", "- Subtotal: $300", "| Sum | 12 |", "Total $40"].forEach((line) =>
      assert.equal(isTotalLine(line, en), true, line),
    );
    ["| 合計（月額） | 104,500円 |", "| 合計 | 900,000円 |", "- 小計：300円"].forEach((line) => assert.equal(isTotalLine(line, ja), true, line));
  });

  it("does not read a label with any other word as a total line", () => {
    [
      "| Total area | 52.8 m² |",
      "| Total floor space | 120 m² |",
      "| Total tax | $30 |",
      "- Total conversion: 25%",
      "| Totals | $2,080 |",
      "| Rent per month | $1,850 |",
      "| Monthly | $1,850 |",
      "| Per month | $1,850 |",
      "- The total per month is $2,080",
      "| Service charge | $120 |",
      "| A total | $100 |",
      "| Total grand | $100 |",
      "| Due total | $100 |",
      "| Monthly total 2024 tax | $50 |",
      "- Monthly total 2024 tax: $50",
    ].forEach((line) => assert.equal(isTotalLine(line, en), false, line));
  });

  it("a qualifier is read only on its own side of the total word", () => {
    const words = (position: "before" | "after" | undefined): TotalLineWords => ({ labels: ["Total"], qualifiers: [{ pattern: "due", position }] });
    assert.equal(isTotalLine("| Total due | $1 |", words("after")), true);
    assert.equal(isTotalLine("| Due total | $1 |", words("after")), false);
    assert.equal(isTotalLine("| Due total | $1 |", words("before")), true);
    assert.equal(isTotalLine("| Total due | $1 |", words("before")), false);
    assert.equal(isTotalLine("| Due total due | $1 |", words(undefined)), true);
  });

  it("reads a total word with a noun as a total line when the table's header names that noun", () => {
    assert.equal(isTotalLine("| Total deductions | $1,585.99 |", en, "| Deduction | Amount |"), true);
    assert.equal(isTotalLine("| Deductions total | $1,585.99 |", en, "| Deductions | Amount |"), true);
    assert.equal(isTotalLine("| Total monthly deductions | $1,585.99 |", en, "| Deduction | Amount |"), true);
    assert.equal(isTotalLine("| Expenses subtotal | $90 |", en, "| Expense | Amount |"), true);
    assert.equal(isTotalLine("| Subtotal deductions | $1 |", en, "| Deduction | Amount |"), true);
    assert.equal(isTotalLine("| 控除合計 | 70,913円 |", ja, "| 控除項目 | 金額 |"), true);
    assert.equal(isTotalLine("| 交通費小計 | 3,000円 |", ja, "| 交通費 | 金額 |"), true);
    assert.equal(isTotalLine("| 控除計 | 70,913円 |", ja, "| 控除 | 金額 |"), true);
  });

  it("does not read a noun the header does not name, a noun too short to be named, or one with no header", () => {
    assert.equal(isTotalLine("| Total deductions | $1,585.99 |", en), false);
    assert.equal(isTotalLine("| Total deductions | $1,585.99 |", en, "| Item | Amount |"), false);
    assert.equal(isTotalLine("| Total tax | $30 |", en, "| Taxable item | Amount |"), false);
    assert.equal(isTotalLine("| Total tax | $30 |", en, "| Tax deduction | Amount |"), false);
    assert.equal(isTotalLine("| Total tax deductions | $30 |", en, "| Tax deduction | Amount |"), true);
    assert.equal(isTotalLine("| Total area | 52.8 m² |", en, "| Room | Area |"), false);
    assert.equal(isTotalLine("| Totals deductions | $1 |", en, "| Deduction | Amount |"), false);
    assert.equal(isTotalLine("| 控除合計 | 70,913円 |", ja, "| 項目 | 金額 |"), false);
    assert.equal(isTotalLine("| 控除合計 | 70,913円 |", ja, "| 社会保険料控除 | 金額 |"), false);
    assert.equal(isTotalLine("| 設計 | 300,000円 |", ja, "| 設計工程 | 金額 |"), false);
    assert.equal(isTotalLine("| 合計額 | 300,000円 |", ja, "| 項目 | 金額 |"), false);
    assert.equal(isTotalLine("- 控除合計：3,074円", ja), false);
  });

  it("does not read anything with an empty or missing vocabulary", () => {
    assert.equal(isTotalLine("| Total per month | $2,080 |", { labels: en.labels, qualifiers: [] }), false);
    assert.equal(isTotalLine("| Total per month | $2,080 |", { labels: [], qualifiers: en.qualifiers }), false);
    assert.equal(isTotalLine("", en), false);
    assert.equal(isTotalLine("| | $2,080 |", en), false);
    assert.equal(isTotalLine("per month due", en), false);
  });
});
