import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import {
  bracketAround,
  isSameDate,
  isSameZone,
  isTooShort,
  mentionsTravel,
  outsideBrackets,
  sentenceAround,
} from "../packages/chaff/src/structure/connection-times.ts";
import type { TimeWords } from "../packages/chaff/src/structure/time-marks.ts";

// 移動の時間より短い乗り継ぎ（connection-time-short）。移動の時間は文書に書いたものだけを使う。

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "connection-time-short": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "connection-time-short")
    .map((finding) => `${String(finding.values["from"])}->${String(finding.values["time"])}<${String(finding.values["travel"])}`);

const shortJa = (source: string): string[] => findings(source, ja, "ja");
const shortEn = (source: string): string[] => findings(source, en, "en");

const list = (...items: string[]): string => ["# 日程", "", ...items.map((item) => `- ${item}`)].join("\n");
const table = (...rows: string[]): string => ["# Day", "", "| Time | Item |", "| --- | --- |", ...rows.map((row) => `| ${row} |`)].join("\n");

const FLIGHT_JA = "08:00 JAL 305便（羽田 08:00発、福岡 09:50着）";
const FLIGHT_EN = "7:30 AM Flight AA 2140 (departs Boston 7:30 AM, arrives Washington Reagan 9:05 AM)";

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("connection-time-short: a travel time added to an item, from the arrival before it", () => {
  it("an item sooner after the arrival than its stated travel time is pointed at (ja, en)", () => {
    assert.deepEqual(shortJa(list(FLIGHT_JA, "09:55 博多駅で田中様と合流（福岡空港から地下鉄で約10分）", "13:00 打ち合わせ")), ["09:50->09:55<10分"]);
    assert.deepEqual(shortEn(list(FLIGHT_EN, "9:15 AM Meet Ms. Tanaka at Metro Center (25 minutes from the airport by Metro)", "1:00 PM Meeting")), [
      "9:05 AM->9:15 AM<25 minutes",
    ]);
  });

  it("enough time, or exactly the stated time, is not reported", () => {
    assert.deepEqual(shortJa(list(FLIGHT_JA, "10:30 博多駅で田中様と合流（福岡空港から地下鉄で約10分）")), []);
    assert.deepEqual(shortJa(list(FLIGHT_JA, "10:00 博多駅で田中様と合流（福岡空港から地下鉄で約10分）")), []);
    assert.deepEqual(shortEn(list(FLIGHT_EN, "10:00 AM Meet Ms. Tanaka at Metro Center (25 minutes from the airport by Metro)")), []);
  });

  it("a travel sentence with no time, then a dated time, is measured from the arrival on that date in a table (ja, en)", () => {
    const ja = [
      "| 区間 | 出発 | 到着 |",
      "| --- | --- | --- |",
      "| 羽田 → 新千歳 | 2月8日 13:00 | 2月8日 14:35 |",
      "| 新千歳 → 羽田 | 2月11日 15:30 | 2月11日 17:10 |",
      "",
      "新千歳空港からは快速エアポートで札幌駅へ向かいます（約40分）。2月8日は15:00に札幌駅で合流します。",
    ].join("\n");
    assert.deepEqual(shortJa(ja), ["14:35->15:00<40分"]);
    assert.deepEqual(shortJa(ja.replace("15:00に", "15:30に")), []);
    const en = [
      "| Leg | Departs | Arrives |",
      "| --- | --- | --- |",
      "| Dallas → Denver | Feb 8, 1:00 PM | Feb 8, 2:10 PM |",
      "",
      "From Denver airport, the A Line train runs to Union Station in about 40 minutes. On February 8, I will meet Dr. Kobayashi at 2:30 PM to visit the venue.",
    ].join("\n");
    assert.deepEqual(shortEn(en), ["2:10 PM->2:30 PM<40 minutes"]);
    assert.deepEqual(shortEn(en.replace("2:30 PM", "3:15 PM")), []);
  });

  it("a stated minimum connection time or an allowance counts as a travel time", () => {
    assert.deepEqual(
      shortEn(list("8:00 AM Flight (departs Tokyo 8:00 AM, arrives Frankfurt 10:05 AM)", "10:40 AM Flight LH 123 (minimum connection time 45 minutes)")),
      ["10:05 AM->10:40 AM<45 minutes"],
    );
    assert.deepEqual(shortJa(list("08:00 便（羽田 08:00発、伊丹 09:10着）", "09:30 新大阪駅で合流（乗り換えに40分）")), ["09:10->09:30<40分"]);
  });
});

