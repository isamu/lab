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
import { signedIn, varianceColumnsOf, varianceMismatches, type VarianceWords } from "../packages/chaff/src/structure/variance-table.ts";

// 予算と決算の差が、増減の列と合わない（variance-mismatch）。例の表は自作。

const RULE = "variance-mismatch";

const WORDS: VarianceWords = {
  columns: [
    { pattern: "率", role: "rate" },
    { pattern: "%", role: "rate" },
    { pattern: "rate", role: "rate" },
    { pattern: "増減", role: "variance" },
    { pattern: "予算比", role: "variance" },
    { pattern: "variance", role: "variance" },
    { pattern: "over (under)", role: "variance" },
    { pattern: "予算", role: "budget" },
    { pattern: "budget", role: "budget" },
    { pattern: "決算", role: "actual" },
    { pattern: "実績", role: "actual" },
    { pattern: "actual", role: "actual" },
  ],
  multipliers: ["千", "million"],
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

const issuesOf = (...tables: (readonly (readonly string[])[])[]): string[] =>
  varianceMismatches(tables.map(tableOf), WORDS).map(
    (issue) => `${rowOf(issue.offset)}:${String(issue.values["written"])}>${String(issue.values["expected"])}`,
  );

const JA_HEAD = ["項目", "予算額", "決算額", "増減"];
const EN_HEAD = ["Item", "Budget", "Actual", "Variance"];

describe("variance-mismatch: reading a variance cell", () => {
  it("reads each negative notation", () => {
    ["△6,000円", "▲6,000円", "−6,000円", "-6,000円", "(6,000円)", "（6,000円）", "(6,000)円"].forEach((written) =>
      assert.equal(signedIn(written)?.value, -6000, written),
    );
    ["($20.00)", "$(20.00)", "-$20.00", "$-20.00"].forEach((written) => assert.equal(signedIn(written)?.value, -20, written));
  });
  it("reads a positive with or without +", () => {
    assert.equal(signedIn("+4,680円")?.value, 4680);
    assert.equal(signedIn("4,680円")?.value, 4680);
    assert.equal(signedIn("$23.40")?.marks, "$|");
  });
  it("reads no amount in a rate, a dash or a word", () => {
    ["98.8%", "—", "-", "なし", "", "△"].forEach((written) => assert.equal(signedIn(written), undefined, written));
  });
});

describe("variance-mismatch: the columns", () => {
  it("names one budget, actual and variance column", () => {
    assert.deepEqual(varianceColumnsOf(JA_HEAD, WORDS.columns), { budget: 1, actual: 2, variance: 3 });
    assert.deepEqual(varianceColumnsOf(["Item", "Budget", "Actual", "Over (under)"], WORDS.columns), { budget: 1, actual: 2, variance: 3 });
    assert.deepEqual(varianceColumnsOf(["科目", "予算", "実績", "予算比"], WORDS.columns), { budget: 1, actual: 2, variance: 3 });
  });
  it("reads a rate column as no variance", () => {
    assert.equal(varianceColumnsOf(["項目", "予算額", "決算額", "増減率"], WORDS.columns), undefined);
    assert.equal(varianceColumnsOf(["Item", "Budget", "Actual", "Variance %"], WORDS.columns), undefined);
    assert.deepEqual(varianceColumnsOf(["Item", "Budget", "Actual", "Variance", "Variance %"], WORDS.columns), { budget: 1, actual: 2, variance: 3 });
  });
  it("names nothing when a role is missing or named twice", () => {
    assert.equal(varianceColumnsOf(["Item", "Budget / Actual", "Actual", "Variance"], WORDS.columns), undefined);
    assert.equal(varianceColumnsOf(["項目", "当初予算", "補正予算", "決算額", "増減"], WORDS.columns), undefined);
    assert.equal(varianceColumnsOf(["項目", "前期", "当期", "増減"], WORDS.columns), undefined);
    assert.equal(varianceColumnsOf([], WORDS.columns), undefined);
  });
});

describe("variance-mismatch: the row that does not add up", () => {
  it("reports 6,090円 where actual − budget is 6,900円", () => {
    const table = [
      JA_HEAD,
      ["会費", "510,000円", "504,000円", "△6,000円"],
      ["防災用品", "80,000円", "86,900円", "6,090円"],
      ["事務費", "40,000円", "35,280円", "△4,720円"],
    ];
    assert.deepEqual(issuesOf(table), ["2:6,090円>6,900円"]);
  });
  it("reports a bracketed negative and writes the expected one in brackets", () => {
    const table = [
      EN_HEAD,
      ["Lighting", "$480.00", "$469.20", "($10.80)"],
      ["Fair", "$900.00", "$862.25", "($73.75)"],
      ["Lunch", "$600.00", "$590.00", "($10.00)"],
    ];
    assert.deepEqual(issuesOf(table), ["2:($73.75)>($37.75)"]);
  });
  it("reports a lone sign slip and writes it the way the column writes that sign", () => {
    const table = [
      JA_HEAD,
      ["会費", "510,000円", "504,000円", "▲6,000円"],
      ["補助金", "100,000円", "120,000円", "▲20,000円"],
      ["雑費", "40,000円", "35,280円", "▲4,720円"],
    ];
    assert.deepEqual(issuesOf(table), ["2:▲20,000円>20,000円"]);
  });
  it("reads each negative notation in a table", () => {
    ["−", "-"].forEach((mark) => {
      const table = [
        JA_HEAD,
        ["会費", "510,000", "504,000", `${mark}6,000`],
        ["雑費", "40,000", "35,280", `${mark}4,720`],
        ["備品", "80,000", "86,900", "6,090"],
      ];
      assert.deepEqual(issuesOf(table), ["3:6,090>6,900"], mark);
    });
  });
  it("follows the budget − actual convention when the rows do", () => {
    const table = [EN_HEAD, ["Lighting", "$480", "$469", "$11"], ["Fair", "$900", "$862", "$38"], ["Supplies", "$400", "$434", "$43"]];
    assert.deepEqual(issuesOf(table), ["3:$43>-$34"]);
  });
  it("writes the expected one like a cell with the same marks", () => {
    const table = [EN_HEAD, ["A", "$100", "$90", "($10)"], ["B", "$100", "$80", "($20)"], ["C", "100円", "90円", "11円"]];
    assert.deepEqual(issuesOf(table), ["3:11円>-10円"]);
  });
  it("reports a zero difference written as something else", () => {
    const table = [JA_HEAD, ["繰越金", "152,300円", "152,300円", "300円"], ["会費", "510,000円", "504,000円", "△6,000円"]];
    assert.deepEqual(issuesOf(table), ["1:300円>0円"]);
  });
  it("takes the document's convention (here budget − actual) for a table no row of which tells", () => {
    const decided = [JA_HEAD, ["会費", "510,000円", "504,000円", "6,000円"], ["雑費", "40,000円", "35,280円", "4,720円"]];
    const undecided = [JA_HEAD, ["敬老会", "120,000円", "118,000円", "2,200円"]];
    assert.deepEqual(issuesOf(decided, undecided), ["1:2,200円>2,000円"]);
  });
  it("allows one step of rounding for amounts in 千円 and bare numbers", () => {
    const table = [JA_HEAD, ["会費", "510千円", "504千円", "△6千円"], ["雑費", "41千円", "35千円", "△5千円"], ["備品", "80千円", "87千円", "9千円"]];
    assert.deepEqual(issuesOf(table), ["3:9千円>7千円"]);
  });
});

describe("variance-mismatch: what it does not report", () => {
  it("rows that add up, in either convention", () => {
    assert.deepEqual(
      issuesOf([JA_HEAD, ["会費", "510,000円", "504,000円", "△6,000円"], ["補助金", "100,000円", "120,000円", "20,000円"], ["繰越", "5円", "5円", "0円"]]),
      [],
    );
    assert.deepEqual(issuesOf([EN_HEAD, ["Lighting", "$480", "$469", "$11"], ["Grant", "$100", "$120", "($20)"]]), []);
  });
  it("a column of percentages", () => {
    const table = [
      ["項目", "予算額", "決算額", "予算比"],
      ["会費", "510,000円", "504,000円", "98.8%"],
      ["雑費", "40,000円", "35,280円", "88.2%"],
      ["備品", "80,000円", "86,900円", "100.0%"],
    ];
    assert.deepEqual(issuesOf(table), []);
    assert.deepEqual(
      issuesOf([
        ["項目", "予算額", "決算額", "増減率"],
        ["会費", "510,000", "504,000", "1.2"],
        ["雑費", "40,000", "35,280", "11.8"],
      ]),
      [],
    );
  });
  it("rows split evenly between the two conventions", () => {
    const table = [
      JA_HEAD,
      ["会費", "510,000円", "504,000円", "△6,000円"],
      ["雑費", "40,000円", "35,280円", "4,720円"],
      ["備品", "80,000円", "86,900円", "6,090円"],
    ];
    assert.deepEqual(issuesOf(table), []);
  });
  it("two or more rows following the other convention: a choice, not a slip", () => {
    const table = [
      EN_HEAD,
      ["Fees", "$500", "$520", "$20"],
      ["Grant", "$100", "$130", "$30"],
      ["Sales", "$300", "$340", "$40"],
      ["Lighting", "$480", "$469", "$11"],
      ["Fair", "$900", "$862", "$38"],
    ];
    assert.deepEqual(issuesOf(table), []);
  });
  it("no row that tells a convention anywhere", () => {
    assert.deepEqual(issuesOf([JA_HEAD, ["敬老会", "120,000円", "118,000円", "2,200円"]]), []);
  });
  it("rows whose cells are not amounts, or are in different units", () => {
    const table = [
      JA_HEAD,
      ["会費", "510,000円", "504,000円", "△6,000円"],
      ["雑費", "40,000円", "35,280円", "△4,720円"],
      ["新規", "—", "8,000円", "8,800円"],
      ["備品", "80千円", "86,900円", "6,090円"],
      ["印刷", "8,000円", "7,000円", "△1,100ドル"],
    ];
    assert.deepEqual(issuesOf(table), []);
  });
  it("tables without a budget, actual and variance column, and no tables", () => {
    assert.deepEqual(
      issuesOf([
        ["項目", "前期", "当期", "増減"],
        ["売上", "1,000", "1,200", "300"],
      ]),
      [],
    );
    assert.deepEqual(varianceMismatches([], WORDS), []);
    assert.deepEqual(issuesOf([JA_HEAD]), []);
  });
});

const run = (adapter: LanguageAdapter, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.line));

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

