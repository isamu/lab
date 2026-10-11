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
import { cumulativeBelowCurrent, cumulativeColumnsOf, type CumulativeWord } from "../packages/chaff/src/structure/cumulative-below-current.ts";

// 当月の列と累計の列のある表で、累計が当月より小さい行（cumulative-below-current）。例の表は自作。

const RULE = "cumulative-below-current";

const WORDS: readonly CumulativeWord[] = [
  { pattern: "当月", role: "current" },
  { pattern: "当第", role: "current" },
  { pattern: "this period", role: "current" },
  { pattern: "current", role: "current" },
  { pattern: "累計", role: "cumulative" },
  { pattern: "ytd", role: "cumulative" },
  { pattern: "year to date", role: "cumulative" },
  { pattern: "前月", role: "prior" },
  { pattern: "prior", role: "prior" },
  { pattern: "平均", role: "level" },
  { pattern: "rate", role: "level" },
  { pattern: "balance", role: "level" },
];

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

/** Each issue as "row:cumulative<current", the row counted from the first body row as 1. */
const issues = (rows: readonly (readonly string[])[]): string[] =>
  cumulativeBelowCurrent([tableOf(rows)], WORDS).map(
    (issue) => `${String(Math.floor(issue.offset / 1000))}:${String(issue.values["cumulative"])}<${String(issue.values["current"])}`,
  );

describe("cumulative-below-current: the columns the headings name", () => {
  it("one this-period and one cumulative column, wherever they stand", () => {
    assert.deepEqual(cumulativeColumnsOf(["項目", "当月", "2026年1月からの累計"], WORDS), { current: 1, cumulative: 2 });
    assert.deepEqual(cumulativeColumnsOf(["YTD", "Item", "Current"], WORDS), { current: 2, cumulative: 0 });
  });
  it("「当月累計」 is the running total, and 「前月累計」 / 'Prior YTD' is neither column", () => {
    assert.deepEqual(cumulativeColumnsOf(["項目", "当月", "前月累計", "当月累計"], WORDS), { current: 1, cumulative: 3 });
    assert.deepEqual(cumulativeColumnsOf(["Item", "Current", "Prior YTD"], WORDS), undefined);
  });
  it("names no columns when one is missing or doubled, or the headings name different units", () => {
    assert.equal(cumulativeColumnsOf(["項目", "前年同期", "当第2四半期累計"], WORDS), undefined, "no this-period column");
    assert.equal(cumulativeColumnsOf(["Item", "This period", "Amount"], WORDS), undefined, "no cumulative column");
    assert.equal(cumulativeColumnsOf(["Benefit", "Current balance", "YTD contributions"], WORDS), undefined, "a balance is not this period");
    assert.deepEqual(cumulativeColumnsOf(["項目", "当第2四半期", "当第2四半期累計"], WORDS), { current: 1, cumulative: 2 });
    assert.equal(cumulativeColumnsOf(["項目", "当月予算", "当月実績", "累計"], WORDS), undefined, "two this-period columns");
    assert.equal(cumulativeColumnsOf(["項目", "当月", "累計予算", "累計実績"], WORDS), undefined, "two cumulative columns");
    assert.equal(cumulativeColumnsOf(["項目", "当月（千円）", "累計（百万円）"], WORDS), undefined, "different units");
    assert.equal(cumulativeColumnsOf([], WORDS), undefined);
  });
});

