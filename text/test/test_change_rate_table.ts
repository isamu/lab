import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import {
  columnsOf,
  rateIn,
  tableRateMismatches,
  valueIn,
  type ChangeTable,
  type ColumnWord,
} from "../packages/chaff/src/structure/change-rate-table.ts";

// 表の行の、前期・当期・増減率の食い違い（change-rate-mismatch）。例の表は自作。

const RULE = "change-rate-mismatch";

const WORDS: readonly ColumnWord[] = [
  { pattern: "増減率", role: "rate" },
  { pattern: "前年同期比", role: "rate" },
  { pattern: "前期比", role: "rate" },
  { pattern: "YoY", role: "rate" },
  { pattern: "Change (%)", role: "rate" },
  { pattern: "増減", role: "change" },
  { pattern: "Change", role: "change" },
  { pattern: "前期", role: "base" },
  { pattern: "前年同期", role: "base" },
  { pattern: "Prior year", role: "base" },
  { pattern: "当期", role: "current" },
  { pattern: "Current year", role: "current" },
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

const issues = (rows: readonly (readonly string[])[]): string[] =>
  tableRateMismatches([tableOf(rows)], WORDS).map((issue) => `${String(issue.values["rate"])}:${String(issue.values["computed"])}`);

describe("change-rate-mismatch in a table: the pure reading", () => {
  it("finds the columns by their heading words, rate words before period words", () => {
    assert.deepEqual(columnsOf(["項目", "前期", "当期", "増減率"], WORDS), { base: 1, current: 2, rate: 3, percentOnly: false });
    assert.deepEqual(columnsOf(["項目", "当期", "前年同期", "前年同期比"], WORDS), { base: 2, current: 1, rate: 3, percentOnly: false });
    assert.deepEqual(columnsOf(["Item", "Prior year", "Current year", "Change"], WORDS), { base: 1, current: 2, rate: 3, percentOnly: true });
    assert.deepEqual(columnsOf(["Item", "Prior year", "Current year", "Change (%)"], WORDS), { base: 1, current: 2, rate: 3, percentOnly: false });
  });

  it("dates two columns by their years when no heading word names them, the earlier year as the base", () => {
    assert.deepEqual(columnsOf(["Item", "FY2026", "FY2025", "YoY"], WORDS), { base: 2, current: 1, rate: 3, percentOnly: false });
    assert.deepEqual(columnsOf(["項目", "2025年3月期", "2026年3月期", "増減率"], WORDS), { base: 1, current: 2, rate: 3, percentOnly: false });
  });

  it("finds no columns when a role is missing or not single", () => {
    assert.equal(columnsOf(["項目", "前期", "当期"], WORDS), undefined);
    assert.equal(columnsOf(["項目", "A社", "B社", "増減率"], WORDS), undefined);
    assert.equal(columnsOf(["項目", "前期", "当期", "増減率", "前期比"], WORDS), undefined);
    assert.equal(columnsOf(["Item", "FY2024", "FY2025", "FY2026", "YoY"], WORDS), undefined);
    assert.equal(columnsOf(["Item", "FY2025", "FY2025", "YoY"], WORDS), undefined);
    assert.equal(columnsOf([], WORDS), undefined);
    assert.equal(columnsOf(["項目", "前期", "当期", "増減率"], []), undefined);
  });

  it("reads a rate cell with its sign, and nothing else as a rate", () => {
    assert.deepEqual(rateIn("12.0%", false), { sign: "", value: 12, decimals: 1, digits: "12.0" });
    assert.deepEqual(rateIn(" +12.0% ", true), { sign: "+", value: 12, decimals: 1, digits: "12.0" });
    assert.equal(rateIn("△5.0%", true)?.value, -5);
    assert.equal(rateIn("▲5.0%", true)?.value, -5);
    assert.equal(rateIn("−5.0%", true)?.value, -5);
    assert.equal(rateIn("-5.0", false)?.value, -5);
    assert.equal(rateIn("**12.0%**", true)?.value, 12);
    assert.equal(rateIn("１２．０％", true)?.value, 12);
    for (const cell of ["12.0", "1.2pt", "0.5ポイント", "(5.0)%", "(5.0%)", "—", "", "1.2倍", "12.0% (est.)", "abc"]) {
      assert.equal(rateIn(cell, true), undefined, cell);
    }
    assert.equal(rateIn("1.2pt", false), undefined);
  });

  it("reads a value cell with the marks around its number, and no signed or percent value", () => {
    assert.deepEqual(valueIn("1,200"), { value: 1200, step: 1, marks: "|" });
    assert.deepEqual(valueIn("$2,400 million"), { value: 2400, step: 1, marks: "$|million" });
    assert.deepEqual(valueIn("2,400百万円"), { value: 2400, step: 1, marks: "|百万円" });
    assert.equal(valueIn("12.5")?.step, 0.1);
    for (const cell of ["7.0%", "-50", "△50", "(50)", "—", "", "1,200 / 1,300"]) assert.equal(valueIn(cell), undefined, cell);
  });

  it("reports a rate the two values do not give, with the computed rate signed as the cell writes it", () => {
    assert.deepEqual(
      issues([
        ["項目", "前期", "当期", "増減率"],
        ["売上高", "1,200", "1,320", "12.0%"],
        ["営業利益", "84", "96", "14.3%"],
        ["費用", "500", "470", "△5.0%"],
        ["在庫", "500", "470", "5.0%"],
      ]),
      ["12.0:10.0", "△5.0:△6.0", "5.0:-6.0"],
    );
    assert.deepEqual(
      issues([
        ["Item", "Prior year", "Current year", "Change"],
        ["Net sales", "1,200", "1,320", "+12.0%"],
      ]),
      ["+12.0:+10.0"],
    );
  });

  it("allows the rounding of the values and of the rate", () => {
    assert.deepEqual(
      issues([
        ["項目", "前期", "当期", "増減率"],
        ["売上高", "1,200", "1,320", "10.0%"],
        ["営業利益", "84", "96", "14.3%"],
        ["純利益", "52,000", "60,000", "15.4%"],
        ["粗利", "12", "13", "10%"],
      ]),
      [],
    );
  });

  it("is silent on a cell that is not a number, points, a zero base, other units, or a row of another length", () => {
    assert.deepEqual(
      issues([
        ["項目", "前期", "当期", "増減率"],
        ["営業利益率", "7.0%", "8.0%", "1.0pt"],
        ["営業利益率", "7.0%", "8.0%", "20.0%"],
        ["新規事業", "0", "120", "50.0%"],
        ["売上高", "—", "1,320", "12.0%"],
        ["売上高", "1,200", "1,320", "—"],
        ["売上高", "1,200百万円", "1.32十億円", "12.0%"],
        ["売上高", "1,200", "1,320"],
        ["純損益", "△100", "50", "50.0%"],
      ]),
      [],
    );
    assert.deepEqual(
      issues([
        ["Item", "Prior year", "Current year", "Change"],
        ["Net sales", "1,200", "1,320", "+12.0"],
        ["Net sales", "1,200", "1,320", "(5.0)%"],
      ]),
      [],
    );
    assert.deepEqual(
      issues([
        ["Item", "A", "B", "Change"],
        ["Net sales", "1,200", "1,320", "+12.0%"],
      ]),
      [],
    );
  });
});

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["rate"])}:${String(finding.values["computed"])}`);

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("change-rate-mismatch in a table: through the rule", () => {
  it("ja: 前期・当期・増減率の表の行", () => {
    const table = (rate: string): string =>
      ["# 決算", "", "| 項目 | 前期 | 当期 | 前年同期比 |", "| --- | --- | --- | --- |", `| 売上高 | 1,200 | 1,320 | ${rate} |`, ""].join("\n");
    assert.deepEqual(found(table("12.0%"), ja), ["12.0:10.0"]);
    assert.deepEqual(found(table("10.0%"), ja), []);
    assert.deepEqual(found(table("10.0ポイント"), ja), []);
  });

  it("en: a table dated by fiscal years, with a Change column", () => {
    const table = (rate: string): string =>
      ["# Results", "", "| Item | FY2025 | FY2026 | Change |", "| --- | --- | --- | --- |", `| Net sales | 1,200 | 1,320 | ${rate} |`, ""].join("\n");
    assert.deepEqual(found(table("+12.0%"), en), ["+12.0:+10.0"]);
    assert.deepEqual(found(table("+10.0%"), en), []);
    assert.deepEqual(found(table("+12.0"), en), []);
  });

  it("does not read a table inside a code block", () => {
    const text = ["# 決算", "", "```", "| 項目 | 前期 | 当期 | 増減率 |", "| --- | --- | --- | --- |", "| 売上高 | 1,200 | 1,320 | 12.0% |", "```", ""].join("\n");
    assert.deepEqual(found(text, ja), []);
  });
});
