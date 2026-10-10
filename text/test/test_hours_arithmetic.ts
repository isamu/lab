import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { timeLengths } from "../packages/chaff/src/derived/time-lengths.ts";

// 勤務時間の実働（duration-mismatch の working-hours）と、回数 × 1回の長さの合計（duration-product-mismatch）。

const RULES = { "duration-mismatch": "normal", "duration-product-mismatch": "normal" } as const;

const run = (rule: string, source: string, adapter: LanguageAdapter, language: string): Record<string, unknown>[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => finding.values);

const workJa = (...lines: string[]): string[] =>
  run("duration-mismatch", ["# 募集要項", "", ...lines, ""].join("\n"), ja, "ja").map((values) => `${String(values["total"])}→${String(values["expected"])}`);
const workEn = (...lines: string[]): string[] =>
  run("duration-mismatch", ["# Job posting", "", ...lines, ""].join("\n"), en, "en").map(
    (values) => `${String(values["total"])}→${String(values["expected"])}`,
  );

const sessionsJa = (...lines: string[]): string[] =>
  run("duration-product-mismatch", ["# シラバス", "", ...lines, ""].join("\n"), ja, "ja").map(
    (values) => `${String(values["total"])}→${String(values["expected"])}`,
  );
const sessionsEn = (...lines: string[]): string[] =>
  run("duration-product-mismatch", ["# Syllabus", "", ...lines, ""].join("\n"), en, "en").map(
    (values) => `${String(values["total"])}→${String(values["expected"])}`,
  );

describe("duration-mismatch: working hours", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a stated total that is not the end minus the start minus the break (ja)", () => {
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（休憩1時間、実働8時間）"), ["8時間→7.5"]);
    assert.deepEqual(workJa("勤務時間：9時から18時（休憩45分）実働8時間"), ["8時間→8.25"]);
    assert.deepEqual(workJa("勤務時間：午前9時〜午後6時、休憩60分、実働7時間半"), ["7時間半→8"]);
  });

  it("a stated total that is not the end minus the start minus the break (en)", () => {
    assert.deepEqual(workEn("Hours: 9:00–17:30 with a 1-hour break, 8 hours a day"), ["8 hours→7.5"]);
    assert.deepEqual(workEn("9:00 a.m. to 5:30 p.m. (a one-hour break, 8 hours of work)"), ["8 hours→7.5"]);
    assert.deepEqual(workEn("Hours: 8:30 to 17:00, break of 45 minutes, 8 hours a day"), ["8 hours→7.75"]);
  });

  it("hours that add up stay silent", () => {
    assert.deepEqual(workJa("勤務時間：9:00〜18:00（休憩1時間、実働8時間）"), []);
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（休憩60分、実働7時間30分）"), []);
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（休憩1時間、実働7時間半）"), []);
    assert.deepEqual(workEn("Hours: 9:00–18:00 with a 1-hour break, 8 hours a day"), []);
    assert.deepEqual(workEn("9:00 a.m. to 6:00 p.m. (a one-hour break, 8 hours of work)"), []);
  });

  it("a list whose items state the hours together", () => {
    assert.deepEqual(workJa("- 勤務時間：9:00〜18:00", "- 休憩：1時間", "- 実働：7時間"), ["7時間→8"]);
    assert.deepEqual(workEn("- Hours: 9:00–18:00", "- Break: 1 hour", "- 7 hours of work"), ["7 hours→8"]);
    assert.deepEqual(workJa("- 勤務時間：9:00〜18:00", "- 休憩：1時間", "- 実働：8時間"), []);
  });

  it("no stated total, or a break without a length, stays silent", () => {
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（休憩1時間）"), []);
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（休憩あり、実働8時間）"), []);
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（実働8時間）"), []);
    assert.deepEqual(workEn("Hours: 9:00–17:30 with a 1-hour break"), []);
    assert.deepEqual(workEn("Hours: 9:00–17:30 with breaks, 8 hours a day"), []);
    assert.deepEqual(workEn("Hours: 9:00–17:30, a lunch break and a 15-minute break, 8 hours a day"), []);
  });

  it("a fraction is not a length, and a total in another sentence is not this range's", () => {
    assert.deepEqual(workEn("Hours: 9:00-17:00 with a 1/2-hour break, 7.5 hours a day."), []);
    assert.deepEqual(workEn("The office is open 9:00-17:00 with a 1-hour lunch break. Employees may work 8 hours a day."), []);
  });

  it("a rough break or total stays silent", () => {
    assert.deepEqual(workJa("勤務時間：9:00〜17:30（休憩約1時間、実働8時間）"), []);
    assert.deepEqual(workEn("Hours: 9:00–17:30 with a 1-hour break, about 8 hours a day"), []);
  });

  it("a shift table is read row by row, only where a row states its own total", () => {
    const table = ["| シフト | 時間 | 休憩 | 実働 |", "| --- | --- | --- | --- |"];
    assert.deepEqual(workJa(...table, "| 早番 | 7:00〜16:00 | 休憩1時間 | 実働8時間 |", "| 遅番 | 13:00〜22:00 | 休憩1時間 | 実働9時間 |"), ["9時間→8"]);
    assert.deepEqual(workJa("早番 7:00〜16:00、遅番 13:00〜22:00（休憩1時間、実働9時間）"), []);
    assert.deepEqual(workEn("Shifts: 7:00–16:00 or 13:00–22:00, with a 1-hour break, 9 hours of work"), []);
  });

  it("a range across midnight is read only with a next-day mark", () => {
    assert.deepEqual(workJa("勤務時間：22:00〜翌7:00（休憩1時間、実働9時間）"), ["9時間→8"]);
    assert.deepEqual(workJa("勤務時間：22:00〜翌7:00（休憩1時間、実働8時間）"), []);
    assert.deepEqual(workJa("勤務時間：22:00〜7:00（休憩1時間、実働9時間）"), []);
    assert.deepEqual(workEn("Hours: 22:00–7:00 (next day) with a 1-hour break, 9 hours of work"), ["9 hours→8"]);
    assert.deepEqual(workEn("Hours: 22:00–7:00 with a 1-hour break, 9 hours of work"), []);
  });

  it("the start-plus-length and nights checks are not changed", () => {
    assert.deepEqual(
      run("duration-mismatch", "# 案内\n\n契約期間は2026年4月1日から3か月間（2026年7月31日まで）です。\n", ja, "ja").map((values) => values["expected"]),
      ["2026年6月30日"],
    );
  });
});

