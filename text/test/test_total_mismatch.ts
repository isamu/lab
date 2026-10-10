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

  it("a total word with a period, due or grand beside it is a total line; a label with another word is not", () => {
    const costs = (label: string, total: string): string =>
      doc("| Item | Amount |", "| --- | --- |", "| Rent | $1,850 |", "| Service charge | $120 |", "| Parking space | $60 |", `| ${label} | ${total} |`);
    ["Total per month", "Monthly total", "Total due", "Total monthly cost", "Grand total", "Total (incl. tax)"].forEach((label) => {
      assert.deepEqual(found(costs(label, "$2,180")), ["$2,180≠$2,030"], label);
      assert.deepEqual(found(costs(label, "$2,030")), [], label);
    });
    ["Total area", "Total floor space", "Total tax", "Rent per month"].forEach((label) => assert.deepEqual(found(costs(label, "$2,180")), [], label));
  });

  it("a total with a noun is read when the table's header names the noun: 控除合計 under 控除項目, Total deductions under Deduction", () => {
    const deductions = (total: string): string =>
      doc(
        "| 控除項目 | 金額 |",
        "| --- | --- |",
        "| 健康保険料 | 16,400円 |",
        "| 厚生年金保険料 | 30,000円 |",
        "| 所得税 | 7,750円 |",
        `| 控除合計 | ${total} |`,
      );
    assert.deepEqual(found(deductions("55,150円"), ja, "ja"), ["55,150円≠54,150円"]);
    assert.deepEqual(found(deductions("54,150円"), ja, "ja"), []);
    const english = (total: string): string =>
      doc(
        "| Deduction | Amount |",
        "| --- | --- |",
        "| Income tax | $702.00 |",
        "| Medicare | $84.97 |",
        "| Health insurance | $145.00 |",
        `| Total deductions | ${total} |`,
      );
    assert.deepEqual(found(english("$941.97")), ["$941.97≠$931.97"]);
    assert.deepEqual(found(english("$931.97")), []);
  });

  it("a total with a noun the header does not name is not read: one table holding earnings and deductions, Total tax", () => {
    const payslip = (header: string, deductionsTotal: string): string =>
      doc(
        `| ${header} | 金額 |`,
        "| --- | --- |",
        "| 基本給 | 280,000円 |",
        "| 通勤手当 | 12,000円 |",
        "| 総支給額 | 292,000円 |",
        "| 健康保険料 | 16,400円 |",
        "| 所得税 | 7,750円 |",
        `| 控除合計 | ${deductionsTotal} |`,
      );
    assert.deepEqual(found(payslip("項目", "24,150円"), ja, "ja"), []);
    assert.deepEqual(found(payslip("項目", "25,150円"), ja, "ja"), []);
    const tax = doc("| Taxable item | Amount |", "| --- | --- |", "| Hosting | $600 |", "| Support | $300 |", "| Total tax | $90 |");
    assert.deepEqual(found(tax), []);
    assert.deepEqual(found(doc("- Income tax: $702", "- Medicare: $84", "- Total deductions: $900")), []);
  });

  it("支給合計 and 控除合計 in one table under a header naming neither are not read, so neither is summed with the other's rows", () => {
    const table = (earnings: string, deductions: string): string =>
      doc(
        "| 支給・控除 | 金額 |",
        "| --- | --- |",
        "| 基本給 | 280,000円 |",
        "| 通勤手当 | 12,000円 |",
        `| 支給合計 | ${earnings} |`,
        "| 健康保険料 | 16,400円 |",
        "| 所得税 | 7,750円 |",
        `| 控除合計 | ${deductions} |`,
      );
    assert.deepEqual(found(table("292,000円", "24,150円"), ja, "ja"), []);
    assert.deepEqual(found(table("293,000円", "25,150円"), ja, "ja"), []);
  });

  it("a second table written right under the first starts its own rows and its own header", () => {
    const tables = (firstHeader: string, secondHeader: string, total = "$30"): string =>
      doc(
        `| ${firstHeader} | Amount |`,
        "| --- | --- |",
        "| Parking | $5 |",
        `| ${secondHeader} | Amount |`,
        "| --- | --- |",
        "| Income tax | $10 |",
        "| Medicare | $20 |",
        `| Total deductions | ${total} |`,
      );
    assert.deepEqual(found(tables("Item", "Deduction")), []);
    assert.deepEqual(found(tables("Deduction", "Item")), []);
    assert.deepEqual(found(tables("Item", "Deduction", "$35")), ["$35≠$30"]);
    assert.deepEqual(
      found(
        doc("| Item | Amount |", "| --- | --- |", "| Parking | $5 |", "| Item | Amount |", "| --- | --- |", "| A | $10 |", "| B | $20 |", "| Total | $30 |"),
      ),
      [],
    );
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

  describe("counters the analyser does not read as counters: 単位, コマ, credits", () => {
    const credits = (unit: string, total: string): string =>
      unit.startsWith(" ")
        ? doc(
            "| Course | Credits |",
            "| --- | --- |",
            `| Algebra | 4${unit} |`,
            `| Analysis | 6${unit} |`,
            `| English | 6${unit} |`,
            `| Total | ${total}${unit} |`,
          )
        : doc("| 科目 | 単位数 |", "| --- | --- |", `| 線形代数 | 4${unit} |`, `| 解析学 | 6${unit} |`, `| 英語 | 6${unit} |`, `| 合計 | ${total}${unit} |`);

    it("a credits table whose total is not the sum is reported, in the way it is written", () => {
      assert.deepEqual(found(credits("単位", "18"), ja, "ja"), ["18単位≠16単位"]);
      assert.deepEqual(found(credits("コマ", "18"), ja, "ja"), ["18コマ≠16コマ"]);
      assert.deepEqual(found(credits(" credits", "18")), ["18 credits≠16 credits"]);
      assert.deepEqual(found(credits(" sessions", "17")), ["17 sessions≠16 sessions"]);
    });

    it("a credits table that adds up is silent", () => {
      assert.deepEqual(found(credits("単位", "16"), ja, "ja"), []);
      assert.deepEqual(found(credits(" credits", "16")), []);
      assert.deepEqual(found(credits(" Units", "16")), []);
    });

    it("the singular and the plural are one unit", () => {
      assert.deepEqual(found(doc("- Ethics: 1 credit", "- Algebra: 3 credits", "- Total: 5 credits")), ["5 credits≠4 credits"]);
      assert.deepEqual(found(doc("- Ethics: 1 credit", "- Algebra: 3 credits", "- Total: 4 credits")), []);
    });

    it("a column mixing units is not added", () => {
      const mixed = doc("| 科目 | 量 |", "| --- | --- |", "| 線形代数 | 4単位 |", "| 演習 | 6コマ |", "| 英語 | 6単位 |", "| 合計 | 18単位 |");
      assert.deepEqual(found(mixed, ja, "ja"), []);
      assert.deepEqual(found(doc("- Algebra: 4 credits", "- Lab: 6 sessions", "- Total: 18 credits")), []);
    });

    it("packs, boxes and other containers are counted, singular and plural alike", () => {
      const packs = (total: string): string =>
        doc("| Pack size | Packs affected |", "| --- | --- |", "| Single bar | 4,200 packs |", "| 6-bar box | 2,400 packs |", `| Total | ${total} packs |`);
      assert.deepEqual(found(packs("6,800")), ["6,800 packs≠6,600 packs"]);
      assert.deepEqual(found(packs("6,600")), []);
      assert.deepEqual(found(doc("- Lid: 1 piece", "- Body: 2 pieces", "- Total: 4 pieces")), ["4 pieces≠3 pieces"]);
      assert.deepEqual(found(doc("- Morning: 1 tablet", "- Evening: 2 tablets", "- Total: 3 tablets")), []);
    });

    it("a column mixing packs and boxes is not added", () => {
      assert.deepEqual(found(doc("| Item | Count |", "| --- | --- |", "| Bars | 40 packs |", "| Gift sets | 12 boxes |", "| Total | 60 packs |")), []);
    });

    it("can, set and cases are not counted: a verb, an adjective, instances that may overlap", () => {
      assert.deepEqual(found(doc("- Item 2 can be returned", "- Item 3 can be exchanged", "- Total: 4 cans")), []);
      assert.deepEqual(found(doc("- Form A: 2 set values", "- Form B: 3 set values", "- Total: 6 sets")), []);
      assert.deepEqual(found(doc("- Rule A applies in 2 cases", "- Rule B applies in 3 cases", "- Total: 6 cases")), []);
    });

    it("単位 that is not a number of credits is not an amount: a caption, a rate, an ordinal, a longer word", () => {
      const caption = (total: string): string =>
        ["# 予算", "", "単位：千円", "", "| 項目 | 金額 |", "| --- | --- |", "| 人件費 | 1,200 |", "| 外注費 | 300 |", `| 合計 | ${total} |`].join("\n");
      assert.deepEqual(found(caption("1,500"), ja, "ja"), []);
      assert.deepEqual(found(caption("1,600"), ja, "ja"), ["1,600≠1,500"]);
      assert.deepEqual(found(doc("- 線形代数: 1単位あたり2時間", "- 解析学: 1単位あたり2時間", "- 合計: 5単位あたり"), ja, "ja"), []);
      assert.deepEqual(found(doc("- 履修: 第2単位", "- 演習: 第3単位", "- 合計: 9単位"), ja, "ja"), []);
      assert.deepEqual(found(doc("- A: 4コマ漫画", "- B: 6コマ漫画", "- 合計: 18コマ"), ja, "ja"), []);
      assert.deepEqual(found(doc("- 3 unit-priced line items", "- 4 unit-priced add-ons", "- Total: 8 units shipped")), []);
    });
  });

  describe("measured amounts: mass, volume and length", () => {
    const strengths = (total: string, rows: readonly string[] = ["300mg", "60mg", "75mg"]): string =>
      doc("| 成分 | 3錠中の量 |", "| --- | --- |", ...rows.map((row, index) => `| 成分${String(index + 1)} | ${row} |`), `| 合計 | ${total} |`);

    it("a strengths table whose total is not the sum is reported, in the way the total is written", () => {
      assert.deepEqual(found(strengths("445mg"), ja, "ja"), ["445mg≠435mg"]);
      assert.deepEqual(found(doc("| Ingredient | Amount |", "| --- | --- |", "| A | 200 mg |", "| B | 100 mg |", "| C | 50 mg |", "| Total | 380 mg |")), [
        "380 mg≠350 mg",
      ]);
      assert.deepEqual(found(doc("- Water: 1.5 L", "- Milk: 250 mL", "- Total: 2 L")), ["2 L≠1.75 L"]);
      assert.deepEqual(found(doc("- 区間A: 1.2 km", "- 区間B: 800 m", "- 合計: 2.5 km"), ja, "ja"), ["2.5 km≠2.0 km"]);
      assert.deepEqual(found(strengths("1.2g", ["1,000mg", "234mg"]), ja, "ja"), ["1.2g≠1.234g"]);
    });

    it("a total that adds up is silent, across units of one kind", () => {
      assert.deepEqual(found(strengths("435mg"), ja, "ja"), []);
      assert.deepEqual(found(strengths("1g", ["500mg", "0.5g"]), ja, "ja"), []);
      assert.deepEqual(found(doc("- Water: 1.5 L", "- Milk: 250 mL", "- Total: 1.75 L")), []);
      assert.deepEqual(found(doc("- Water: 1.5 L", "- Milk: 250 mL", "- Total: 1,750 mL")), []);
    });

    it("a column mixing kinds of measure, or a measure and money, is not added", () => {
      assert.deepEqual(found(strengths("500mg", ["300mg", "60mL", "75mg"]), ja, "ja"), []);
      assert.deepEqual(found(doc("- Flour: 200 g", "- Milk: 300 mL", "- Total: 900 g")), []);
      assert.deepEqual(found(doc("- Flour: 200 g", "- Fee: $3", "- Total: 900 g")), []);
    });

    it("a per-unit, rough or ranged amount stops the sum of its column", () => {
      assert.deepEqual(found(strengths("500mg", ["300mg/錠", "60mg/錠", "75mg/錠"]), ja, "ja"), []);
      assert.deepEqual(found(strengths("500mg", ["300mg", "約60mg", "75mg"]), ja, "ja"), []);
      assert.deepEqual(found(strengths("500mg", ["300mg", "60mg程度", "75mg"]), ja, "ja"), []);
      assert.deepEqual(found(strengths("500mg", ["300mg", "50〜60mg", "75mg"]), ja, "ja"), []);
      assert.deepEqual(found(strengths("約500mg"), ja, "ja"), []);
      assert.deepEqual(found(doc("- A: 5 mg per mL", "- B: 10 mg per mL", "- Total: 20 mg per mL")), []);
      assert.deepEqual(found(doc("- A: about 200 mg", "- B: 100 mg", "- Total: 400 mg")), []);
      assert.deepEqual(found(doc("| A | 5 mg (per tablet) |", "| B | 10 mg (per tablet) |", "| Total | 20 mg (per tablet) |")), []);
      assert.deepEqual(found(doc("- Flour: $3 / 200 g", "- Sugar: $2 / 100 g", "- Total: 900 g")), []);
      assert.deepEqual(found(doc("- 醤油: 大さじ1", "- 酒: 15mL", "- みりん: 30mL", "- 合計: 60mL"), ja, "ja"), []);
    });

    it("units whose factors do not divide evenly add up without a rounding difference", () => {
      assert.deepEqual(found(doc("| Item | Amount |", "| --- | --- |", "| A | 8 oz |", "| B | 8 oz |", "| Total | 1 lb |")), []);
      assert.deepEqual(found(doc("| Item | Amount |", "| --- | --- |", "| A | 8 oz |", "| B | 9 oz |", "| Total | 1 lb |")), ["1 lb≠1.063 lb"]);
    });

    it("a nutrition label's 'Total Fat' and 'Total Carbohydrate' rows are names, not total rows", () => {
      const label = doc(
        "| Nutrient | Amount |",
        "| --- | --- |",
        "| Total Fat | 8 g |",
        "| Saturated Fat | 1 g |",
        "| Sodium | 160 mg |",
        "| Total Carbohydrate | 37 g |",
        "| Dietary Fiber | 4 g |",
      );
      assert.deepEqual(found(label), []);
    });

    it("a measure in a sentence is not compared: only table and list totals add measures", () => {
      assert.deepEqual(found(doc("The tablet contains 300 mg of A and 60 mg of B, for a total of 500 mg."), en), []);
    });
  });

  it("the sample invoices: the Japanese one's total is off; the English one adds up", () => {
    assert.deepEqual(found(fixture("invoice-ja.md"), ja, "ja"), ["2,000,000円≠2,090,000円"]);
    assert.deepEqual(found(fixture("invoice-en.md")), []);
    assert.deepEqual(found(fixture("invoice-en.md").replace("$10,260.00", () => "$10,160.00")), ["$10,160.00≠$10,260.00"]);
  });
  describe("a total written in a sentence", () => {
    const jaFound = (...lines: string[]): string[] => found(doc(...lines), ja, "ja");

    it("the items, then the total phrase and the total: compared with the items in the sentence", () => {
      assert.deepEqual(jaFound("委託料の内訳は、保守費60,000円、運用費30,000円とし、合計100,000円とする。"), ["100,000円≠90,000円"]);
      assert.deepEqual(jaFound("委託料の内訳は、保守費60,000円、運用費40,000円とし、合計100,000円とする。"), []);
      assert.deepEqual(found(doc("The fee consists of $6,000 for hosting and $2,000 for support, for a total of $9,000.")), ["$9,000≠$8,000"]);
      assert.deepEqual(found(doc("The fee consists of $6,000 for hosting and $3,000 for support, for a total of $9,000.")), []);
    });

    it("the total, then a breakdown phrase and the items, up to the end of the brackets it is in", () => {
      assert.deepEqual(jaFound("甲は、月額150,000円（内訳：保守費90,000円、運用費50,000円）を支払う。"), ["150,000円≠140,000円"]);
      assert.deepEqual(jaFound("甲は、月額150,000円（内訳：保守費90,000円、運用費60,000円）を支払い、遅延したときは1日につき1,000円を加える。"), []);
      assert.deepEqual(found(doc("The plan costs $8 per month, made up of a base fee of $5 and a storage fee of $2.")), ["$8≠$7"]);
      assert.deepEqual(found(doc("The plan costs $8 per month, made up of a base fee of $6 and a storage fee of $2.")), []);
    });

    it("an amount away from the phrase, a discount, or a single item is not a reason to report", () => {
      assert.deepEqual(jaFound("遅延損害金は1日につき1,000円とし、保守費60,000円及び運用費30,000円の合計90,000円を支払う。"), []);
      assert.deepEqual(jaFound("本体価格100,000円から値引き10,000円を差し引き、合計90,000円とする。"), []);
      assert.deepEqual(jaFound("単価1,000円の部品を10個、合計10,000円で購入する。"), []);
      assert.deepEqual(jaFound("合計100,000円のうち、30,000円を前払いとする。"), []);
      assert.deepEqual(found(doc("The fee consists of $100 for hosting and $20 for support, for a total of $80.")), ["$80≠$120"]);
      assert.deepEqual(
        found(doc("Customer shall pay a $1,000 onboarding fee and a monthly subscription, consisting of a base fee of $600 and a support fee of $300.")),
        [],
      );
      assert.deepEqual(jaFound("保守費60,000円、運用費30,000円とし、合計は、100,000円とする。"), ["100,000円≠90,000円"]);
      assert.deepEqual(jaFound("保守費60,000円、運用費30,000円とし、合計金100,000円とする。"), ["100,000円≠90,000円"]);
      assert.deepEqual(found(doc("The fee is $9,000, including $1,000 for setup and $500 for training.")), []);
      assert.deepEqual(found(doc("Item A is $100 and item B is $200, a subtotal of $300, plus tax of $30, for a total of $330.")), []);
    });

    it("items in another unit are not added, and a total in a list line is reported once", () => {
      assert.deepEqual(jaFound("作業は3日、費用は60,000円と30,000円で、合計100,000円とする。"), ["100,000円≠90,000円"]);
      assert.deepEqual(jaFound("費用は60,000円、作業は3日、合計5日とする。"), []);
      assert.deepEqual(found(doc("- A: $1,200", "- B: $300", "- Total: $1,600")), ["$1,600≠$1,500"]);
    });
  });
});
