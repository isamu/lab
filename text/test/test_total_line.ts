import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isListedTotal, isPeriodTotalLine, isTotalLikeLine, isTotalLine, type TotalLineWords } from "../packages/chaff/src/structure/total-line.ts";
import { loadLexicons as loadEnglish } from "../packages/lang-en/src/lexicons.ts";
import { loadLexicons as loadJapanese } from "../packages/lang-ja/src/lexicons.ts";

// A total line's label: a total word alone, or with only qualifier words around it (total-label-qualifier).

const english = loadEnglish();
const japanese = loadJapanese();
const patterns = (lexicons: ReturnType<typeof loadEnglish>, id: string): string[] => (lexicons[id] ?? []).map((entry) => entry.pattern);

const wordsIn = (lexicons: ReturnType<typeof loadEnglish>): TotalLineWords => ({
  labels: patterns(lexicons, "total-label"),
  qualifiers: lexicons["total-label-qualifier"] ?? [],
  nounQualifiers: lexicons["total-noun-qualifier"] ?? [],
  unsummedNouns: patterns(lexicons, "total-noun-unsummed"),
  periodQualifiers: lexicons["total-period-qualifier"] ?? [],
  periodLabels: (lexicons["total-label"] ?? []).filter((entry) => entry.group === "period").map((entry) => entry.pattern),
  listedNouns: patterns(lexicons, "total-noun-listed"),
  amountNames: patterns(lexicons, "net-amount-label"),
});
const en = wordsIn(english);
const ja = wordsIn(japanese);

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

  it("reads a total with a noun when the header of the column it holds its number in names the noun", () => {
    assert.equal(isTotalLine("| Total credits earned | 29 | — |", en, "| Course | Credits | Grade |"), true);
    assert.equal(isTotalLine("| Total earned credits | 29 | — |", en, "| Course | Credits | Grade |"), true);
    assert.equal(isTotalLine("| Total credits | 29 | — |", en, "| Course | Credit | Grade |"), true);
    assert.equal(isTotalLine("| Total hours | 12 | 340 |", en, "| Module | Hours | Hours |"), true);
    assert.equal(isTotalLine("| 修得単位合計 | 29 | — |", ja, "| 科目 | 単位数 | 評価 |"), true);
    assert.equal(isTotalLine("| 単位合計 | 29 | — |", ja, "| 科目 | 単位 | 評価 |"), true);
    assert.equal(isTotalLine("| Total credits earned | **29** |", en, "| Course | Credits |"), true);
    assert.equal(isTotalLine("| Total credits earned | -2 |", en, "| Course | Credits |"), true);
    assert.equal(isTotalLine("| 控除合計 | ▲3,000円 |", ja, "| 日付 | 控除 |"), true);
    assert.equal(isTotalLine("| Total deductions | -$30 |", en, "| Date | Deduction |"), true);
    assert.equal(isTotalLine("| 交通費合計 | — | 3,000円 |", ja, "| 日付 | 宿泊費 | 交通費 |"), true);
  });

  it("does not read a noun a summed column does not name, a column the row holds no number in, or one of two named differently", () => {
    assert.equal(isTotalLine("| Total credits earned | — | 29 |", en, "| Course | Credits | Grade |"), false);
    assert.equal(isTotalLine("| Total credits earned | 29 | 87 |", en, "| Course | Credits | Grade points |"), false);
    assert.equal(isTotalLine("| Total tax | $90 |", en, "| Item | Amount |"), false);
    assert.equal(isTotalLine("| Total tax | $90 |", en, "| Item | Tax deduction |"), false);
    assert.equal(isTotalLine("| Total grade points | 29 |", en, "| Course | Grade |"), false);
    assert.equal(isTotalLine("| Total creditsearned | 29 |", en, "| Course | Credits |"), false);
    assert.equal(isTotalLine("| 修得単位合計 | 29 |", ja, "| 科目 | 評価 |"), false);
    assert.equal(isTotalLine("| 単位合計 | 29 |", ja, "| 科目 | 修得単位数 |"), false);
    assert.equal(isTotalLine("| 修得単位合計 | 29 |", ja), false);
    assert.equal(isTotalLine("| Total floor area | 52.8 m² |", en, "| Room | Floor area |"), false);
    assert.equal(isTotalLine("| 面積合計 | 52.8㎡ |", ja, "| 部屋 | 面積 |"), false);
    assert.equal(isTotalLine("| 面積合計 | 52.8㎡ |", { ...ja, unsummedNouns: [] }, "| 部屋 | 面積 |"), true);
    assert.equal(isTotalLine("| 修得単位合計 | 29 |", { ...ja, nounQualifiers: [] }, "| 科目 | 単位数 |"), false);
    assert.equal(isTotalLine("| Total credits earned | 29 |", { ...en, nounQualifiers: undefined }, "| Course | Credits |"), false);
  });

  it("reads a total with the span it covers cut off: 年間合計 as 合計, Total for the year as Total", () => {
    [
      "| 年間合計 | 98,300円 |",
      "| 年計 | 98,300円 |",
      "| 通年合計 | 98,300円 |",
      "| 年度合計 | 98,300円 |",
      "- 年間合計：98,300円",
      "| **年間合計** | 98,300円 |",
      "| 年額 | 98,300円 |",
      "- 年額：98,300円",
    ].forEach((line) => {
      assert.equal(isTotalLine(line, ja), true, line);
      assert.equal(isPeriodTotalLine(line, ja), true, line);
    });
    [
      "| Total for the year | $7,980.00 |",
      "| Year total | $7,980.00 |",
      "| Annual total | $7,980.00 |",
      "| Full-year total | $7,980.00 |",
      "- Total for the full year: $7,980.00",
      "| Subtotal per year | $7,980.00 |",
    ].forEach((line) => {
      assert.equal(isTotalLine(line, en), true, line);
      assert.equal(isPeriodTotalLine(line, en), true, line);
    });
  });

  it("does not read a prior span, a span word inside another word, or a span word with no total word after it", () => {
    [
      "| 前年合計 | 98,300円 |",
      "| 昨年合計 | 98,300円 |",
      "| 前年度合計 | 98,300円 |",
      "| 年金合計 | 98,300円 |",
      "| 年間計画 | 12件 |",
      "| 年間 | 98,300円 |",
      "| 年額保険料 | 98,300円 |",
    ].forEach((line) => assert.equal(isTotalLine(line, ja), false, line));
    [
      "| Prior-year total | $7,980.00 |",
      "| Prior year total | $7,980.00 |",
      "| Total for the prior year | $7,980.00 |",
      "| Year-to-date total | $7,980.00 |",
      "| Total for the year to date | $7,980.00 |",
      "| Yearend total | $7,980.00 |",
      "| Year | 2025 |",
      "| For the year | $7,980.00 |",
    ].forEach((line) => assert.equal(isTotalLine(line, en), false, line));
    assert.equal(isPeriodTotalLine("| 合計 | 98,300円 |", ja), false);
    assert.equal(isPeriodTotalLine("| Total | $7,980.00 |", en), false);
    assert.equal(isPeriodTotalLine("| 年間合計 | 98,300円 |", { ...ja, periodQualifiers: undefined }), false);
    assert.equal(isPeriodTotalLine("| 年額 | 98,300円 |", { ...ja, periodLabels: undefined }), false);
    assert.equal(isPeriodTotalLine("| 年間合計 | 98,300円 |", { ...ja, periodQualifiers: [{ pattern: "" }] }), false);
  });

  it("does not read anything with an empty or missing vocabulary", () => {
    assert.equal(isTotalLine("| Total per month | $2,080 |", { labels: en.labels, qualifiers: [] }), false);
    assert.equal(isTotalLine("| Total per month | $2,080 |", { labels: [], qualifiers: en.qualifiers }), false);
    assert.equal(isTotalLine("", en), false);
    assert.equal(isTotalLine("| | $2,080 |", en), false);
    assert.equal(isTotalLine("per month due", en), false);
  });

  it("reads a total whose only noun is a listed one, with no header to name it: 差引合計, 控除合計, Total deductions", () => {
    ["| 差引合計 | 72,000円 |", "| 控除合計 | 24,150円 |", "| 控除計 | 24,150円 |", "- 差引合計：72,000円"].forEach((line) =>
      assert.equal(isListedTotal(line, ja), true, line),
    );
    ["| Total deductions | $410.00 |", "| Deductions total | $410.00 |", "| Total deduction | $410.00 |", "| **Total deductions** | $410.00 |"].forEach(
      (line) => assert.equal(isListedTotal(line, en), true, line),
    );
  });

  it("does not read a plain total, an unlisted noun, a net amount, or a listed noun with another noun beside it", () => {
    [
      "| 合計 | 72,000円 |",
      "| 差引支給合計 | 250,000円 |",
      "| 差引額合計 | 250,000円 |",
      "| 消費税合計 | 9,000円 |",
      "| 支給合計 | 292,000円 |",
      "| 差引 | 72,000円 |",
      "",
    ].forEach((line) => assert.equal(isListedTotal(line, ja), false, line));
    [
      "| Total | $410 |",
      "| Total tax | $90 |",
      "| Total area | 40 m² |",
      "| Total tax deductions | $30 |",
      "| Deductions | $410 |",
      "| Totaldeductions | $1 |",
    ].forEach((line) => assert.equal(isListedTotal(line, en), false, line));
    assert.equal(isListedTotal("| Total deductions | $410 |", { labels: en.labels, qualifiers: en.qualifiers }), false);
  });

  it("reads a row as total-like when it is a total, holds a total word anywhere, or is a gross or net amount", () => {
    ["| 合計 | 1円 |", "| 支給合計 | 1円 |", "| 総支給額 | 1円 |", "| 差引支給額 | 1円 |", "| 控除合計 | 1円 |"].forEach((line) =>
      assert.equal(isTotalLikeLine(line, ja, "| 項目 | 金額 |"), true, line),
    );
    ["| Gross pay | $1 |", "| Net pay | $1 |", "| Total earnings | $1 |", "| Subtotal | $1 |"].forEach((line) =>
      assert.equal(isTotalLikeLine(line, en, "| Item | Amount |"), true, line),
    );
    ["| 基本給 | 1円 |", "| ハウスクリーニング | 1円 |", "| 総支給額の内訳 | 1円 |"].forEach((line) =>
      assert.equal(isTotalLikeLine(line, ja, "| 項目 | 金額 |"), false, line),
    );
    ["| Cleaning | $1 |", "| Gross | $1 |", "| Net pay adjustment | $1 |"].forEach((line) =>
      assert.equal(isTotalLikeLine(line, en, "| Item | Amount |"), false, line),
    );
  });
});

