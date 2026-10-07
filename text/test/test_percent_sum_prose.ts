import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { proseShareMismatches } from "../packages/chaff/src/structure/percent-sum-prose.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 一つの文に並べた内訳（「構成比は、Aが50%、Bが30%、Cが20%」）の百分率の和が 100% にならない（percent-sum-mismatch）。例文は自作。

const RULE = "percent-sum-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.line)} ${String(finding.values["sum"])}`);

const doc = (...lines: string[]): string => ["# 報告", "", ...lines, ""].join("\n");

before(async () => prepare());

describe("percent-sum-mismatch: a breakdown in one sentence", () => {
  it("ja: 構成比・内訳の文の百分率を足す", () => {
    assert.deepEqual(found(doc("製品別の構成比は、業務用ソフトが50%、保守が30%、研修が25%だった。"), ja), ["3 105%"]);
    assert.deepEqual(found(doc("利用企業の業種別の内訳は、小売が45%、製造が35%、物流が20%です。"), ja), []);
    assert.deepEqual(found(doc("利用企業の業種別の内訳は、小売が45％、製造が35％、物流が15％です。"), ja), ["3 95％"]);
  });

  it("en: a share word, or made up / accounted for", () => {
    assert.deepEqual(found(doc("By product, software made up 50% of sales, maintenance 30% and training 25%."), en), ["3 105%"]);
    assert.deepEqual(found(doc("By product, software made up 50% of sales, maintenance 30% and training 20%."), en), []);
    assert.deepEqual(found(doc("The breakdown is 40% retail, 35% manufacturing and 20% logistics."), en), ["3 95%"]);
  });

  it("adds a sentence with no share word when one of its parts is the rest of the whole (その他, other)", () => {
    assert.deepEqual(found(doc("数字の誤りが 45%、欄の抜けが 30%、欄の入れ違いが 20%、その他が 8% である。"), ja), ["3 103%"]);
    assert.deepEqual(found(doc("数字の誤りが 45%、欄の抜けが 30%、欄の入れ違いが 20%、その他が 5% である。"), ja), []);
    assert.deepEqual(found(doc("Wrong digits 45%, missing fields 30%, swapped fields 20% and other 8%."), en), ["3 103%"]);
    assert.deepEqual(found(doc("Wrong digits 45%, missing fields 30%, swapped fields 20% and other 5%."), en), []);
    assert.deepEqual(found(doc("Retail 50%, wholesale 30%, and others: 15%."), en), ["3 95%"]);
  });

  it("does not read the rest in another word, or with something between it and the percentage", () => {
    assert.deepEqual(found(doc("Retail grew 50%, wholesale 30%, and another 15%."), en), []);
    assert.deepEqual(found(doc("Retail grew 50%, wholesale 30%, and otherwise 15%."), en), []);
    assert.deepEqual(found(doc("Retail grew 50%, wholesale 30%, other costs rose 15%."), en), []);
    assert.deepEqual(found(doc("小売が45%、製造が35%、その他の部門も25%伸びた。"), ja), []);
  });

  it("does not read the rest in a sentence of changes, before the last share, or as what is left", () => {
    assert.deepEqual(found(doc("Sales grew 45%, costs 30%, margins 20%, and other 8% year over year."), en), []);
    assert.deepEqual(found(doc("Sales 45%, costs 30%, margins 20%, and the rest 8% next year."), en), []);
    assert.deepEqual(found(doc("Other 8%, retail 45%, wholesale 30% and online 20%."), en), []);
    assert.deepEqual(found(doc("工程Aは45%、工程Bは30%、工程Cは20%、残り8%は来週実施する。"), ja), []);
    assert.deepEqual(found(doc("小売が45%、製造が30%、物流が20%、その他が8%増加した。"), ja), []);
  });

  it("does not add: no share word, two parts, a change (+3%), multiple answers, a total, or a listing of some parts", () => {
    assert.deepEqual(found(doc("小売が45%、製造が35%、物流が25%伸びた。"), ja), []);
    assert.deepEqual(found(doc("内訳は、小売が45%、製造が35%だった。"), ja), []);
    assert.deepEqual(found(doc("構成比は、Aが+50%、Bが30%、Cが25%動いた。"), ja), []);
    assert.deepEqual(found(doc("内訳（複数回答）は、Aが50%、Bが40%、Cが30%だった。"), ja), []);
    assert.deepEqual(found(doc("内訳は、Aが50%、Bが30%、Cが25%で、合計は105%だった。"), ja), []);
    assert.deepEqual(found(doc("内訳は、Aが50%、Bが20%、Cが10%などだった。"), ja), []);
  });

  it("does not add percentages of different wholes or of two periods, which add up far from 100%", () => {
    assert.deepEqual(found(doc("Women accounted for 55% of directors, 48% of managers, and 42% of employees."), en), []);
    assert.deepEqual(found(doc("By segment, software made up 45% of sales (40% last year), hardware 35% (30%), and services 20% (30%)."), en), []);
  });

  it("a word that contains a total label (集計) does not stop the sum", () => {
    assert.deepEqual(found(doc("調査の集計では、内訳はAが50%、Bが30%、Cが25%だった。"), ja), ["3 105%"]);
  });

  it("a line a list or a table already reported is not reported again", () => {
    const source = doc("構成比は次のとおり。", "", "- Aが50%、Bが30%、Cが25%", "- Dが10%");
    assert.ok(found(source, ja).length <= 1);
  });
});

describe("proseShareMismatches", () => {
  const words = { labels: ["内訳"], exceptions: [], units: ["%"], totalLabels: ["合計"] };
  const source = "内訳はAが50%、Bが30%、Cが25%。";
  const amount = (text: string, value: number): { offset: number; end: number; value: number; unit: string } => {
    const offset = source.indexOf(text);
    return { offset, end: offset + text.length, value, unit: "%" };
  };
  const amounts = [amount("50%", 50), amount("30%", 30), amount("25%", 25)];

  it("reports the sum at the first share", () => {
    assert.deepEqual(proseShareMismatches(source, [{ start: 0, end: source.length }], amounts, words), [
      { offset: source.indexOf("50%"), values: { sum: "105%" } },
    ]);
  });

  it("reads nothing without share words, sentences or percentages", () => {
    assert.deepEqual(proseShareMismatches(source, [{ start: 0, end: source.length }], amounts, { ...words, labels: [] }), []);
    assert.deepEqual(proseShareMismatches(source, [], amounts, words), []);
    assert.deepEqual(proseShareMismatches(source, [{ start: 0, end: source.length }], [], words), []);
  });

  it("allows rounding: half the last digit per share, at least one point", () => {
    const decimals = "内訳はAが33.3%、Bが33.3%、Cが33.3%。";
    const parts = [...decimals.matchAll(/33\.3%/gu)].map((match) => ({ offset: match.index, end: match.index + match[0].length, value: 33.3, unit: "%" }));
    assert.equal(parts.length, 3);
    assert.deepEqual(proseShareMismatches(decimals, [{ start: 0, end: decimals.length }], parts, words), []);
  });
});
