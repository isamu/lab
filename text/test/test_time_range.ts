import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { isReversed, rangeReading } from "../packages/chaff/src/structure/time-range.ts";
import { showsOvernightWork } from "../packages/chaff/src/structure/shift-times.ts";
import type { TimeSpan } from "../packages/chaff/src/structure/time-marks.ts";

// 時刻の範囲の終わりが始まりより前（time-range-reversed）。

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "time-range-reversed": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "time-range-reversed")
    .map((finding) => String(finding.values["range"]));

const table = (rows: readonly string[]): string => rows.join("\n");

const reversedJa = (source: string): string[] => findings(source, ja, "ja");
const reversedEn = (source: string): string[] => findings(source, en, "en");

const HOUR = 3600;
const MINUTE = 60;

/** A time span over the whole of text at the given offset, for the pure readers. */
const spanAt = (text: string, written: string, seconds: number): TimeSpan => {
  const start = text.indexOf(written);
  return { start, end: start + written.length, seconds };
};

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("rangeReading and isReversed", () => {
  it("reads both times as written when each carries its own clock", () => {
    const text = "15:15〜14:15";
    const reading = rangeReading(text, spanAt(text, "15:15", 15 * HOUR + 15 * MINUTE), spanAt(text, "14:15", 14 * HOUR + 15 * MINUTE));
    assert.deepEqual(reading, { from: 15 * HOUR + 15 * MINUTE, to: 14 * HOUR + 15 * MINUTE, borrowed: false });
    assert.equal(isReversed(reading), true);
  });

  it("lends the p.m. of the end to a start written without one", () => {
    const text = "2:00–1:30 pm";
    const reading = rangeReading(text, spanAt(text, "2:00", 2 * HOUR), spanAt(text, "1:30 pm", 13 * HOUR + 30 * MINUTE));
    assert.deepEqual(reading, { from: 14 * HOUR, to: 13 * HOUR + 30 * MINUTE, borrowed: true });
    assert.equal(isReversed(reading), true);
  });

  it("lends the 午後 of the start to an end written without one", () => {
    const text = "午後2時から1時半まで";
    const reading = rangeReading(text, spanAt(text, "午後2時", 14 * HOUR), spanAt(text, "1時半", HOUR + 30 * MINUTE));
    assert.deepEqual(reading, { from: 14 * HOUR, to: 13 * HOUR + 30 * MINUTE, borrowed: true });
  });

  it("does not lend a meridiem to a time on the 24-hour clock", () => {
    const text = "13:00–2:00 pm";
    assert.equal(rangeReading(text, spanAt(text, "13:00", 13 * HOUR), spanAt(text, "2:00 pm", 14 * HOUR)).borrowed, false);
  });

  it("a range that goes forward, stays put, or goes back three hours or more is not reversed", () => {
    assert.equal(isReversed({ from: 9 * HOUR, to: 10 * HOUR, borrowed: false }), false);
    assert.equal(isReversed({ from: 9 * HOUR, to: 9 * HOUR, borrowed: false }), false);
    assert.equal(isReversed({ from: 22 * HOUR, to: 6 * HOUR, borrowed: false }), false);
    assert.equal(isReversed({ from: 12 * HOUR, to: 9 * HOUR, borrowed: false }), false);
    assert.equal(isReversed({ from: 12 * HOUR, to: 9 * HOUR + MINUTE, borrowed: false }), true);
  });

  it("a range with the same a.m. or p.m. on both sides is reversed however far it goes back", () => {
    const text = "9:00 AM – 5:30 AM";
    const reading = rangeReading(text, spanAt(text, "9:00 AM", 9 * HOUR), spanAt(text, "5:30 AM", 5 * HOUR + 30 * MINUTE));
    assert.equal(reading.sameHalf, true);
    assert.equal(isReversed(reading), true);
  });

  it("a range from p.m. to a.m. is not the same half and may run past midnight", () => {
    const text = "10:00 PM – 6:00 AM";
    const reading = rangeReading(text, spanAt(text, "10:00 PM", 22 * HOUR), spanAt(text, "6:00 AM", 6 * HOUR));
    assert.equal(reading.sameHalf, undefined);
    assert.equal(isReversed(reading), false);
  });

  it("with a borrowed meridiem only a step back of less than an hour is reversed (8:00–6:00 pm crosses noon)", () => {
    assert.equal(isReversed({ from: 20 * HOUR, to: 18 * HOUR, borrowed: true }), false);
    assert.equal(isReversed({ from: 14 * HOUR, to: 13 * HOUR, borrowed: true }), false);
    assert.equal(isReversed({ from: 14 * HOUR, to: 13 * HOUR + 30 * MINUTE, borrowed: true }), true);
  });
});