describe("duration-product-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a count times a length that is not the stated total (ja)", () => {
    assert.deepEqual(sessionsJa("授業時間：1回90分、全15回、合計24時間"), ["24時間→22.5"]);
    assert.deepEqual(sessionsJa("講座は90分×15回（計24時間）です。"), ["24時間→22.5"]);
    assert.deepEqual(sessionsJa("授業時間数：30時間（毎週2時間×14週）"), ["30時間→28"]);
  });

  it("a count times a length that is not the stated total (en)", () => {
    assert.deepEqual(sessionsEn("Class hours: 90 minutes per session, 15 sessions, 24 hours in total"), ["24 hours→22.5"]);
    assert.deepEqual(sessionsEn("The course runs 15 sessions of 90 minutes (24 hours in total)."), ["24 hours→22.5"]);
    assert.deepEqual(sessionsEn("Twelve sessions of 2 hours, a total of 20 hours."), ["20 hours→24"]);
  });

  it("a product that matches stays silent", () => {
    assert.deepEqual(sessionsJa("授業時間：1回90分、全15回、合計22.5時間"), []);
    assert.deepEqual(sessionsJa("講座は90分×16回（計24時間）です。"), []);
    assert.deepEqual(sessionsEn("Class hours: 90 minutes per session, 15 sessions, 22.5 hours in total"), []);
    assert.deepEqual(sessionsEn("15 sessions of 90 minutes (1350 minutes in total)"), []);
  });

  it("an approximate total is allowed less than its unit", () => {
    assert.deepEqual(sessionsJa("講座は90分×15回（計約23時間）です。"), []);
    assert.deepEqual(sessionsJa("講座は90分×15回（計約25時間）です。"), ["25時間→22.5"]);
    assert.deepEqual(sessionsEn("15 sessions of 90 minutes, about 23 hours in total"), []);
    assert.deepEqual(sessionsEn("15 sessions of 90 minutes, about 21 hours in total"), ["21 hours→22.5"]);
  });

  it("an ordinal is not a count, and a decimal total is allowed less than its last digit", () => {
    assert.deepEqual(sessionsJa("第15回は90分、合計24時間です。"), []);
    assert.deepEqual(sessionsEn("15 sessions of 90 minutes, about 21.6 hours in total."), ["21.6 hours→22.5"]);
    assert.deepEqual(sessionsEn("15 sessions of 90 minutes, about 22 hours in total."), []);
  });

  it("a missing count, length or total stays silent", () => {
    assert.deepEqual(sessionsJa("授業時間：1回90分、合計24時間"), []);
    assert.deepEqual(sessionsJa("授業時間：全15回、合計24時間"), []);
    assert.deepEqual(sessionsJa("授業時間：1回90分、全15回"), []);
    assert.deepEqual(sessionsEn("90 minutes per session, 24 hours in total"), []);
    assert.deepEqual(sessionsEn("15 sessions, 24 hours in total"), []);
    assert.deepEqual(sessionsEn("15 sessions of 90 minutes"), []);
  });

  it("two counts or two lengths on one line stay silent", () => {
    assert.deepEqual(sessionsJa("講義90分×10回、演習60分×5回（計20時間）"), []);
    assert.deepEqual(sessionsEn("10 lectures and 5 sessions of 90 minutes, 20 hours in total"), []);
  });
});

describe("timeLengths", () => {
  const words = { hourUnits: ["時間", "hours", "hour", "h"], minuteUnits: ["分間", "分", "minutes", "minute"], halves: ["半"], numberWords: ["one", "two"] };
  const read = (text: string): string[] =>
    timeLengths(text, words).map((length) => `${text.slice(length.start, length.end)}=${String(length.minutes)}/${String(length.unit)}`);

  it("hours, minutes, both, a half, words and hyphens", () => {
    assert.deepEqual(read("実働8時間"), ["8時間=480/60"]);
    assert.deepEqual(read("7時間30分"), ["7時間30分=450/1"]);
    assert.deepEqual(read("7時間半"), ["7時間半=450/30"]);
    assert.deepEqual(read("90分間"), ["90分間=90/1"]);
    assert.deepEqual(read("7.5 hours"), ["7.5 hours=450/6"]);
    assert.deepEqual(read("a one-hour break"), ["one-hour=60/60"]);
    assert.deepEqual(read("a 45-minute break"), ["45-minute=45/1"]);
  });

  it("not a length", () => {
    assert.deepEqual(read("9時"), []);
    assert.deepEqual(read("8 hoursx"), []);
    assert.deepEqual(read("someone hour"), []);
    assert.deepEqual(read(""), []);
  });
});
