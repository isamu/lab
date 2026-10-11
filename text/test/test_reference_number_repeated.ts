import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import type { ChangeTable } from "../packages/chaff/src/structure/change-rate-table.ts";
import { referenceColumnOf, repeatedReferences } from "../packages/chaff/src/structure/reference-number-repeated.ts";

// 明細の表で、同じ領収書・請求書の番号が二つの行にある所（reference-number-repeated）。例の表は自作。

const RULE = "reference-number-repeated";
const WORDS = ["領収書番号", "領収書No.", "Receipt no.", "Invoice no.", "Ref."];

/** A table written as rows of cell texts, with offsets counted along one line per row. */
const tableOf = (rows: readonly (readonly string[])[]): ChangeTable => {
  const lines = rows.map((texts, line) =>
    texts.map((text, index) => {
      const start = line * 1000 + index * 100;
      return { start, end: start + text.length, text };
    }),
  );
  const [header = [], ...body] = lines;
  return { header, rows: body };
};

/** Each repeat as "row:number<first row", the rows counted from the first body row as 1. */
const repeats = (rows: readonly (readonly string[])[]): string[] =>
  repeatedReferences([tableOf(rows)], WORDS).map(
    (repeat) => `${String(Math.floor(repeat.offset / 1000))}:${repeat.number}<${String(Math.floor(repeat.firstOffset / 1000))}`,
  );

describe("reference-number-repeated: the column the heading names", () => {
  it("a heading that is a lexicon word as a whole, ignoring case, width and spaces", () => {
    assert.equal(referenceColumnOf(["日付", "領収書番号", "金額"], WORDS), 1);
    assert.equal(referenceColumnOf(["日付", "領収書 Ｎｏ．", "金額"], WORDS), 1);
    assert.equal(referenceColumnOf(["Date", "RECEIPT NO.", "Amount"], WORDS), 1);
    assert.equal(referenceColumnOf(["**Ref.**", "Amount"], WORDS), 0);
  });
  it("no column: a heading that only contains a word, a bare No., a code or account column, or two reference columns", () => {
    assert.equal(referenceColumnOf(["Date", "Reference book", "Amount"], WORDS), undefined);
    assert.equal(referenceColumnOf(["No.", "Account no.", "Category code"], WORDS), undefined);
    assert.equal(referenceColumnOf(["Receipt no.", "Invoice no.", "Amount"], WORDS), undefined);
    assert.equal(referenceColumnOf([], WORDS), undefined);
  });
});

describe("reference-number-repeated: the rows", () => {
  it("names the second row and the first", () => {
    const rows = [
      ["日付", "領収書番号", "金額"],
      ["4月6日", "K-118", "480円"],
      ["4月8日", "K-119", "1,210円"],
      ["4月9日", "K-119", "2,350円"],
    ];
    assert.deepEqual(repeats(rows), ["3:K-119<2"]);
  });
  it("rows apart, and numbers written in different case, width or spacing are the same number", () => {
    const rows = [
      ["Date", "Receipt no.", "Amount"],
      ["Apr 6", "r-12", "$4"],
      ["Apr 7", "R-13", "$5"],
      ["Apr 8", "Ｒ－１２", "$6"],
    ];
    assert.deepEqual(repeats(rows), ["3:R-12<1"]);
    const spaced = [
      ["Date", "Invoice no.", "Amount"],
      ["Apr 6", "INV 2041", "$4"],
      ["Apr 7", "INV2041", "$5"],
    ];
    assert.deepEqual(repeats(spaced), ["2:INV2041<1"]);
  });
  it("blank, dash, なし and N/A cells hold no digit and are not numbers", () => {
    const rows = [
      ["日付", "領収書番号", "金額"],
      ["4月6日", "", "480円"],
      ["4月7日", "", "520円"],
      ["4月8日", "-", "1,210円"],
      ["4月9日", "-", "2,350円"],
      ["4月10日", "なし", "300円"],
      ["4月11日", "なし", "300円"],
      ["4月12日", "N/A", "300円"],
      ["4月13日", "N/A", "300円"],
      ["4月14日", "K-120", "300円"],
    ];
    assert.deepEqual(repeats(rows), []);
  });
  it("a table grouped by slip is not compared: two numbers repeat, or one number is on three rows", () => {
    const twoRepeats = [
      ["Date", "Invoice no.", "Debit", "Credit"],
      ["Apr 1", "INV-1", "$100", ""],
      ["Apr 2", "INV-2", "$200", ""],
      ["Apr 20", "INV-1", "", "$100"],
      ["Apr 21", "INV-2", "", "$200"],
    ];
    assert.deepEqual(repeats(twoRepeats), []);
    const threeRows = [
      ["Item", "Receipt no.", "Amount"],
      ["Room", "H-77", "$120"],
      ["Breakfast", "H-77", "$15"],
      ["Parking", "H-77", "$10"],
    ];
    assert.deepEqual(repeats(threeRows), []);
    const shortThird = [
      ["Date", "Invoice no.", "Item", "Amount"],
      ["Apr 1", "INV-7", "Room", "$100"],
      ["Apr 2", "INV-7", "Breakfast", "$20"],
      ["Apr 3", "INV-7", "Parking"],
    ];
    assert.deepEqual(repeats(shortThird), [], "a row short of a cell still counts its number");
  });
  it("all different numbers, a table with no reference column, a short row and no tables say nothing", () => {
    assert.deepEqual(
      repeats([
        ["Date", "Receipt no.", "Amount"],
        ["Apr 6", "R-1", "$4"],
        ["Apr 7", "R-2", "$5"],
      ]),
      [],
    );
    assert.deepEqual(
      repeats([
        ["Date", "Category code", "Amount"],
        ["Apr 6", "C-1", "$4"],
        ["Apr 7", "C-1", "$5"],
      ]),
      [],
    );
    assert.deepEqual(repeats([["Date", "Receipt no.", "Amount"], ["Apr 6", "R-1", "$4"], ["R-1"]]), []);
    assert.deepEqual(repeatedReferences([], WORDS), []);
  });
});

