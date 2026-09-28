import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { weekdayOf } from "../packages/chaff/src/structure/weekday.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 日付と、その横に書いた曜日の食い違い（date-weekday-mismatch）。曜日の読み方は言語パッケージ、暦との比較は core。

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "date-weekday-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "date-weekday-mismatch")
    .map((finding) => `${String(finding.values["date"])}:${String(finding.values["written"])}:${String(finding.values["actual"])}`);

const weekdays = (adapter: LanguageAdapter, text: string): (number | string | undefined)[] =>
  (adapter.structure?.dates?.(text) ?? []).map((mention) => mention.attrs["weekday"]);

describe("weekdayOf", () => {
  const cases: readonly (readonly [string, number | undefined])[] = [
    ["2026-10-01", 4],
    ["2024-02-29", 4],
    ["2000-01-01", 6],
    ["2026-02-30", undefined],
    ["2025-02-29", undefined],
    ["2026-13-01", undefined],
    ["2026-10", undefined],
    ["10-01", undefined],
    ["", undefined],
  ];
  cases.forEach(([value, expected]) => {
    it(`${value || "(empty)"} → ${String(expected)}`, () => assert.equal(weekdayOf(value), expected));
  });
});

describe("日本語: 日付のすぐ後ろの曜日", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("（木）（木曜）（木曜日）と、括弧の無い木曜日を読む", () => {
    assert.deepEqual(weekdays(ja, "2026年10月1日（木）"), [4]);
    assert.deepEqual(weekdays(ja, "2026年10月1日(木曜)"), [4]);
    assert.deepEqual(weekdays(ja, "2026年10月1日（木曜日）"), [4]);
    assert.deepEqual(weekdays(ja, "2026年10月1日 木曜日"), [4]);
  });

  it("元号で書いた日付も西暦にして比べる。年だけの元号は数量のまま", () => {
    assert.deepEqual(
      (ja.structure?.dates?.("令和8年10月1日（木）") ?? []).map((mention) => [mention.attrs["value"], mention.attrs["weekday"]]),
      [["2026-10-01", 4]],
    );
    assert.deepEqual(found("# 旅程\n\n令和8年10月1日（金）に出発する。", ja, "ja"), ["2026-10-01:金曜日:木曜日"]);
    assert.deepEqual(ja.structure?.dates?.("昭和二十二年法律第四十九号") ?? [], []);
  });

  it("曜日でないもの（木村さん、木の机）は読まない", () => {
    assert.deepEqual(weekdays(ja, "2026年10月1日、木村さんが来る"), [undefined]);
    assert.deepEqual(weekdays(ja, "2026年10月1日（木の机を運ぶ）"), [undefined]);
  });

  it("食い違いを言う。年の無い日付と曜日の無い日付は見ない", () => {
    assert.deepEqual(found("# 旅程\n\n2026年10月1日（金）に出発する。", ja, "ja"), ["2026-10-01:金曜日:木曜日"]);
    assert.deepEqual(found("# 旅程\n\n10月1日（金）に出発する。2026年10月1日に着く。", ja, "ja"), []);
  });

  it("旅程の見本: 2 日目の曜日だけが違う", () => {
    const source = readFileSync(new URL("fixtures/dates/itinerary-ja.md", import.meta.url), "utf8");
    assert.deepEqual(found(source, ja, "ja"), ["2026-10-02:土曜日:金曜日"]);
  });
});

describe("English: the weekday beside a date", () => {
  it("before the date, or after it in parentheses; full names and short forms", () => {
    assert.deepEqual(weekdays(en, "Thursday, 1 October 2026"), [4]);
    assert.deepEqual(weekdays(en, "Thu 1 October 2026"), [4]);
    assert.deepEqual(weekdays(en, "1 October 2026 (Thursday)"), [4]);
    assert.deepEqual(weekdays(en, "Thursday, October 1, 2026"), [4]);
  });

  it("not a weekday: a verb, a day word far away, a possessive, the next sentence, a range", () => {
    assert.deepEqual(weekdays(en, "We met on Monday. On 1 October 2026 we left."), [undefined]);
    assert.deepEqual(weekdays(en, "On 2 October 2026, Sat down with the team."), [undefined]);
    assert.deepEqual(weekdays(en, "The fair runs 1-3 October 2026 (Thursday)."), [undefined]);
    assert.deepEqual(weekdays(en, "Held 2 October 2026, Tuesday's notes attached."), [undefined]);
    assert.deepEqual(weekdays(en, "May 2026 was busy."), [undefined]);
  });

  it("says which day it really is; a date without its year is not checked", () => {
    assert.deepEqual(found("# Trip\n\nWe leave on Friday, 1 October 2026.", en, "en"), ["2026-10-01:Friday:Thursday"]);
    assert.deepEqual(found("# Trip\n\nWe leave on Friday, 1 October.", en, "en"), []);
  });

  it("the sample itinerary: only the second day is wrong", () => {
    const source = readFileSync(new URL("fixtures/dates/itinerary-en.md", import.meta.url), "utf8");
    assert.deepEqual(found(source, en, "en"), ["2026-10-02:Saturday:Friday"]);
  });
});
