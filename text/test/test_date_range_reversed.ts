import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 期間の終わりが始まりより前（date-range-reversed）。「4月1日〜3月31日」のように、範囲の記号でつないだ二つの日付を比べる。

const RULE = "date-range-reversed";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["start"])}>${String(finding.values["end"])}`);

/** The period as the finding shows it. */
const periods = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["period"]));

const doc = (...lines: string[]): string => ["# Plan", "", ...lines, ""].join("\n");

describe("date-range-reversed", () => {
  it("a Japanese period joined by 〜 that ends before it starts, with weekdays in brackets", () => {
    assert.deepEqual(found(doc("期間は2026年4月1日（水）〜2026年3月31日（火）です。"), ja), ["2026-04-01>2026-03-31"]);
    assert.deepEqual(found(doc("期間は2026年4月1日（水）〜2027年3月31日（水）です。"), ja), []);
  });

  it("から … まで is a period; から alone is not (it may be a change of date)", () => {
    assert.deepEqual(found(doc("2026年4月1日から2026年3月1日まで受け付けます。"), ja), ["2026-04-01>2026-03-01"]);
    assert.deepEqual(found(doc("会議を2026年4月10日から2026年4月3日に変更します。"), ja), []);
  });

  it("a period of one day is not reversed", () => {
    assert.deepEqual(found(doc("休館日：2026年4月1日〜2026年4月1日"), ja), []);
  });

  it("a period wrapped onto the next line is still a period", () => {
    assert.deepEqual(found(doc("期間は2026年4月1日〜", "2026年3月31日です。"), ja), ["2026-04-01>2026-03-31"]);
    assert.deepEqual(periods(doc("期間は2026年4月1日〜", "2026年3月31日です。"), ja), ["2026年4月1日〜 2026年3月31日"]);
  });

  it("a line that ends with a range mark and a next line with words before the date is not a period", () => {
    assert.deepEqual(found(doc("開始は2026年4月1日〜", "受付の締切は2026年3月31日です。"), ja), []);
  });

  it("a list of dates, newest first, is not a period: the dash is the list's mark", () => {
    assert.deepEqual(found(doc("- 2026年3月24日", "- 2025年6月5日"), ja), []);
    assert.deepEqual(found(doc("- 24 March 2026", "- 5 June 2025")), []);
  });

  it("months are compared as months", () => {
    assert.deepEqual(found(doc("- 対象：2026年4月〜2025年3月"), ja), ["2026-04>2025-03"]);
  });

  it("a period written without a year may cross into the next year, so it is not judged", () => {
    assert.deepEqual(found(doc("休業：12月28日〜1月4日"), ja), []);
    assert.deepEqual(found(doc("休業：2026年12月28日〜1月4日"), ja), []);
  });

  it("an English period with a dash or through", () => {
    assert.deepEqual(found(doc("The trip runs March 5, 2026 – March 3, 2026.")), ["2026-03-05>2026-03-03"]);
    assert.deepEqual(found(doc("Open 5 April 2026 through 2 April 2026.")), ["2026-04-05>2026-04-02"]);
    assert.deepEqual(found(doc("Open 2 April 2026 through 5 April 2026.")), []);
  });

  it("to may move a date rather than span a period, so it is not a range", () => {
    assert.deepEqual(found(doc("The review moved from March 10, 2026 to March 3, 2026.")), []);
  });

  it("times inside a period are read past", () => {
    assert.deepEqual(found(doc("2026年4月2日 10:00〜2026年4月1日 12:00"), ja), ["2026-04-02>2026-04-01"]);
  });

  it("two dates with words between them are not a period", () => {
    assert.deepEqual(found(doc("2026年4月1日、2026年3月1日の二回"), ja), []);
    assert.deepEqual(found(doc("Signed March 5, 2026 and March 3, 2026.")), []);
  });
});