const run = (adapter: LanguageAdapter, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)}:${String(finding.values["number"])}<${String(finding.values["firstLine"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

const JA_CLAIM = [
  "# 経費精算書",
  "",
  "| 日付 | 領収書番号 | 内容 | 金額 |",
  "| --- | --- | --- | --- |",
  "| 2026年4月6日 | K-118 | 電車代 | 480円 |",
  "| 2026年4月8日 | K-119 | 文具代 | 1,210円 |",
  "| 2026年4月9日 | K-119 | タクシー代 | 2,350円 |",
  "| 小計 | | | 4,040円 |",
  "",
];

const EN_CLAIM = [
  "# Expense claim",
  "",
  "| Date | Receipt no. | Description | Amount |",
  "| --- | --- | --- | --- |",
  "| April 6, 2026 | K-118 | Train fare | $12.40 |",
  "| April 8, 2026 | K-119 | Stationery | $21.10 |",
  "| April 9, 2026 | K-119 | Taxi | $35.50 |",
  "| Subtotal | | | $69.00 |",
  "",
];

describe("reference-number-repeated: through the rule", () => {
  it("Japanese: the second row is reported with the line of the first", () => {
    assert.deepEqual(run(ja, JA_CLAIM.join("\n")), ["7:K-119<6"]);
  });
  it("English: the same", () => {
    assert.deepEqual(run(en, EN_CLAIM.join("\n")), ["7:K-119<6"]);
  });
  it("the corrected claims say nothing", () => {
    assert.deepEqual(run(ja, JA_CLAIM.join("\n").replace("| 2026年4月9日 | K-119", "| 2026年4月9日 | K-120")), []);
    assert.deepEqual(run(en, EN_CLAIM.join("\n").replace("| April 9, 2026 | K-119", "| April 9, 2026 | K-120")), []);
  });
  it("the same number in two different tables is not a repeat", () => {
    const text = [
      "| 日付 | 領収書番号 | 金額 |",
      "| --- | --- | --- |",
      "| 4月6日 | K-1 | 480円 |",
      "",
      "| 日付 | 領収書番号 | 金額 |",
      "| --- | --- | --- |",
      "| 5月6日 | K-1 | 520円 |",
      "",
    ];
    assert.deepEqual(run(ja, text.join("\n")), []);
  });
  it("a column of category codes or account numbers repeats rightly and is not read", () => {
    const text = ["| Date | Account no. | Amount |", "| --- | --- | --- |", "| April 6 | 1020-33 | $4 |", "| April 7 | 1020-33 | $5 |", ""];
    assert.deepEqual(run(en, text.join("\n")), []);
  });
});
