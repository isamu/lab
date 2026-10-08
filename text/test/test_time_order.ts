import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { elapsedSeconds } from "../packages/chaff/src/structure/time-order.ts";
import { arrivesFirst, cellsOf } from "../packages/chaff/src/structure/leg-times.ts";
import { crossesZones, isWordAt, secondsOf, zonesIn, type TimeWords } from "../packages/chaff/src/structure/time-marks.ts";

// 一日の予定の時刻の順番（time-order）と、発より前の着（arrival-before-departure）。

const findings = (rule: string, source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [rule]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => {
      if (rule === "arrival-before-departure") return `${String(finding.values["arrival"])}<${String(finding.values["departure"])}`;
      return finding.values["next"] === undefined
        ? `${String(finding.values["time"])}<${String(finding.values["previous"])}`
        : `${String(finding.values["time"])}>${String(finding.values["next"])}`;
    });

const orderJa = (source: string): string[] => findings("time-order", source, ja, "ja");
const orderEn = (source: string): string[] => findings("time-order", source, en, "en");
const legsJa = (source: string): string[] => findings("arrival-before-departure", source, ja, "ja");
const legsEn = (source: string): string[] => findings("arrival-before-departure", source, en, "en");

const list = (...items: string[]): string => ["# 日程", "", ...items.map((item) => `- ${item}`)].join("\n");
const table = (...rows: string[]): string => ["# Day", "", "| Time | Item |", "| --- | --- |", ...rows.map((row) => `| ${row} |`)].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("time-order: times out of order within a day", () => {
  it("a list item whose time goes back is pointed at (ja, en)", () => {
    assert.deepEqual(orderJa(list("09:00 工場の見学", "12:00 昼食", "11:00 報告会", "18:00 懇親会")), ["11:00<12:00"]);
    assert.deepEqual(orderEn(list("9:00 AM Tour", "12:00 PM Lunch", "11:00 AM Report", "6:30 PM Dinner")), ["11:00 AM<12:00 PM"]);
  });

  it("the time out of place is the one pointed at, not the one after it", () => {
    assert.deepEqual(orderEn(list("09:00 a", "21:00 b", "10:00 c", "11:00 d", "12:00 e")), ["21:00<09:00"]);
  });

  it("a first time out of place names the next time", () => {
    assert.deepEqual(orderEn(list("15:00 a", "09:00 b", "10:00 c", "11:00 d")), ["15:00>09:00"]);
  });

  it("a table row starting with a time, with or without a date before it", () => {
    assert.deepEqual(orderEn(table("06:40 | Meet", "07:00 | Train", "12:30 | Lunch", "12:00 | Museum", "17:30 | Hotel")), ["12:00<12:30"]);
    assert.deepEqual(
      orderJa(
        [
          "| 時刻 | 内容 |",
          "| --- | --- |",
          "| 2月9日 09:30 | 受付 |",
          "| 2月9日 10:00 | 基調講演 |",
          "| 2月9日 09:00 | 一般講演 |",
          "| 2月9日 15:20 | 発表 |",
        ].join("\n"),
      ),
      ["09:00<10:00"],
    );
    assert.deepEqual(orderEn(table("Feb 9, 9:30 AM | Registration", "Feb 9, 10:00 AM | Keynote", "Feb 9, 9:00 AM | Session", "Feb 9, 3:20 PM | Talk")), [
      "9:00 AM<10:00 AM",
    ]);
  });

  it("Japanese clock words are read (午前9時, 14時30分)", () => {
    assert.deepEqual(orderJa(list("午前9時 開会", "10時 講演", "9時30分 休憩", "14時30分 閉会")), ["9時30分<10時"]);
  });

  it("times in order, equal times, and times in prose say nothing", () => {
    assert.deepEqual(orderJa(list("09:00 集合", "09:00 点呼", "10:30 出発", "12:00 昼食")), []);
    assert.deepEqual(orderEn("# Notes\n\nWe met at 15:00. Lunch was at 12:00. The bus left at 09:00."), []);
  });

  it("a date heading starts a new day", () => {
    const source = [
      "# Trip",
      "",
      "## 1 May 2026",
      "",
      "- 09:00 a",
      "- 13:00 b",
      "- 18:00 c",
      "",
      "## 2 May 2026",
      "",
      "- 08:00 d",
      "- 10:00 e",
      "- 12:00 f",
    ].join("\n");
    assert.deepEqual(orderEn(source), []);
  });

  it("a change of the date at the start of the rows starts a new day", () => {
    assert.deepEqual(orderEn(table("Feb 8, 3:00 PM | a", "Feb 8, 6:00 PM | b", "Feb 9, 9:00 AM | c", "Feb 9, 10:00 AM | d")), []);
  });

  it("an overnight time marked as the next day is in order (翌, +1, next day)", () => {
    assert.deepEqual(orderJa(list("22:00 出港", "23:30 消灯", "翌 00:15 寄港", "翌 06:00 到着")), []);
    assert.deepEqual(orderJa(list("22:00 出港", "23:30 消灯", "00:15（翌日） 寄港", "06:00 到着")), []);
    assert.deepEqual(orderEn(list("22:00 Sail", "23:30 Lights out", "00:15 (+1) Port call", "06:00 Arrive")), []);
    assert.deepEqual(orderEn(list("22:00 Sail", "23:30 Lights out", "00:15 next day Port call", "06:00 Arrive")), []);
  });

  it("an unmarked time more than half a day back is read as past midnight; a smaller step back is not", () => {
    assert.deepEqual(orderEn(list("22:00 Sail", "23:30 Lights out", "00:15 Port call", "06:00 Arrive")), []);
    assert.deepEqual(orderEn(list("20:00 Sail", "23:30 Lights out", "12:15 Lunch", "23:45 Arrive")), ["12:15<23:30"]);
  });

  it("a time after a next-day mark is still compared on that day", () => {
    assert.deepEqual(orderJa(list("22:00 出港", "翌 01:00 寄港", "00:30 出港", "06:00 到着")), ["00:30<01:00"]);
  });

  it("a local-time mark or a change of zone starts a new day", () => {
    assert.deepEqual(orderEn(list("09:00 Leave Tokyo", "10:00 Board", "08:00 local time Land in Honolulu", "09:00 local time Hotel")), []);
    assert.deepEqual(orderEn(list("09:00 JST Leave", "10:00 JST Board", "08:00 HST Land", "09:00 HST Hotel")), []);
  });

  it("two times, or a list where most times are not in order, say nothing", () => {
    assert.deepEqual(orderEn(list("15:00 a", "09:00 b")), []);
    assert.deepEqual(orderEn(list("15:00 a", "09:00 b", "13:00 c", "08:00 d", "11:00 e")), []);
  });

  it("ranges that overlap one another (opening hours by weekday) are not a day's schedule; a programme of ranges is", () => {
    assert.deepEqual(orderEn(table("09:00-18:00 | Mon", "09:00-18:00 | Tue", "08:00-18:00 | Wed")), []);
    assert.deepEqual(orderEn(table("09:00–10:00 | Keynote", "12:00–13:00 | Lunch", "11:00–12:00 | Panel", "13:00–14:00 | Close")), ["11:00<12:00"]);
  });

  it("an item with the time after other words does not start with a time", () => {
    assert.deepEqual(orderEn(list("Meet at 09:00", "Lunch at 12:00", "Talk at 11:00", "Dinner at 18:00")), []);
  });
});

