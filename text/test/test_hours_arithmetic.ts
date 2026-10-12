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

describe("duration-mismatch: timesheet rows", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  const sheet = (adapter: LanguageAdapter, language: string, lines: readonly string[], intro: readonly string[] = []): string[] =>
    runRules(buildDocument("t.md", ["# Sheet", "", ...intro, "", ...lines, ""].join("\n"), adapter), loadRules(language), RULES, false, "business/report")
      .findings.filter((finding) => finding.rule === "duration-mismatch")
      .map((finding) => `${finding.variant ?? ""} ${String(finding.values["total"] ?? finding.values["break"])}→${String(finding.values["expected"] ?? "")}`);
  const ja4 = ["| 日付 | 始業 | 終業 | 休憩 | 実働 |", "| --- | --- | --- | --- | --- |"];
  const en4 = ["| Date | Start | End | Break | Hours |", "| --- | --- | --- | --- | --- |"];
  const jaRange = ["| 日付 | 作業時間 | 休憩 | 稼働 |", "| --- | --- | --- | --- |"];
  const enRange = ["| Date | Time | Break | Hours |", "| --- | --- | --- | --- |"];
  const sheetJa = (lines: readonly string[], intro?: readonly string[]): string[] => sheet(ja, "ja", lines, intro);
  const sheetEn = (lines: readonly string[], intro?: readonly string[]): string[] => sheet(en, "en", lines, intro);

  it("a row whose hours are not the end less the start and the break", () => {
    assert.deepEqual(sheetJa([...ja4, "| 4月1日 | 9:00 | 18:00 | 1:00 | 8.0時間 |", "| 4月2日 | 9:00 | 18:00 | 1:00 | 7.5時間 |"]), [
      "working-hours-hours 7.5時間→8",
    ]);
    assert.deepEqual(sheetJa([...ja4, "| 4月2日 | 9:00 | 18:00 | 45分 | 8時間 |"]), ["working-hours 8時間→8.25"]);
    assert.deepEqual(sheetJa([...jaRange, "| 4月3日 | 9:30〜18:30 | 1時間 | 7時間30分 |"]), ["working-hours-hours 7時間30分→8"]);
    assert.deepEqual(sheetEn([...en4, "| Apr 1 | 8:00 AM | 5:00 PM | 1 hr | 9.00 |"]), ["working-hours-hours 9.00→8"]);
    assert.deepEqual(sheetEn([...enRange, "| Apr 2 | 9:00 AM – 5:30 PM | 30 min | 7.5 |"]), ["working-hours-hours 7.5→8"]);
  });

  it("a break longer than the shift has its own message", () => {
    assert.deepEqual(sheetJa([...ja4, "| 4月4日 | 13:00 | 17:00 | 5:00 | 4.0時間 |"]), ["working-hours-break-longer 5:00→"]);
    assert.deepEqual(sheetJa([...jaRange, "| 4月5日 | 9:30〜18:00 | 9時間 | 7時間30分 |"]), ["working-hours-break-longer 9時間→"]);
    assert.deepEqual(sheetEn([...en4, "| Apr 3 | 1:00 PM | 4:00 PM | 4:30 | 3.00 |"]), ["working-hours-break-longer 4:30→"]);
    assert.deepEqual(sheetJa([...ja4, "| 4月4日 | 13:00 | 17:00 | 4:02 | 0.0時間 |"]), ["working-hours-break-longer 4:02→"]);
    assert.deepEqual(sheetJa([...ja4, "| 4月4日 | 13:00 | 17:00 | 5:00 | なし |"]), ["working-hours-break-longer 5:00→"]);
  });

  it("rows that add up, including rounded decimals, stay silent", () => {
    assert.deepEqual(sheetJa([...ja4, "| 4月1日 | 9:00 | 17:50 | 0:30 | 8.33時間 |", "| 4月2日 | 9:00 | 18:00 | 1:00 | 8時間 |"]), []);
    assert.deepEqual(sheetJa([...ja4, "| 4月1日 | 9:00 | 17:50 | 0:30 | 8.3時間 |"]), []);
    assert.deepEqual(sheetJa([...jaRange, "| 4月3日 | 9:30〜19:00 | 1時間 | 8時間30分 |", "| 合計 | | | 8時間30分 |"]), []);
    assert.deepEqual(sheetEn([...en4, "| Apr 1 | 8:00 AM | 4:30 PM | 0:30 | 8.00 |", "| Total | | | | 8.00 |"]), []);
    assert.deepEqual(sheetEn([...enRange, "| Apr 2 | 9:00 AM – 5:30 PM | 0:30 | 8 |"]), []);
  });

  it("a cell that cannot be read exactly stays silent", () => {
    assert.deepEqual(sheetJa([...ja4, "| 4月1日 | 9:00 | 18:00 | なし | 7.0時間 |"]), []);
    assert.deepEqual(sheetJa([...ja4, "| 4月1日 | 9:00 | 18:00 | 約1時間 | 7.0時間 |"]), []);
    assert.deepEqual(sheetJa([...ja4, "| 4月1日 | 9:00 | 18:00頃 | 1:00 | 7.0時間 |"]), []);
    assert.deepEqual(sheetEn(["| Date | Start | End | Break | Hours |", "| --- | --- | --- | --- | --- |", "| Apr 1 | 8:00 | 17:00 | 30 | 8.00 |"]), []);
    assert.deepEqual(sheetEn(["| Date | Start | End | Break | Hours (min) |", "| --- | --- | --- | --- | --- |", "| Apr 1 | 8:00 | 9:00 | 0:00 | 45 |"]), []);
    assert.deepEqual(sheetEn([...en4, "| Apr 1 | 1:00 | 5:00 PM | 0:00 | 16.00 |"]), []);
  });

  it("a table without a break or an hours column is not read", () => {
    assert.deepEqual(sheetJa(["| 日付 | 始業 | 終業 | 実働 |", "| --- | --- | --- | --- |", "| 4月1日 | 9:00 | 18:00 | 7.0時間 |"]), []);
    assert.deepEqual(sheetEn(["| Date | Start | End | Break |", "| --- | --- | --- | --- |", "| Apr 1 | 13:00 | 17:00 | 5:00 |"]), []);
    assert.deepEqual(sheetJa(["| 日付 | 勤務時間 | 休憩 |", "| --- | --- | --- |", "| 4月1日 | 9:00〜10:00 | 2:00 |"]), []);
  });

  it("a row across midnight is read only where the document marks night work", () => {
    const night = [...ja4, "| 4月1日 | 22:00 | 7:00 | 1:00 | 9.0時間 |", "| 4月2日 | 22:00 | 7:00 | 1:00 | 8.0時間 |"];
    assert.deepEqual(sheetJa(night, ["夜勤の勤務表です。"]), ["working-hours-hours 9.0時間→8"]);
    assert.deepEqual(sheetJa(night), []);
    const shifts = [...en4, "| Apr 1 | 10:00 PM | 6:30 AM | 0:30 | 8.50 |", "| Apr 2 | 10:00 PM | 6:30 AM | 0:30 | 8.00 |"];
    assert.deepEqual(sheetEn(shifts, ["Night shift timesheet."]), ["working-hours-hours 8.50→8"]);
    assert.deepEqual(sheetEn(shifts), []);
  });

  it("a row the sentence reading already reports is reported once", () => {
    const table = ["| シフト | 時間 | 休憩 | 実働 |", "| --- | --- | --- | --- |"];
    assert.deepEqual(sheetJa([...table, "| 遅番 | 13:00〜22:00 | 休憩1時間 | 実働9時間 |"]), ["working-hours-hours 9時間→8"]);
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