describe("time-range-reversed: Japanese", () => {
  it("reports a range in a table row, a line and a sentence whose end is before its start", () => {
    assert.deepEqual(reversedJa(["| 時刻 | 内容 |", "| --- | --- |", "| 15:15〜14:15 | 事例紹介 |"].join("\n")), ["15:15〜14:15"]);
    assert.deepEqual(reversedJa("- 14:00〜13:30 説明会"), ["14:00〜13:30"]);
    assert.deepEqual(reversedJa("説明会は午後2時から午後1時半までです。"), ["午後2時から午後1時半"]);
    assert.deepEqual(reversedJa("説明会は午後2時から1時半までです。"), ["午後2時から1時半"]);
  });

  it("does not report a range that goes forward", () => {
    assert.deepEqual(reversedJa("- 14:00〜15:30 説明会\n- 午前10時から午後1時まで 見学"), []);
  });

  it("does not report a range whose end is marked as the next day", () => {
    assert.deepEqual(reversedJa("勤務時間：23:00〜翌0:30"), []);
    assert.deepEqual(reversedJa("勤務時間：23:00〜0:30（翌日）"), []);
  });

  it("does not report a range across midnight (a step back of three hours or more)", () => {
    assert.deepEqual(reversedJa("夜勤：22:00〜6:00"), []);
    assert.deepEqual(reversedJa("夜勤：17:00〜9:00"), []);
  });

  it("does not report a change of time, nor から without まで", () => {
    assert.deepEqual(reversedJa("開始を14:00から13:30に変更しました。"), []);
  });

  it("does not read numbers and lengths without a time mark as times", () => {
    assert.deepEqual(reversedJa("所要時間は2〜1時間です。"), []);
    assert.deepEqual(reversedJa("参加者は5〜3名の班に分かれます。"), []);
  });

  it("does not join a time at the end of one item to the time at the start of the next", () => {
    assert.deepEqual(reversedJa("- 集合 14:00\n- 13:00 解散"), []);
  });
});

describe("time-range-reversed: English", () => {
  it("reports a range whose end is before its start", () => {
    assert.deepEqual(reversedEn(["| Time | Session |", "| --- | --- |", "| 15:15–14:15 | Case study |"].join("\n")), ["15:15–14:15"]);
    assert.deepEqual(reversedEn("The workshop runs 2:00–1:30 pm in Hall A."), ["2:00–1:30 pm"]);
    assert.deepEqual(reversedEn("The workshop runs from 2:00 pm to 1:30 pm in Hall A."), ["2:00 pm to 1:30 pm"]);
  });

  it("does not report a range that crosses noon with one p.m. (8:00–6:00 pm)", () => {
    assert.deepEqual(reversedEn("Open 8:00–6:00 pm, Monday to Friday."), []);
    assert.deepEqual(reversedEn("Open 11:00–1:00 pm."), []);
  });

  it("does not report a 12-hour clock without a.m. or p.m. (9:00–5:00)", () => {
    assert.deepEqual(reversedEn("Office hours: 9:00–5:00."), []);
  });

  it("does not report a range marked as the next day, or overnight", () => {
    assert.deepEqual(reversedEn("Night shift: 23:00–0:30 (next day)."), []);
    assert.deepEqual(reversedEn("Night shift: 22:00–6:00."), []);
  });

  it("reports a range whose end has the same a.m. or p.m. as its start and comes earlier (an a.m./p.m. slip)", () => {
    assert.deepEqual(reversedEn("Work ran 9:00 AM – 5:30 AM on Thursday."), ["9:00 AM – 5:30 AM"]);
    assert.deepEqual(reversedEn("Work ran 6:00 PM – 5:30 PM on Friday."), ["6:00 PM – 5:30 PM"]);
  });

  it("does not report a range from p.m. to a.m., which may run past midnight", () => {
    assert.deepEqual(reversedEn("Work ran 10:00 PM – 6:00 AM on Friday."), []);
  });

  it("does not report a time that was moved", () => {
    assert.deepEqual(reversedEn("The talk was moved from 3:00 pm to 2:30 pm."), []);
  });

  it('does not read "to" alone as a range', () => {
    assert.deepEqual(reversedEn("Arrive at 3:00 pm to 2:30 pm slots."), []);
  });
});