const documentOf = (title: string, table: readonly string[]): string => [title, "", ...table, ""].join("\n");

const JA_TABLE = [
  "| 項目 | 予算額 | 決算額 | 増減 |",
  "| --- | --- | --- | --- |",
  "| 防犯灯の電気代 | 96,000円 | 93,840円 | △2,160円 |",
  "| 防災用品の購入費 | 80,000円 | 86,900円 | 6,090円 |",
  "| 会議・事務費 | 40,000円 | 35,280円 | △4,720円 |",
];
const EN_TABLE = [
  "| Item | Budget | Actual | Variance |",
  "| --- | --- | --- | --- |",
  "| Street lighting | $480.00 | $469.20 | ($10.80) |",
  "| Emergency supplies | $400.00 | $434.50 | $43.50 |",
  "| Seniors' lunch | $600.00 | $590.00 | ($10.00) |",
];

describe("variance-mismatch: through the rule", () => {
  it("ja: 支出の部", () => {
    assert.deepEqual(run(ja, documentOf("# 収支決算報告書", JA_TABLE)), ["6"]);
    assert.deepEqual(
      run(
        ja,
        documentOf(
          "# 収支決算報告書",
          JA_TABLE.map((line) => line.replace("6,090円", "6,900円")),
        ),
      ),
      [],
    );
  });
  it("en: expenditure", () => {
    assert.deepEqual(run(en, documentOf("# Income and Expenditure Statement", EN_TABLE)), ["6"]);
    assert.deepEqual(
      run(
        en,
        documentOf(
          "# Income and Expenditure Statement",
          EN_TABLE.map((line) => line.replace("$43.50", () => "$34.50")),
        ),
      ),
      [],
    );
  });
  it("en: a Variance % column is left alone", () => {
    const table = [
      "| Item | Budget | Actual | Variance % |",
      "| --- | --- | --- | --- |",
      "| Street lighting | $480.00 | $469.20 | -2.3 |",
      "| Emergency supplies | $400.00 | $434.50 | 8.6 |",
    ];
    assert.deepEqual(run(en, documentOf("# Statement", table)), []);
  });
});