describe("arrival-before-departure", () => {
  it("発 and 着 right after the times (ja)", () => {
    assert.deepEqual(legsJa(list("11:30 JAL 316便（福岡 11:30発、羽田 11:05着）")), ["11:05<11:30"]);
    assert.deepEqual(legsJa("のぞみ240号は10:30発 → 09:50着です。"), ["09:50<10:30"]);
    assert.deepEqual(legsJa(list("11:30 JAL 316便（福岡 11:30発、羽田 13:05着）")), []);
  });

  it("departs and arrives, dep and arr before the times (en)", () => {
    assert.deepEqual(legsEn(list("1:30 PM Flight AA 2177 (departs Washington Reagan 1:30 PM, arrives Boston 1:05 PM)")), ["1:05 PM<1:30 PM"]);
    assert.deepEqual(legsEn("Train 12: dep 10:30 arr 09:50."), ["09:50<10:30"]);
    assert.deepEqual(legsEn("Train 12: dep 10:30 arr 11:50."), []);
  });

  it("a next-day mark on the arrival adds a day", () => {
    assert.deepEqual(legsJa("夜行バスは23:30発、翌06:10着です。"), []);
    assert.deepEqual(legsJa("夜行バスは23:30発、06:10着（翌日）です。"), []);
    assert.deepEqual(legsEn("The night train: dep 23:30, arr 06:10 +1."), []);
    assert.deepEqual(legsEn("The night train: dep 23:30, arr 06:10 (next day)."), []);
    assert.deepEqual(legsEn("The night train: dep 23:30, arr 06:10."), ["06:10<23:30"]);
  });

  it("two different time zones, or a local-time mark, are not compared", () => {
    assert.deepEqual(legsEn("Flight NH 8: dep 17:00 JST, arr 09:50 PST."), []);
    assert.deepEqual(legsEn("Flight NH 8: dep 17:00, arr 09:50 local time."), []);
    assert.deepEqual(legsJa("NH8便は17:00発、09:50着（現地時間）です。"), []);
    assert.deepEqual(legsEn("Flight NH 8: dep 17:00 UTC+9, arr 09:50 UTC-8."), []);
    assert.deepEqual(legsEn("Flight 8: dep 17:00 UTC, arr 09:50 UTC."), ["09:50<17:00"]);
  });

  it("a table's departure and arrival columns, with dates in the cells", () => {
    const tableJa = [
      "| 区間 | 便名 | 出発 | 到着 |",
      "| --- | --- | --- | --- |",
      "| 羽田 → 新千歳 | ANA 55便 | 2月8日 13:00 | 2月8日 14:35 |",
      "| 新千歳 → 羽田 | ANA 70便 | 2月11日 15:30 | 2月11日 15:10 |",
    ].join("\n");
    assert.deepEqual(legsJa(tableJa), ["15:10<15:30"]);
    const tableEn = [
      "| Leg | Flight | Departs | Arrives |",
      "| --- | --- | --- | --- |",
      "| A → B | WN 1 | Feb 8, 1:00 PM | Feb 8, 2:10 PM |",
      "| B → A | WN 2 | Feb 11, 3:30 PM | Feb 11, 3:05 PM |",
    ].join("\n");
    assert.deepEqual(legsEn(tableEn), ["3:05 PM<3:30 PM"]);
  });

  it("a later arrival date wins over an earlier time; a date on one side only is not compared", () => {
    const rows = (departs: string, arrives: string): string =>
      ["| Flight | Departs | Arrives |", "| --- | --- | --- |", `| NH 1 | ${departs} | ${arrives} |`].join("\n");
    assert.deepEqual(legsEn(rows("Feb 8, 11:00 PM", "Feb 9, 6:00 AM")), []);
    assert.deepEqual(legsEn(rows("Feb 9, 11:00 PM", "Feb 8, 11:30 PM")), ["11:30 PM<11:00 PM"]);
    assert.deepEqual(legsEn(rows("Feb 8, 11:00 PM", "6:00 AM")), []);
  });

  it("a column heading with a note in brackets is still the column; zones in the heading stop the comparison", () => {
    const rows = (left: string, right: string): string =>
      ["| Flight | " + left + " | " + right + " |", "| --- | --- | --- |", "| NH 1 | 17:00 | 09:50 |"].join("\n");
    assert.deepEqual(legsEn(rows("Departs (JST)", "Arrives (JST)")), ["09:50<17:00"]);
    assert.deepEqual(legsEn(rows("Departs (JST)", "Arrives (PST)")), []);
  });

  it("a date earlier in the line is not the time's date", () => {
    assert.deepEqual(legsEn("Sales start on 2 November 2026. The return flight departs Fukuoka at 11:30 and arrives in Tokyo at 11:05."), ["11:05<11:30"]);
  });

  it("the arrival column may stand left of the departure column", () => {
    assert.deepEqual(legsEn(["| Flight | Arrives | Departs |", "| --- | --- | --- |", "| WN 2 | 09:50 | 10:30 |"].join("\n")), ["09:50<10:30"]);
  });

  it("a zone written on one side only is not compared", () => {
    assert.deepEqual(legsEn(["| Flight | Departs | Arrives |", "| --- | --- | --- |", "| NH 8 | 17:00 JST | 09:50 |"].join("\n")), []);
  });

  it("an arrival in a later sentence is not the departure's", () => {
    assert.deepEqual(legsEn("Flight AA123 dep 10:30. Hotel transfer arr 09:50."), []);
    assert.deepEqual(legsJa("往路は10:30発。送迎は09:50着です。"), []);
  });

  it("an arrival before a departure (a hotel stay) is not a leg", () => {
    assert.deepEqual(legsEn("Hotel: arrival 15:00, departure 11:00."), []);
  });

  it("a word that only begins like dep or arr is not one (department, arrange)", () => {
    assert.deepEqual(legsEn("The department 10:30 meeting; arrange 09:50 call."), []);
  });
});

