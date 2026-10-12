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
import { currencyColumnMix, type CurrencyColumnWords } from "../packages/chaff/src/structure/currency-column.ts";

// 表の一つの列に、違う通貨の金額が一つだけある（currency-column-mix）。例の表は自作。

const RULE = "currency-column-mix";

const MARKS = [
  { pattern: "円", currency: "JPY" },
  { pattern: "¥", currency: "JPY" },
  { pattern: "usd", currency: "USD" },
  { pattern: "$", currency: "USD" },
  { pattern: "eur", currency: "EUR" },
];
const AMOUNT_MARK = /¥|\$|USD|EUR|円/gu;
const CURRENCY_OF: Readonly<Record<string, string>> = { "¥": "JPY", 円: "JPY", $: "USD", USD: "USD", EUR: "EUR" };
const WORDS: CurrencyColumnWords = {
  currencies: MARKS,
  columns: ["通貨", "為替", "currency", "exchange rate"],
  amountCurrencies: (text) => [...text.matchAll(AMOUNT_MARK)].map((match) => CURRENCY_OF[match[0]] ?? "?"),
};

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

const rowOf = (offset: number): string => String(Math.floor(offset / 1000));

const issues = (rows: readonly (readonly string[])[]): string[] =>
  currencyColumnMix([tableOf(rows)], WORDS).map((issue) => `${rowOf(issue.offset)}:${String(issue.values["written"])}`);

const CHARGES = ["費目", "金額"];

describe("currency-column-mix: the one cell in another currency", () => {
  it("reports USD 45 among yen amounts", () => {
    assert.deepEqual(issues([CHARGES, ["海上運賃", "48,000円"], ["海上保険料", "USD 45"], ["書類作成費", "3,000円"]]), ["2:USD 45"]);
  });
  it("reads ¥ and 円 as one currency", () => {
    assert.deepEqual(issues([CHARGES, ["運賃", "¥48,000"], ["保険料", "6,500円"], ["手数料", "$40"], ["書類", "3,000円"]]), ["3:$40"]);
  });
  it("reports ¥12,500 among dollars, in any column", () => {
    assert.deepEqual(
      issues([
        ["Charge", "Quoted", "Billed"],
        ["Freight", "$640.00", "$640.00"],
        ["Insurance", "$85.00", "¥12,500"],
        ["Documents", "$40.00", "$40.00"],
      ]),
      ["2:¥12,500"],
    );
  });
});