describe("connection-time-short: a line that is itself a move, to the next item of the day", () => {
  it("the next item before the move ends is pointed at (ja, en)", () => {
    assert.deepEqual(shortJa(table("09:15 | 京都駅 着", "10:00 | 京都駅 八条口から貸切バスで清水寺へ（約30分）", "10:15 | 清水寺 拝観", "12:30 | 昼食")), [
      "10:00->10:15<30分",
    ]);
    assert.deepEqual(
      shortEn(table("09:05 | Arrive York", "09:30 | Coach from York station to the Minster (about 15 minutes)", "09:35 | Minster tour", "12:30 | Lunch")),
      ["09:30->09:35<15 minutes"],
    );
  });

  it("a next item at or after the end of the move is not reported", () => {
    assert.deepEqual(shortJa(table("10:00 | 京都駅から貸切バスで清水寺へ（約30分）", "10:30 | 清水寺 拝観", "12:30 | 昼食")), []);
    assert.deepEqual(shortEn(table("09:30 | Coach to the Minster (about 15 minutes)", "10:00 | Minster tour", "12:30 | Lunch")), []);
  });

  it("the last item of a day has nothing to reach", () => {
    assert.deepEqual(shortEn(table("17:00 | Dinner", "18:00 | Coach to the hotel (about 75 minutes)")), []);
  });
});

describe("connection-time-short: what it does not report", () => {
  it("no stated travel time: a length without a word of travel, or no length at all", () => {
    assert.deepEqual(shortJa(list(FLIGHT_JA, "09:55 博多駅で田中様と合流（打ち合わせは約60分）")), []);
    assert.deepEqual(shortJa(list(FLIGHT_JA, "09:55 博多駅で田中様と合流")), []);
    assert.deepEqual(shortEn(list(FLIGHT_EN, "9:15 AM Meet Ms. Tanaka at Metro Center")), []);
  });

  it("a travel time given as an upper limit", () => {
    assert.deepEqual(shortJa(list(FLIGHT_JA, "09:55 博多駅で合流（空港から地下鉄で10分以内）")), []);
    assert.deepEqual(shortEn(list(FLIGHT_EN, "9:15 AM Meet at Metro Center (within 25 minutes by Metro)")), []);
    assert.deepEqual(shortEn(list(FLIGHT_EN, "9:15 AM Meet at Metro Center (25 minutes or less by Metro)")), []);
  });

  it("a travel word in a place name does not make an item a move when its aside names the travel", () => {
    const items = [FLIGHT_EN, "10:00 AM Bus Gate briefing (25 minutes from the airport by taxi)", "10:10 AM Coffee"];
    assert.deepEqual(shortEn(list(...items)), []);
    assert.deepEqual(shortEn(list(...items).replace("10:00 AM Bus", "9:15 AM Bus")), ["9:05 AM->9:15 AM<25 minutes"]);
  });

  it("in prose, the time the travel leads to is the one after the travel sentence, not an earlier one", () => {
    const prose =
      "# Day\n\nArrives Chicago 9:00 AM. Coffee at 9:15 AM. From the airport, the taxi to the office takes about 20 minutes. Meet the client at 9:30 AM.";
    assert.deepEqual(shortEn(prose), []);
  });

  it("the time just before is not an arrival: where the move starts is unknown", () => {
    assert.deepEqual(shortJa(list("09:00 工場の見学", "09:05 博多駅で合流（工場から徒歩10分）")), []);
    assert.deepEqual(shortEn(list(FLIGHT_EN, "9:10 AM Coffee", "9:15 AM Meet at Metro Center (25 minutes from the airport by Metro)")), []);
  });

  it("times on different dates, and an arrival on another day's list", () => {
    const en = [
      "| Leg | Departs | Arrives |",
      "| --- | --- | --- |",
      "| Dallas → Denver | Feb 8, 1:00 PM | Feb 8, 2:10 PM |",
      "",
      "The A Line train runs to Union Station in about 40 minutes. On February 9, I will meet Dr. Kobayashi at 2:30 PM to visit the venue.",
    ].join("\n");
    assert.deepEqual(shortEn(en), []);
    assert.deepEqual(shortJa(["# 1日目", "", `- ${FLIGHT_JA}`, "", "# 2日目", "", "- 09:55 博多駅で合流（福岡空港から地下鉄で約10分）"].join("\n")), []);
  });

  it("an arrival marked as the next day, and a time that goes back", () => {
    assert.deepEqual(shortJa(list("22:00 便（羽田 22:00発、那覇 翌0:30着）", "00:40 ホテル着（空港からタクシーで約20分）")), []);
    assert.deepEqual(shortJa(list(FLIGHT_JA, "09:40 博多駅で合流（福岡空港から地下鉄で約10分）")), []);
  });

  it("times in different time zones", () => {
    assert.deepEqual(
      shortEn(list("7:30 AM Flight (departs Boston 7:30 AM EST, arrives Chicago 9:05 AM CST)", "9:15 AM EST Meet at the Loop (25 minutes by train)")),
      [],
    );
    assert.deepEqual(shortJa(list("08:00 便（成田 08:00発、ホノルル 現地時間 20:10着）", "20:15 ホテル（空港からバスで約30分）")), []);
  });
});