const words: TimeWords = {
  legs: [],
  columns: [],
  dayShifts: [],
  zones: [{ pattern: "UTC" }, { pattern: "JST" }, { pattern: "local time", group: "local" }],
};

describe("time marks: the pure readers", () => {
  it("secondsOf reads HH:MM and HH:MM:SS", () => {
    assert.equal(secondsOf("00:00"), 0);
    assert.equal(secondsOf("09:30"), 34_200);
    assert.equal(secondsOf("23:59:59"), 86_399);
  });

  it("isWordAt keeps letters and digits from running on", () => {
    assert.equal(isWordAt("dep 10:30", 0, "dep"), true);
    assert.equal(isWordAt("department", 0, "dep"), false);
    assert.equal(isWordAt("06:10 +1", 6, "+1"), true);
    assert.equal(isWordAt("06:10 +10", 6, "+1"), false);
    assert.equal(isWordAt("10:30発", 5, "発"), true);
    assert.equal(isWordAt("", 0, ""), false);
  });

  it("zonesIn reads an offset with the zone, and once per written form", () => {
    assert.deepEqual(
      zonesIn("17:00 UTC+9 and 09:50 UTC-8", words).map((zone) => zone.text),
      ["UTC+9", "UTC-8"],
    );
    assert.deepEqual(
      zonesIn("17:00 JST to 19:00 JST", words).map((zone) => zone.text),
      ["JST"],
    );
    assert.deepEqual(zonesIn("no zone here", words), []);
  });

  it("crossesZones: two zones or a local mark", () => {
    assert.equal(crossesZones([]), false);
    assert.equal(crossesZones([{ text: "JST" }]), false);
    assert.equal(crossesZones([{ text: "JST" }, { text: "PST" }]), true);
    assert.equal(crossesZones([{ text: "local time", group: "local" }]), true);
  });

  it("elapsedSeconds: next-day marks, rolling past midnight, and staying on the day", () => {
    const hour = 3600;
    assert.deepEqual(
      elapsedSeconds([
        { seconds: 23 * hour, shift: 0 },
        { seconds: 1 * hour, shift: 1 },
        { seconds: 2 * hour, shift: 0 },
      ]),
      [23 * hour, 25 * hour, 26 * hour],
    );
    assert.deepEqual(
      elapsedSeconds([
        { seconds: 23 * hour, shift: 0 },
        { seconds: 1 * hour, shift: 0 },
      ]),
      [23 * hour, 25 * hour],
    );
    assert.deepEqual(
      elapsedSeconds([
        { seconds: 12 * hour, shift: 0 },
        { seconds: 11 * hour, shift: 0 },
      ]),
      [12 * hour, 11 * hour],
    );
    assert.deepEqual(elapsedSeconds([]), []);
  });

  it("arrivesFirst compares dates first, and only dates of one shape", () => {
    const at = (seconds: number, date?: string, shift = 0, zone = "") => ({
      offset: 0,
      end: 0,
      written: "",
      zone,
      seconds,
      shift,
      date,
    });
    assert.equal(arrivesFirst(at(100), at(50)), true);
    assert.equal(arrivesFirst(at(100), at(50, undefined, 1)), false);
    assert.equal(arrivesFirst(at(100, "02-08"), at(50, "02-09")), false);
    assert.equal(arrivesFirst(at(50, "02-09"), at(100, "02-08")), true);
    assert.equal(arrivesFirst(at(100, "02-08"), at(50)), false);
    assert.equal(arrivesFirst(at(100, "2027-02-08"), at(50, "02-08")), false);
    assert.equal(arrivesFirst(at(100, undefined, 0, "JST"), at(50)), false);
    assert.equal(arrivesFirst(at(100, undefined, 0, "JST"), at(50, undefined, 0, "JST")), true);
  });

  it("cellsOf splits a row with or without the outer bars", () => {
    const cells = (row: string): string[] => cellsOf(row, 0, row.length).map((cell) => row.slice(cell.start, cell.end).trim());
    assert.deepEqual(cells("| a | b | c |"), ["a", "b", "c"]);
    assert.deepEqual(cells("a | b"), ["a", "b"]);
    assert.deepEqual(cells("| a \\| b | c |"), ["a \\| b", "c"]);
  });
});