describe("cumulative-below-current: the rows", () => {
  const PAY = ["項目", "当月", "累計"];
  it("a cumulative figure below this period's is reported, each such row", () => {
    const rows = [PAY, ["総支給額", "327,200円", "2,912,400円"], ["所得税", "7,750円", "6,890円"], ["住民税", "14,800円", "1,480円"]];
    assert.deepEqual(issues(rows), ["2:6,890円<7,750円", "3:1,480円<14,800円"]);
  });
  it("a cumulative figure equal to this period's (the first month) or above it is right", () => {
    assert.deepEqual(issues([PAY, ["所得税", "7,750円", "7,750円"], ["総支給額", "327,200円", "2,912,400円"]]), []);
  });
  it("decimals: a difference the rounding of either figure can reach is not reported, one it cannot is", () => {
    const header = ["Item", "This period", "Year to date"];
    assert.deepEqual(issues([header, ["Tax", "$96.04", "$96.0"]]), []);
    assert.deepEqual(issues([header, ["Tax", "$96.00", "$85.80"]]), ["1:$85.80<$96.00"]);
  });
  it("a blank cell, a dash or a negative figure is not compared: a refund can make a year-to-date figure fall", () => {
    const rows = [
      PAY,
      ["所得税", "7,750円", ""],
      ["住民税", "14,800円", "—"],
      ["還付", "▲3,000円", "▲5,000円"],
      ["調整", "3,000円", "(1,000)円"],
      ["年末調整", "5,000円", "-1,000円"],
    ];
    assert.deepEqual(issues(rows), []);
  });
  it("figures written in different units are not compared", () => {
    assert.deepEqual(issues([PAY, ["売上", "1,200千円", "800百万円"]]), []);
  });
  it("a row of a level (an average, a rate) is not compared; the label is the first column's", () => {
    assert.deepEqual(issues([PAY, ["平均単価", "1,200円", "1,100円"]]), []);
    assert.deepEqual(
      issues([
        ["Item", "Current", "YTD"],
        ["Overtime rate", "$25.00", "$24.50"],
      ]),
      [],
    );
    assert.deepEqual(
      issues([
        ["当月", "累計", "項目"],
        ["1,200円", "1,100円", "平均"],
      ]),
      ["1:1,100円<1,200円"],
      "no label column first",
    );
  });
  it("prior columns are not compared, and a table without the two columns says nothing", () => {
    assert.deepEqual(
      issues([
        ["項目", "当月", "前月までの累計"],
        ["売上", "1,200円", "0円"],
      ]),
      [],
    );
    assert.deepEqual(
      issues([
        ["Item", "Amount"],
        ["Tax", "$96.00"],
      ]),
      [],
    );
  });
  it("rows with a cell short are not read, and an empty table says nothing", () => {
    assert.deepEqual(issues([PAY, ["所得税", "7,750円"]]), []);
    assert.deepEqual(issues([PAY]), []);
    assert.deepEqual(cumulativeBelowCurrent([], WORDS), []);
  });
});

const run = (adapter: LanguageAdapter, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)}:${String(finding.values["cumulative"])}<${String(finding.values["current"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("cumulative-below-current: through the rule", () => {
  it("ja: 給与明細の年初からの累計", () => {
    const table = ["| 項目 | 当月 | 2026年1月からの累計 |", "| --- | --- | --- |", "| 総支給額 | 327,200円 | 2,912,400円 |", "| 所得税 | 7,750円 | 6,890円 |"];
    assert.deepEqual(run(ja, ["# 給与明細書", "", ...table, ""].join("\n")), ["6:6,890円<7,750円"]);
    const fixed = table.map((line) => line.replace("6,890円", "68,900円"));
    assert.deepEqual(run(ja, ["# 給与明細書", "", ...fixed, ""].join("\n")), []);
  });
  it("ja: 前月累計と当月累計の並ぶ月報は当月累計と比べる", () => {
    const table = [
      "| 品目 | 前月累計 | 当月 | 当月累計 |",
      "| --- | --- | --- | --- |",
      "| 部品A | 2,400個 | 300個 | 2,700個 |",
      "| 部品B | 100個 | 500個 | 600個 |",
    ];
    assert.deepEqual(run(ja, ["# 出荷の月報", "", ...table, ""].join("\n")), []);
  });
  it("en: a payslip's year to date", () => {
    const table = [
      "| Item | This period | Year to date |",
      "| --- | --- | --- |",
      "| Gross pay | $1,661.00 | $14,820.00 |",
      "| Federal income tax | $96.00 | $85.80 |",
    ];
    assert.deepEqual(run(en, ["# Payslip", "", ...table, ""].join("\n")), ["6:$85.80<$96.00"]);
    const fixed = table.map((line) => line.replace("$85.80", () => "$858.00"));
    assert.deepEqual(run(en, ["# Payslip", "", ...fixed, ""].join("\n")), []);
  });
  it("en: Current / YTD with a refund row and a rate row", () => {
    const table = [
      "| Earnings | Rate | Current | YTD |",
      "| --- | --- | --- | --- |",
      "| Regular | $17.00 | $1,496.00 | $13,200.00 |",
      "| Refund | | -$40.00 | -$12.00 |",
    ];
    assert.deepEqual(run(en, ["# Pay stub", "", ...table, ""].join("\n")), []);
  });
});