describe("connection-time-short: the pure parts", () => {
  it("isTooShort: a gap shorter than the travel time, and not a negative gap", () => {
    assert.equal(isTooShort(5 * 60, 10), true);
    assert.equal(isTooShort(10 * 60, 10), false);
    assert.equal(isTooShort(0, 10), true);
    assert.equal(isTooShort(-60, 10), false);
    assert.equal(isTooShort(60, 0), false);
  });

  it("isSameDate: both undated, or the same value", () => {
    assert.equal(isSameDate(undefined, undefined), true);
    assert.equal(isSameDate("02-08", "02-08"), true);
    assert.equal(isSameDate("02-08", "02-09"), false);
    assert.equal(isSameDate("02-08", undefined), false);
    assert.equal(isSameDate("2027-02-08", "02-08"), false);
  });

  it("isSameZone: no zone or the same zone; not two zones on a line, a local time, or different zones", () => {
    const words: TimeWords = {
      legs: [],
      columns: [],
      dayShifts: [],
      zones: [{ pattern: "EST" }, { pattern: "CST" }, { pattern: "local time", group: "local" }],
    };
    assert.equal(isSameZone("9:05 AM", "9:15 AM", words), true);
    assert.equal(isSameZone("9:05 AM EST", "9:15 AM EST", words), true);
    assert.equal(isSameZone("9:05 AM EST", "9:15 AM CST", words), false);
    assert.equal(isSameZone("9:05 AM EST", "9:15 AM", words), false);
    assert.equal(isSameZone("7:30 EST, 9:05 CST", "9:15", words), false);
    assert.equal(isSameZone("9:05 local time", "9:15 local time", words), false);
  });

  it("outsideBrackets drops bracketed asides, nested ones too", () => {
    assert.equal(outsideBrackets("博多駅で合流（福岡空港から地下鉄で約10分）"), "博多駅で合流 ");
    assert.equal(outsideBrackets("Meet (25 minutes (by Metro)) here"), "Meet   here");
    assert.equal(outsideBrackets("no brackets"), "no brackets");
    assert.equal(outsideBrackets(""), "");
  });

  it("mentionsTravel: a whole word, case aside", () => {
    const cues = [{ pattern: "bus" }, { pattern: "by Metro" }, { pattern: "徒歩" }];
    assert.equal(mentionsTravel("Coach or Bus", cues), true);
    assert.equal(mentionsTravel("25 minutes by metro", cues), true);
    assert.equal(mentionsTravel("駅から徒歩2分", cues), true);
    assert.equal(mentionsTravel("business meeting at Metro Center", cues), false);
    assert.equal(mentionsTravel("", cues), false);
  });

  it("bracketAround: the innermost bracket holding the span, or none", () => {
    const text = "合流（福岡空港から地下鉄で約10分）";
    const at = text.indexOf("10分");
    const aside = bracketAround(text, at, at + 3);
    assert.equal(aside === undefined ? undefined : text.slice(aside.start, aside.end), "福岡空港から地下鉄で約10分");
    const nested = "Meet (by Metro (25 minutes)) here";
    const inner = bracketAround(nested, nested.indexOf("25"), nested.indexOf("25") + 10);
    assert.equal(inner === undefined ? undefined : nested.slice(inner.start, inner.end), "25 minutes");
    assert.equal(bracketAround("Coach (x) about 15 minutes", 16, 26), undefined);
    assert.equal(bracketAround("unclosed (15 minutes", 10, 20), undefined);
  });

  it("sentenceAround: from the break before to the break after", () => {
    const text = "We land. The train runs in 40 minutes. Then lunch.";
    const at = text.indexOf("40");
    const span = sentenceAround(text, at, at + 10);
    assert.equal(text.slice(span.start, span.end), "The train runs in 40 minutes");
    assert.deepEqual(sentenceAround("約10分", 1, 4), { start: 0, end: 4 });
  });
});