describe("time-range-reversed: a timesheet with start and end columns", () => {
  const HEADER_JA = ["| 日付 | 始業 | 終業 | 休憩 | 実働 |", "| --- | --- | --- | --- | --- |"];
  const HEADER_EN = ["| Date | Time in | Time out | Break | Hours |", "| --- | --- | --- | --- | --- |"];

  it("reports a row whose end is before its start and whose hours do not fit a night shift (ja)", () => {
    const sheet = table([...HEADER_JA, "| 9月1日 | 9:00 | 18:00 | 1:00 | 8.0時間 |", "| 9月2日 | 9:00 | 8:00 | 1:00 | 8.0時間 |"]);
    assert.deepEqual(reversedJa(sheet), ["9:00 | 8:00"]);
  });

  it("reports a row whose end has the same a.m. as its start (en)", () => {
    const sheet = table([...HEADER_EN, "| Mon | 8:00 AM | 5:00 PM | 1:00 | 8.00 |", "| Tue | 8:00 AM | 5:00 AM | 1:00 | 8.00 |"]);
    assert.deepEqual(reversedEn(sheet), ["8:00 AM | 5:00 AM"]);
  });

  it("reports a 24-hour row whose hours do not fit a night shift (en)", () => {
    const sheet = table([...HEADER_EN, "| Mon | 9:00 | 17:30 | 0:30 | 8.00 |", "| Tue | 9:00 | 7:30 | 0:30 | 8.00 |"]);
    assert.deepEqual(reversedEn(sheet), ["9:00 | 7:30"]);
  });

  it("does not report a night shift row whose hours fit the time past midnight", () => {
    assert.deepEqual(reversedJa(table([...HEADER_JA, "| 9月1日 | 22:00 | 6:00 | 1:00 | 7.0時間 |"])), []);
    assert.deepEqual(reversedEn(table([...HEADER_EN, "| Mon | 22:00 | 6:00 | 0:30 | 7.50 |"])), []);
    assert.deepEqual(reversedEn(table([...HEADER_EN, "| Mon | 10:00 PM | 6:00 AM | 0:30 | 7.50 |"])), []);
  });

  it("does not report a row written on a 12-hour clock without a.m. or p.m.", () => {
    assert.deepEqual(reversedJa(table([...HEADER_JA, "| 9月1日 | 9:00 | 5:00 | 1:00 | 7.0時間 |"])), []);
  });

  it("does not report an earlier end in a document that has night work", () => {
    const sheet = table([...HEADER_JA, "| 9月1日 | 9:00 | 8:00 | 1:00 | 8.0時間 |"]);
    assert.deepEqual(reversedJa(`夜勤の手当は別に計算します。\n\n${sheet}`), []);
    const sheetEn = table([...HEADER_EN, "| Mon | 9:00 | 7:30 | 0:30 | 8.00 |"]);
    assert.deepEqual(reversedEn(`Night shift premium is paid separately.\n\n${sheetEn}`), []);
  });

  it("without an hours column, reports only a step back of a few hours", () => {
    const header = ["| 日付 | 出勤 | 退勤 |", "| --- | --- | --- |"];
    assert.deepEqual(reversedJa(table([...header, "| 9月1日 | 9:00 | 8:00 |"])), ["9:00 | 8:00"]);
    assert.deepEqual(reversedJa(table([...header, "| 9月1日 | 22:00 | 6:00 |"])), []);
    assert.deepEqual(reversedJa(table([...header, "| 9月1日 | 9:00 | 5:00 |"])), []);
  });

  it("with a break it cannot read, reports only a step back of a few hours", () => {
    assert.deepEqual(reversedEn(table([...HEADER_EN, "| Mon | 9:00 | 8:00 | - | 8.00 |"])), ["9:00 | 8:00"]);
    assert.deepEqual(reversedEn(table([...HEADER_EN, "| Mon | 9:00 | 5:00 | - | 8.00 |"])), []);
  });

  it("does not read a table without both a start and an end column", () => {
    assert.deepEqual(reversedEn(table(["| Date | Time in | Note |", "| --- | --- | --- |", "| Mon | 9:00 | 8:00 |"])), []);
    assert.deepEqual(reversedEn(table(["| Item | In | Out | Hours |", "| --- | --- | --- | --- |", "| Pump | 9:00 | 8:00 | 8.0 |"])), []);
  });

  it("does not read a cell with more than a time in it", () => {
    assert.deepEqual(reversedJa(table([...HEADER_JA, "| 9月1日 | 22:00 | 翌6:00 | 1:00 | 7.0時間 |"])), []);
  });
});

describe("showsOvernightWork", () => {
  const words = { legs: [], columns: [], dayShifts: [{ pattern: "翌", position: "before" as const, group: "next" }], zones: [] };
  const marks = [{ pattern: "night shift" }];

  it("reads a word for night work, case aside", () => {
    assert.equal(showsOvernightWork("Night shift premium applies.", [], marks, words), true);
  });

  it("reads a time past 24:00", () => {
    assert.equal(showsOvernightWork("勤務 17:00〜25:00", [], marks, words), true);
  });

  it("reads a time marked as the next day", () => {
    const text = "終業 翌6:00";
    assert.equal(showsOvernightWork(text, [spanAt(text, "6:00", 6 * HOUR)], marks, words), true);
  });

  it("finds nothing in a day-time document", () => {
    const text = "始業 9:00、終業 18:00。翌月25日に支払います。";
    assert.equal(showsOvernightWork(text, [spanAt(text, "9:00", 9 * HOUR), spanAt(text, "18:00", 18 * HOUR)], marks, words), false);
    assert.equal(showsOvernightWork("", [], [], words), false);
  });
});
