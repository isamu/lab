import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { pairedTimesOutOfOrder } from "../packages/chaff/src/structure/labelled-time-order.ts";
import { clockTimes } from "../packages/chaff/src/compare/clock-time.ts";
import { secondsOf, SECONDS_PER_DAY } from "../packages/chaff/src/structure/time-marks.ts";
import type { OrderLabel } from "../packages/chaff/src/structure/labelled-order.ts";

// 語で前後の決まった二つの時刻（time-order の pair）。開場と開演、Doors open と Starts。例文はすべて自作。

const RULE = "time-order";

const findingsOf = (source: string, adapter: LanguageAdapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const concertJa = (...items: string[]): string => ["# 公演のご案内", "", "日時：2026年12月12日（土）", "", ...items.map((item) => `- ${item}`)].join("\n");
const concertEn = (...items: string[]): string => ["# Concert", "", "Date: Saturday, December 12, 2026", "", ...items.map((item) => `- ${item}`)].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("time-order (pair): a labelled time that must come first comes later", () => {
  it("doors that open after the start are pointed at, on the doors' time (ja, en)", () => {
    assert.deepEqual(findingsOf(concertJa("開場：18:45", "開演：18:30", "終演予定：20:30")), [
      "「開場」の「18:45」が、後に来るはずの「開演」の「18:30」より遅くなっています",
    ]);
    assert.deepEqual(findingsOf(concertEn("Doors open: 18:45", "Concert starts: 18:30", "Expected finish: 20:30"), en), [
      "Doors open at 18:45 is later than Concert starts at 18:30, which should come after it",
    ]);
  });

  it("a table's label column, meeting and departure, start and end", () => {
    assert.deepEqual(findingsOf("# 受付\n\n| 項目 | 時刻 |\n| --- | --- |\n| 受付開始 | 10:15 |\n| 開始 | 10:00 |\n"), [
      "「受付開始」の「10:15」が、後に来るはずの「開始」の「10:00」より遅くなっています",
    ]);
    assert.deepEqual(findingsOf("# 遠足\n\n集合：8:30\n\n出発：8:15\n").length, 1);
    assert.deepEqual(findingsOf("# Trip\n\n- Meet: 8:30 AM\n- Departure: 8:15 AM\n", en).length, 1);
    assert.deepEqual(findingsOf("# Talk\n\n- Start: 3:00 PM\n- End: 2:30 PM\n", en).length, 1);
  });

  it("times in order, equal times, and times inside a sentence say nothing", () => {
    assert.deepEqual(findingsOf(concertJa("開場：17:30", "開演：18:30", "終演予定：20:30")), []);
    assert.deepEqual(findingsOf(concertJa("開場：18:30", "開演：18:30")), []);
    assert.deepEqual(findingsOf(concertEn("Doors open: 17:30", "Concert starts: 18:30", "Expected finish: 20:30"), en), []);
    assert.deepEqual(findingsOf("# 公演\n\n開場は18:45、開演は18:30です。\n"), []);
    assert.deepEqual(findingsOf("# Concert\n\nThe doors open at 18:45 and the concert starts at 18:30.\n", en), []);
  });

  it("times of different days are not compared: a date between them, or a time past midnight", () => {
    assert.deepEqual(findingsOf("# 二日間の公演\n\n## 12月12日\n\n- 開場：18:00\n\n## 12月13日\n\n- 開演：13:00\n"), []);
    assert.deepEqual(findingsOf("# Two nights\n\n## December 12\n\n- Doors open: 18:00\n\n## December 13\n\n- Starts: 13:00\n", en), []);
    assert.deepEqual(findingsOf(concertJa("開始：23:30", "終了：0:15")), []);
    assert.deepEqual(findingsOf(concertJa("開始：23:30", "終了：翌0:15")), []);
    assert.deepEqual(findingsOf(concertJa("開始：23:30", "終了：24:30")), []);
    assert.deepEqual(findingsOf(concertEn("Start: 23:30", "End: 0:15 (next day)"), en), []);
  });

  it("a next-day mark counts a day on, and a previous-day mark is not read", () => {
    assert.deepEqual(findingsOf(concertJa("開場：翌0:30", "開演：23:30")).length, 1);
    assert.deepEqual(findingsOf(concertJa("開場：18:45", "開演：18:30（前日）")), []);
  });

  it("a range on one line, a pair written far apart, and a line without a time are not compared", () => {
    assert.deepEqual(findingsOf(concertJa("開場：18:45〜19:00", "開演：18:30")), []);
    assert.deepEqual(findingsOf(concertJa("開場：18:45", "", "", "", "", "", "", "", "", "", "", "開演：18:30")), []);
    assert.deepEqual(findingsOf(concertJa("開場：開演の30分前", "開演：18:30")), []);
  });
});

const PAIR_LABELS: readonly OrderLabel[] = [
  { pattern: "開場", group: "doors", position: "before" },
  { pattern: "開演", group: "doors", position: "after" },
];
const NO_MARKS = { legs: [], columns: [], dayShifts: [], zones: [] };
const HALF_DAY = SECONDS_PER_DAY / 2;
const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const MINUTES = [0, 5, 15, 30, 45, 59];
const CLOCKS = HOURS.flatMap((hour) => MINUTES.map((minute) => `${String(hour)}:${String(minute).padStart(2, "0")}`));

/** Where pairedTimesOutOfOrder reports a doors time and a start time written on two list items. */
const reportedOffsets = (doors: string, start: string): { readonly source: string; readonly offsets: number[] } => {
  const source = `- 開場：${doors}\n- 開演：${start}\n`;
  const times = clockTimes(source).map((time) => ({ start: time.start, end: time.end, seconds: secondsOf(time.key) }));
  return { source, offsets: pairedTimesOutOfOrder({ source, times, dates: [], words: NO_MARKS }, PAIR_LABELS).map((issue) => issue.offset) };
};

/** The property the pair reading holds: on one day, a later-labelled time is reported exactly when it is earlier, by no more than half a day. */
describe("pairedTimesOutOfOrder over generated pairs", () => {
  it("reports the doors' time exactly when the start is earlier than the doors by at most half a day", () => {
    CLOCKS.forEach((doors) =>
      CLOCKS.forEach((start) => {
        const { source, offsets } = reportedOffsets(doors, start);
        const back = secondsOf(doors) - secondsOf(start);
        assert.deepEqual(offsets, back > 0 && back <= HALF_DAY ? [source.indexOf(doors)] : [], source);
      }),
    );
  });
});
