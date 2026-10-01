import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 内訳の百分率の和が 100% にならない（percent-sum-mismatch）。構成比・内訳と書いた表や箇条書きの百分率を足す。

const RULE = "percent-sum-mismatch";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["sum"]));

const doc = (...lines: string[]): string => ["# Report", "", ...lines, ""].join("\n");

const table = (header: string, ...rows: string[]): string =>
  doc(`| 地域 | ${header} |`, "| --- | --- |", ...rows.map((row, index) => `| 地域${String(index + 1)} | ${row} |`));

describe("percent-sum-mismatch", () => {
  it("a table column headed 構成比 whose shares do not add up to 100%", () => {
    assert.deepEqual(found(table("構成比", "45%", "35%", "10%"), ja), ["90%"]);
    assert.deepEqual(found(table("構成比", "45%", "35%", "20%"), ja), []);
  });

  it("rounding is allowed: each share may be half its last digit off", () => {
    assert.deepEqual(found(table("構成比", "33%", "33%", "33%"), ja), []);
    assert.deepEqual(found(table("構成比", "33.3%", "33.3%", "33.3%"), ja), []);
    assert.deepEqual(found(table("構成比", "33.3%", "33.3%", "30.3%"), ja), ["96.9%"]);
  });

  it("at least one point is allowed, however fine the digits", () => {
    assert.deepEqual(found(table("構成比", "50.5%", "50.3%"), ja), []);
  });

  it("the sentence above a table with one percentage column names it", () => {
    const oneColumn = doc("売上の構成比", "", "| 地域 | 今年 |", "| --- | --- |", "| 東 | 60% |", "| 西 | 30% |");
    assert.deepEqual(found(oneColumn, ja), ["90%"]);
  });

  it("a sentence above a table with two percentage columns does not say which one is the breakdown", () => {
    const twoColumns = doc("売上の構成比と前年比", "", "| 地域 | 今年 | 前年比 |", "| --- | --- | --- |", "| 東 | 60% | 5% |", "| 西 | 30% | 3% |");
    assert.deepEqual(found(twoColumns, ja), []);
  });

  it("a list after a sentence that names a breakdown", () => {
    assert.deepEqual(found(doc("Revenue breakdown by region:", "", "- US: 60%", "- EU: 30%", "- Asia: 20%")), ["110%"]);
    assert.deepEqual(found(doc("Revenue breakdown by region:", "", "- US: 50%", "- EU: 30%", "- Asia: 20%")), []);
  });

  it("the word for a share may be in the heading right above", () => {
    assert.deepEqual(found(doc("## 売上の内訳", "", "- 国内：60％", "- 海外：30％")), []);
    assert.deepEqual(found(doc("## 売上の内訳", "", "- 国内：60％", "- 海外：30％"), ja), ["90％"]);
  });

  it("percentages that are not named as parts of one whole are not added", () => {
    assert.deepEqual(found(table("利用率", "45%", "35%", "10%"), ja), []);
    assert.deepEqual(found(doc("Conversion by channel:", "", "- Email: 3%", "- Ads: 1%")), []);
  });

  it("a share price is not a share of a whole", () => {
    assert.deepEqual(found(doc("| Company | Share price return |", "| --- | --- |", "| A | 40% |", "| B | 20% |")), []);
    assert.deepEqual(found(doc("| Region | Share of revenue |", "| --- | --- |", "| A | 40% |", "| B | 20% |")), ["60%"]);
  });

  it("a multiple-answer survey may add up to more than 100%", () => {
    assert.deepEqual(found(doc("回答の内訳（複数回答）", "", "- A：60%", "- B：50%"), ja), []);
  });

  it("a column where some row has no percentage, or a change with a sign, is not a breakdown", () => {
    assert.deepEqual(found(table("構成比", "45%", "未定", "10%"), ja), []);
    assert.deepEqual(found(table("構成比", "+45%", "-35%", "10%"), ja), []);
  });

  it("a total row is left to total-mismatch", () => {
    assert.deepEqual(found(table("構成比", "45%", "35%", "10%").replace("| 地域3 | 10% |", "| 地域3 | 10% |\n| 合計 | 100% |"), ja), []);
  });

  it("a single share is not a breakdown", () => {
    assert.deepEqual(found(doc("Market share:", "", "- Ours: 40%")), []);
  });
});
