import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { annualCountsIn, annualHolidaysMismatches, isPlainGap, weeklyIn, type AnnualHolidaysWords } from "../packages/chaff/src/structure/annual-holidays.ts";

// 毎週の休みから決まる日数より少ない年間休日（annual-holidays-mismatch）。

const RULE = "annual-holidays-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["written"])} < ${String(finding.values["minimum"])} (${String(finding.values["weekly"])})`);

const table = (...rows: string[]): string => ["| 項目 | 内容 |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(" ", " | ")} |`)].join("\n");
const enTable = (...rows: string[]): string => ["| Item | Details |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(": ", " | ")} |`)].join("\n");

const jaDoc = (...blocks: string[]): string[] => found(["# 求人票", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), ja);
const enDoc = (...blocks: string[]): string[] => found(["# Job Posting", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), en);

const words: AnnualHolidaysWords = {
  labels: [
    { word: "年間休日", position: "before" },
    { word: "days off a year", position: "after" },
  ],
  days: ["日", "days"],
  links: ["は"],
  weekly: [
    { word: "完全週休2日制", minimum: 104 },
    { word: "4週6休", minimum: 78 },
    { word: "週休2日制", minimum: undefined },
  ],
  negations: [
    { word: "ではない", position: "after" },
    { word: "not", position: "before" },
  ],
  exceptions: ["除く"],
  markers: [
    { word: "約", position: "before" },
    { word: "以上", position: "after" },
  ],
  connectors: ["〜", "to"],
};

describe("annual-holidays pieces", () => {
  it("annualCountsIn reads a count after a label and one before an after-label, and marks an approximate or ranged count", () => {
    assert.deepEqual(
      annualCountsIn("年間休日：125日", words).map((count) => [count.days, count.clear]),
      [[125, true]],
    );
    assert.deepEqual(
      annualCountsIn("We give 90 days off a year.", words).map((count) => [count.days, count.clear]),
      [[90, true]],
    );
    assert.deepEqual(
      annualCountsIn("年間休日は約120日", words).map((count) => count.clear),
      [false],
    );
    assert.deepEqual(
      annualCountsIn("年間休日 120日以上", words).map((count) => count.clear),
      [false],
    );
    assert.deepEqual(
      annualCountsIn("年間休日 100〜120日", words).map((count) => count.clear),
      [false],
    );
    assert.deepEqual(
      annualCountsIn("年間休日 １２５日", words).map((count) => count.days),
      [125],
    );
    assert.deepEqual(annualCountsIn("年間休日の考え方は2025年に変わり、10日", words), []);
    assert.deepEqual(annualCountsIn("勤務地 横浜、25日締め", words), []);
  });

  it("weeklyIn gives every-week phrases their minimum, and a not-every-week, negated or excepted phrase is not clear", () => {
    assert.deepEqual(
      weeklyIn("完全週休2日制（土日）", words).map((weekly) => [weekly.minimum, weekly.clear]),
      [[104, true]],
    );
    assert.deepEqual(
      weeklyIn("週休2日制（土日）", words).map((weekly) => [weekly.minimum, weekly.clear]),
      [[undefined, false]],
    );
    assert.deepEqual(
      weeklyIn("完全週休2日制ではない", words).map((weekly) => weekly.clear),
      [false],
    );
    assert.deepEqual(
      weeklyIn("完全週休2日制（繁忙期を除く）", words).map((weekly) => weekly.clear),
      [false],
    );
    assert.deepEqual(weeklyIn("土日祝休み", words), []);
  });

  it("isPlainGap allows separators, bracketed words and the link words only", () => {
    assert.equal(isPlainGap(" | ", []), true);
    assert.equal(isPlainGap("（2025年度）", []), false);
    assert.equal(isPlainGap("（実績） | ", []), true);
    assert.equal(isPlainGap("は", ["は"]), true);
    assert.equal(isPlainGap("の目安 ", []), false);
  });

  it("annualHolidaysMismatches reports a count below the minimum, and nothing at or above it", () => {
    assert.deepEqual(
      annualHolidaysMismatches("完全週休2日制\n年間休日 103日", words).map((issue) => issue.values["minimum"]),
      [104],
    );
    assert.deepEqual(annualHolidaysMismatches("完全週休2日制\n年間休日 104日", words), []);
    assert.deepEqual(annualHolidaysMismatches("完全週休2日制\n年間休日 125日", words), []);
    assert.deepEqual(annualHolidaysMismatches("", words), []);
  });

  it("the smallest minimum of the posting's weekly phrases is the bound", () => {
    assert.deepEqual(annualHolidaysMismatches("完全週休2日制、4週6休\n年間休日 90日", words), []);
    assert.deepEqual(
      annualHolidaysMismatches("完全週休2日制、4週6休\n年間休日 70日", words).map((issue) => issue.values["minimum"]),
      [78],
    );
  });
});

describe("annual-holidays-mismatch, Japanese", () => {
  it("annual days off below what 完全週休2日制 gives", () => {
    const holidays = "休日 完全週休2日制（土曜日・日曜日）、祝日";
    assert.deepEqual(jaDoc(table(holidays, "年間休日 90日")), ["90日 < 104 (完全週休2日制)"]);
    assert.deepEqual(jaDoc(table(holidays, "年間休日 125日")), []);
    assert.deepEqual(jaDoc(table(holidays, "年間休日 104日")), []);
  });

  it("reads the full-width and kanji spellings, 4週8休 and 完全週休3日制", () => {
    assert.deepEqual(jaDoc("休日：完全週休二日制", "年間休日：100日"), ["100日 < 104 (完全週休二日制)"]);
    assert.deepEqual(jaDoc("休日：完全週休２日（土日）", "年間休日：100日"), ["100日 < 104 (完全週休２日)"]);
    assert.deepEqual(jaDoc("休日：4週8休（シフト制）", "年間休日：96日"), ["96日 < 104 (4週8休)"]);
    assert.deepEqual(jaDoc("休日：完全週休3日制", "年間休日数：125日"), ["125日 < 156 (完全週休3日制)"]);
    assert.deepEqual(jaDoc("休日：完全週休3日制", "年間休日数：160日"), []);
  });

  it("reads a count in a sentence", () => {
    assert.deepEqual(jaDoc("完全週休2日制です。年間休日は96日です。"), ["96日 < 104 (完全週休2日制)"]);
  });

  it("says nothing for 週休2日制 without 完全, which is not every week", () => {
    assert.deepEqual(jaDoc(table("休日 週休2日制（土日）", "年間休日 90日")), []);
    assert.deepEqual(jaDoc(table("休日 週休二日制", "年間休日 96日")), []);
    assert.deepEqual(jaDoc("A職：完全週休2日制", "B職：週休2日制", "年間休日：96日"), []);
  });

  it("says nothing for a negated phrase or one with an exception on its line", () => {
    assert.deepEqual(jaDoc("休日：完全週休2日制ではありません（シフト制）", "年間休日：96日"), []);
    assert.deepEqual(jaDoc("休日：完全週休2日制（ただし月1回土曜出勤あり）", "年間休日：96日"), []);
    assert.deepEqual(jaDoc("休日：完全週休2日制（繁忙期を除く）", "年間休日：96日"), []);
  });

  it("says nothing for an approximate, open or ranged count, or two different counts", () => {
    for (const count of ["約90日", "90日以上", "90日から", "90〜100日", "90日〜100日"]) {
      assert.deepEqual(jaDoc("休日：完全週休2日制", `年間休日：${count}`), [], count);
    }
    assert.deepEqual(jaDoc("休日：完全週休2日制", "年間休日：96日（営業職）", "年間休日：125日（事務職）"), []);
  });

  it("says nothing without a weekly phrase or without an annual count, and does not read paid leave", () => {
    assert.deepEqual(jaDoc("休日：土日祝", "年間休日：90日"), []);
    assert.deepEqual(jaDoc("休日：完全週休2日制"), []);
    assert.deepEqual(jaDoc("休日：完全週休2日制", "年次有給休暇：10日"), []);
  });
});

describe("annual-holidays-mismatch, English", () => {
  it("annual days off below what two days off every week give", () => {
    const daysOff = "Days off: Two days off every week (Saturday and Sunday) and public holidays";
    assert.deepEqual(enDoc(enTable(daysOff, "Annual days off: 90 days")), ["90 days < 104 (Two days off every week)"]);
    assert.deepEqual(enDoc(enTable(daysOff, "Annual days off: 125 days")), []);
  });

  it("reads a five-day work week, a four-day work week, and a count before its label", () => {
    assert.deepEqual(enDoc("We offer a five-day work week and 100 days off a year."), ["100 days off a year < 104 (five-day work week)"]);
    assert.deepEqual(enDoc("A 4-day work week. Total days off per year: 120 days."), ["120 days < 156 (4-day work week)"]);
    assert.deepEqual(enDoc("We offer a five-day work week and 120 days off a year."), []);
  });

  it("says nothing for vague weekly phrases", () => {
    assert.deepEqual(enDoc("Weekends off.", "Annual days off: 90 days"), []);
    assert.deepEqual(enDoc("Two days off a week.", "Annual days off: 90 days"), []);
  });

  it("says nothing for a negated phrase or one with an exception", () => {
    assert.deepEqual(enDoc("This role does not have two days off every week.", "Annual days off: 90 days"), []);
    assert.deepEqual(enDoc("Two days off every week, except in the peak season.", "Annual days off: 90 days"), []);
    assert.deepEqual(enDoc("Two days off every week; some Saturdays worked.", "Annual days off: 90 days"), []);
  });

  it("says nothing for paid leave, an approximate or open count, or a range", () => {
    assert.deepEqual(enDoc("Two days off every week.", "Annual holidays: 25 days"), []);
    assert.deepEqual(enDoc("Two days off every week.", "Annual leave: 25 days"), []);
    for (const count of ["about 90 days", "90 days or more", "from 90 days", "90 to 100 days", "90-100 days"]) {
      assert.deepEqual(enDoc("Two days off every week.", `Annual days off: ${count}`), [], count);
    }
  });
});
