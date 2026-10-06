import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { changeRateMismatches, type ChangeText } from "../packages/chaff/src/structure/change-rate.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 一つの文の、もとの値・今の値・増減率の食い違い（change-rate-mismatch）。例文は自作。

const RULE = "change-rate-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 報告\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["rate"])}:${String(finding.values["computed"])}`);

before(async () => prepare());

describe("change-rate-mismatch", () => {
  it("ja: もとの値（から・に比べて）と今の値から計算した率と、書いた率が違う", () => {
    assert.deepEqual(found("利用企業は1,200社となり、前年同月の1,000社から25%増えました。", ja), ["25:20"]);
    assert.deepEqual(found("利用企業は1,200社となり、前年同月の1,000社から20%増えました。", ja), []);
    assert.deepEqual(found("会員は800人で、前年の1,000人に比べて20%の減少となった。", ja), []);
    assert.deepEqual(found("会員は800人で、前年の1,000人に比べて15%の減少となった。", ja), ["15:20"]);
    // 向きが逆なら違う。
    assert.deepEqual(found("会員は800人で、前年の1,000人から20%増えた。", ja), ["20:20"]);
  });

  it("en: from / compared with, with a word of direction beside the rate", () => {
    assert.deepEqual(found("1,200 companies used the app, up 25% from 1,000 companies a year earlier.", en), ["25:20"]);
    assert.deepEqual(found("1,200 companies used the app, up 20% from 1,000 companies a year earlier.", en), []);
    assert.deepEqual(found("Revenue was $9.0 million, a decline of 10% from $10.0 million.", en), []);
    assert.deepEqual(found("Revenue was $9.0 million, a decline of 20% from $10.0 million.", en), ["20:10"]);
  });

  it("allows the rounding of values written to a coarse step", () => {
    assert.deepEqual(found("売上高は12億円で、前年同期の10億円に比べて25%の増加となった。", ja), []);
    assert.deepEqual(found("Sales were $12 million, an increase of 25% from $10 million.", en), []);
    assert.deepEqual(found("売上高は12.0億円で、前年同期の10.0億円に比べて25%の増加となった。", ja), ["25:20"]);
  });

  it("does not compare: two rates, no marked base, no single current value, no direction, a rate of something else", () => {
    assert.deepEqual(found("売上は1,200億円で前年の1,000億円から25%増、利益は5%減った。", ja), []);
    assert.deepEqual(found("利用企業は1,200社で、25%増えました。", ja), []);
    assert.deepEqual(found("利用企業は1,200社、1,100社、前年の1,000社から25%増えました。", ja), []);
    assert.deepEqual(found("利用企業は1,200社となり、前年同月の1,000社から満足度は25%だった。", ja), []);
    assert.deepEqual(found("店舗は100店から120店に増え、同じ期間に売上高も前年より15%増えた。", ja), []);
    assert.deepEqual(found("Prices went from $10 to $12; demand rose 15% over the year.", en), []);
    assert.deepEqual(found("Sales rose 20% from $10 million to $900,000 in costs.", en), []);
    // An amount after the rate, not marked as the value reached, is about something else.
    assert.deepEqual(found("Costs rose 20% from $1,000, and revenue was $1,300.", en), []);
    // "up to" is a ceiling; a year is a point in time.
    assert.deepEqual(found("The program covers 1,300 companies, up to 25% from 1,000 companies in 2024.", en), []);
    assert.deepEqual(found("2024 revenue was 1,300, up 25% from 2020 revenue of 1,000.", en), []);
  });

  it("reads the value reached when marked (to, に), and a base whose mark stands beside the rate", () => {
    assert.deepEqual(found("Users rose 25% from 1,000 users to 1,200 users.", en), ["25:20"]);
    assert.deepEqual(found("会員は1,000人から1,200人に25%増えた。", ja), ["25:20"]);
    assert.deepEqual(found("Revenue was $1,300, up 25% compared with $1,000.", en), ["25:30"]);
  });
});

describe("changeRateMismatches", () => {
  const sentence = { start: 0, end: 100 };
  const base: ChangeText = {
    sentences: [sentence],
    figures: [
      { start: 0, end: 5, value: 1200, unit: "社", step: 1 },
      { start: 20, end: 26, value: 1000, unit: "社", step: 1 },
    ],
    rates: [{ start: 28, end: 31, value: 25, decimals: 0 }],
    directions: [{ start: 31, end: 32, sign: 1 }],
    marks: [{ start: 26, end: 28, position: "after" }],
    targets: [],
  };

  it("reports the rate and the computed one", () => {
    assert.deepEqual(changeRateMismatches(base), [{ offset: 28, values: { rate: "25", computed: "20" } }]);
  });

  it("reads nothing without each part, or with a base of zero", () => {
    assert.deepEqual(changeRateMismatches({ ...base, sentences: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, rates: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, directions: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, marks: [] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, directions: [...base.directions, { start: 32, end: 33, sign: -1 }] }), []);
    const zero = {
      ...base,
      figures: [base.figures[0], { start: 20, end: 26, value: 0, unit: "社", step: 1 }].flatMap((figure) => (figure === undefined ? [] : [figure])),
    };
    assert.deepEqual(changeRateMismatches(zero), []);
  });

  it("allows half the rate's last digit", () => {
    assert.deepEqual(changeRateMismatches({ ...base, rates: [{ start: 28, end: 33, value: 20.04, decimals: 2 }] }), []);
    assert.deepEqual(changeRateMismatches({ ...base, rates: [{ start: 28, end: 32, value: 20.4, decimals: 1 }] }), [
      { offset: 28, values: { rate: "20.4", computed: "20.0" } },
    ]);
  });
});