describe("currency-column-mix: what it does not report", () => {
  it("a column whose heading names two currencies", () => {
    assert.deepEqual(
      issues([
        ["費目", "金額（円/USD）"],
        ["運賃", "48,000円"],
        ["保険料", "USD 45"],
        ["書類", "3,000円"],
      ]),
      [],
    );
  });
  it("a heading naming one currency still compares", () => {
    assert.deepEqual(
      issues([
        ["費目", "金額（円）"],
        ["運賃", "48,000円"],
        ["保険料", "USD 45"],
        ["書類", "3,000円"],
      ]),
      ["2:USD 45"],
    );
  });
  it("a table with a currency or an exchange-rate column", () => {
    assert.deepEqual(
      issues([
        ["費目", "通貨", "金額"],
        ["運賃", "JPY", "48,000円"],
        ["保険料", "USD", "USD 45"],
        ["書類", "JPY", "3,000円"],
      ]),
      [],
    );
    assert.deepEqual(
      issues([
        ["Item", "Amount", "Exchange rate"],
        ["Freight", "$640", "1.00"],
        ["Insurance", "¥12,500", "0.0068"],
        ["Documents", "$40", "1.00"],
      ]),
      [],
    );
  });
  it("cells with no currency at all", () => {
    assert.deepEqual(issues([CHARGES, ["運賃", "48,000"], ["保険料", "45"], ["書類", "3,000"]]), []);
  });
  it("fewer than two cells in the majority currency", () => {
    assert.deepEqual(issues([CHARGES, ["運賃", "48,000円"], ["保険料", "USD 45"]]), []);
    assert.deepEqual(issues([CHARGES, ["運賃", "48,000円"], ["保険料", "USD 45"], ["書類", "—"]]), []);
  });
  it("two cells in the other currency, or three currencies", () => {
    assert.deepEqual(issues([CHARGES, ["a", "1,000円"], ["b", "2,000円"], ["c", "3,000円"], ["d", "USD 4"], ["e", "USD 5"]]), []);
    assert.deepEqual(issues([CHARGES, ["a", "1,000円"], ["b", "2,000円"], ["c", "EUR 3"], ["d", "USD 4"]]), []);
  });
  it("a column with a cell giving two currencies converts on purpose", () => {
    assert.deepEqual(issues([CHARGES, ["a", "1,000円"], ["b", "2,000円"], ["c", "¥12,500 (USD 85)"], ["d", "USD 4"]]), []);
  });
  it("a row whose label names the odd currency", () => {
    assert.deepEqual(issues([CHARGES, ["運賃", "48,000円"], ["送金手数料（USD）", "USD 45"], ["書類", "3,000円"]]), []);
  });
  it("円 inside a word of the label names no currency", () => {
    assert.deepEqual(
      issues([
        ["Item", "Amount"],
        ["License", "$100"],
        ["Support", "$50"],
        ["円滑化支援", "¥12,500"],
      ]),
      ["3:¥12,500"],
    );
  });
  it("an empty set of tables, and a header with no body", () => {
    assert.deepEqual(currencyColumnMix([], WORDS), []);
    assert.deepEqual(issues([CHARGES]), []);
  });
});

const run = (adapter: LanguageAdapter, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.line));

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

const documentOf = (title: string, table: readonly string[]): string => [title, "", ...table, ""].join("\n");

const JA_TABLE = ["| 費目 | 金額 |", "| --- | --- |", "| 海上運賃 | 48,000円 |", "| 海上保険料 | USD 45 |", "| 書類作成費 | 3,000円 |"];
const EN_TABLE = ["| Charge | Amount |", "| --- | --- |", "| Ocean freight | $640.00 |", "| Marine insurance | ¥12,500 |", "| Documentation fee | $40.00 |"];

describe("currency-column-mix: through the rule", () => {
  it("ja: 付帯費用の明細", () => {
    assert.deepEqual(run(ja, documentOf("# インボイス", JA_TABLE)), ["6"]);
    assert.deepEqual(
      run(
        ja,
        documentOf(
          "# インボイス",
          JA_TABLE.map((line) => line.replace("USD 45", "6,500円")),
        ),
      ),
      [],
    );
  });
  it("en: other charges", () => {
    assert.deepEqual(run(en, documentOf("# Commercial Invoice", EN_TABLE)), ["6"]);
    assert.deepEqual(
      run(
        en,
        documentOf(
          "# Commercial Invoice",
          EN_TABLE.map((line) => line.replace("¥12,500", () => "$85.00")),
        ),
      ),
      [],
    );
  });
  it("a table with a currency column is left alone", () => {
    const table = [
      "| Charge | Currency | Amount |",
      "| --- | --- | --- |",
      "| Freight | USD | $640.00 |",
      "| Insurance | JPY | ¥12,500 |",
      "| Fee | USD | $40.00 |",
    ];
    assert.deepEqual(run(en, documentOf("# Commercial Invoice", table)), []);
  });
  it("a heading naming two currencies is left alone", () => {
    const table = JA_TABLE.map((line) => line.replace("| 金額 |", "| 金額（円/USD） |"));
    assert.deepEqual(run(ja, documentOf("# インボイス", table)), []);
  });
  it("ja: a table with an FX column is left alone", () => {
    const table = ["| 費目 | FX | 金額 |", "| --- | --- | --- |", "| 運賃 | 1.00 | $640 |", "| 保険料 | 0.0068 | ¥12,500 |", "| 書類 | 1.00 | $40 |"];
    assert.deepEqual(run(ja, documentOf("# インボイス", table)), []);
  });
});