describe("isTotalLine: a bracketed note after the total word", () => {
  it("reads a note that ends the label as part of a total line", () => {
    [
      "| Total (incl. tax) | $2,080 |",
      "- Total (phase 1): $2,080",
      "- Subtotal (USD) $2,080",
      "| Total (see note (1)) | $2,080 |",
      "| **Total** (incl. tax) | $2,080 |",
      "| Total (see note (a (1))) | $2,080 |",
    ].forEach((line) => assert.equal(isTotalLine(line, en), true, line));
    ["| 合計（税込） | 2,080円 |", "- 小計（第1期）：2,080円", "| 合計（税込）（円） | 2,080 |", "| 合計（税込 | 2,080円 |"].forEach((line) =>
      assert.equal(isTotalLine(line, ja), true, line),
    );
  });

  it("does not read a note followed by more words as a total line: the cell names an item", () => {
    [
      "| Total (phase 1) design | $2,080 |",
      "- Total (phase 1) design: $2,080",
      "| Subtotal (USD) review fee | $2,080 |",
      "| Total (phase (a (1))) design | $2,080 |",
      String.raw`| Total (phase \| alpha) design | $2,080 |`,
    ].forEach((line) => assert.equal(isTotalLine(line, en), false, line));
    ["| 合計（第1期）設計 | 2,080円 |", "- 小計（税抜）設計費：2,080円"].forEach((line) => assert.equal(isTotalLine(line, ja), false, line));
  });
});
