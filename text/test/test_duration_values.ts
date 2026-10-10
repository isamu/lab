import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { durationValues, type DurationWord } from "../packages/chaff/src/facts/duration-values.ts";
import type { FactValue } from "../packages/chaff/src/facts/fact-values.ts";

// 期間（3 months、3ヶ月間）を名前付きの値として読む。

const WORDS: readonly DurationWord[] = [
  { pattern: "day", unit: "day" },
  { pattern: "days", unit: "day" },
  { pattern: "month", unit: "month" },
  { pattern: "months", unit: "month" },
  { pattern: "ヶ月", unit: "month" },
  { pattern: "ヶ月間", unit: "month" },
  { pattern: "か月", unit: "month" },
];

const quantity = (source: string, written: string, unit: string): FactValue => {
  const start = source.indexOf(written);
  return { start, end: start + written.length, kind: "quantity", key: written.replace(/\D/gu, ""), unit };
};

const read = (source: string, value: FactValue): string[] =>
  durationValues(source, [value], WORDS).map((duration) => `${source.slice(duration.start, duration.end)}/${duration.unit}`);

describe("durationValues: a quantity in a duration unit, up to the end of the unit word", () => {
  it("a number whose unit follows after a space (en)", () => {
    assert.deepEqual(read("Probation: 3 months", quantity("Probation: 3 months", "3", "months")), ["3 months/month"]);
    assert.deepEqual(read("Probation: 1 month.", quantity("Probation: 1 month.", "1", "month")), ["1 month/month"]);
    assert.deepEqual(read("Probation: 3\tmonths", quantity("Probation: 3\tmonths", "3", "months")), ["3\tmonths/month"]);
    assert.deepEqual(read("Leave: 10days", quantity("Leave: 10days", "10", "days")), ["10days/day"]);
  });

  it("a quantity that already holds its unit, lengthened to the longer unit word (ja)", () => {
    assert.deepEqual(read("試用期間は3ヶ月間です", quantity("試用期間は3ヶ月間です", "3ヶ月", "ヶ月")), ["3ヶ月間/month"]);
    assert.deepEqual(read("試用期間は3か月です", quantity("試用期間は3か月です", "3か月", "か月")), ["3か月/month"]);
  });

  it("other quantities, dates and names are not durations", () => {
    assert.deepEqual(read("Fee: 300 dollars", quantity("Fee: 300 dollars", "300", "dollars")), []);
    assert.deepEqual(read("会場：3階", quantity("会場：3階", "3階", "階")), []);
    const date: FactValue = { start: 0, end: 5, kind: "date", key: "05-03", unit: "" };
    assert.deepEqual(read("May 3", date), []);
    assert.deepEqual(read("3", { start: 0, end: 1, kind: "quantity", key: "3", unit: "" }), []);
  });

  it("a unit that is not written where the tree says, or that runs on into a longer word", () => {
    assert.deepEqual(read("Probation: 3, months", quantity("Probation: 3, months", "3", "months")), []);
    assert.deepEqual(read("Probation: 3 monthsx", quantity("Probation: 3 monthsx", "3", "months")), []);
    assert.deepEqual(read("3", quantity("3", "3", "months")), []);
  });
});

const RULES = { "fact-conflict": "normal", "summary-fact-mismatch": "normal" } as const;

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "fact-conflict")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const conflictEn = (...lines: string[]): string[] => found(["# Terms", "", ...lines].join("\n"), en, "en");
const conflictJa = (...lines: string[]): string[] => found(["# 条件", "", ...lines].join("\n"), ja, "ja");

describe("fact-conflict: two durations for one item", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("two lengths in one section (en)", () => {
    assert.deepEqual(conflictEn("Probation period: 3 months", "", "Probation period: 6 months"), ["Probation period:6 months≠3 months"]);
    assert.deepEqual(conflictEn("The probation period is 3 months.", "", "The probation period is 1 month."), ["The probation period:1 month≠3 months"]);
    assert.deepEqual(conflictEn("| Item | Details |", "| --- | --- |", "| Notice | 30 days |", "", "Notice: 14 days"), ["Notice:14 days≠30 days"]);
  });

  it("the same length, written in the singular or plural or another script (en, ja)", () => {
    assert.deepEqual(conflictEn("Probation period: 3 months", "", "Probation period: 3 months."), []);
    assert.deepEqual(conflictJa("試用期間：3ヶ月", "", "試用期間は3か月です。"), []);
    assert.deepEqual(conflictJa("試用期間：3ヶ月", "", "試用期間は3ヶ月間です。"), []);
  });

  it("two lengths in one section, written with different month words (ja)", () => {
    assert.deepEqual(conflictJa("試用期間：3ヶ月", "", "試用期間は6か月です。"), ["試用期間:6か月≠3ヶ月"]);
    assert.deepEqual(conflictJa("試用期間：3ヶ月", "", "試用期間は6ヶ月間です。"), ["試用期間:6ヶ月間≠3ヶ月"]);
  });

  it("a length in another unit is not compared (a year and twelve months)", () => {
    assert.deepEqual(conflictEn("Probation period: 1 year", "", "Probation period: 12 months"), []);
    assert.deepEqual(conflictJa("試用期間：1年間", "", "試用期間は12ヶ月です。"), []);
  });

  it("a time ago and a length followed by a condition are not values; an age is an age, not a length", () => {
    assert.deepEqual(conflictEn("Last review: 3 months ago.", "", "Last review: 6 months ago."), []);
    assert.deepEqual(conflictEn("Applicant: 30 years old.", "", "Applicant: 31 years old."), ["Applicant:31 years old≠30 years old"]);
    assert.deepEqual(conflictEn("Notice: 30 days before the move.", "", "Notice: 14 days before the end."), []);
  });

  it("lengths in different sections stay apart", () => {
    assert.deepEqual(conflictEn("## Full-time", "", "Probation period: 3 months", "", "## Part-time", "", "Probation period: 1 month"), []);
  });
});
