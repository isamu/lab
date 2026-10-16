import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Span } from "../packages/chaff/src/plugin.ts";
import type { DurationUnit } from "../packages/chaff/src/derived/date-arithmetic.ts";
import { spanIndex } from "../packages/chaff/src/compare/spans.ts";
import { isCountPerPeriod, type PerPeriodWords } from "../packages/chaff/src/derived/count-per-period.ts";

// duration-mismatch: 期間あたりの数（週3日、3 days a week）と勤務の決まりの名（週休2日制）の中の数は、始まりに足す期間ではない。例文はすべて自作。

const durations = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 案内\n\n${source}\n`, adapter), loadRules(adapter.id), { "duration-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "duration-mismatch")
    .map((finding) => `${String(finding.values["end"])}→${String(finding.values["expected"])}`);

describe("duration-mismatch: 期間あたりの数", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("勤務の決まりの名の中の数を期間と読まない（年末年始は年をまたぐ）", () => {
    assert.deepEqual(durations("完全週休2日制（土曜日・日曜日）、祝日、年末年始（12月29日～1月3日）の休みがあります。", ja), []);
    assert.deepEqual(durations("週休2日制で、4月1日から6月30日まで勤めます。", ja), []);
    assert.deepEqual(durations("4週8休で、4月1日から6月30日まで勤めます。", ja), []);
  });

  it("週・月・年あたりの日数を期間と読まない", () => {
    assert.deepEqual(durations("週3日の勤務で、期間は4月1日から6月30日までです。", ja), []);
    assert.deepEqual(durations("勤務は月10日で、4月1日から6月30日までです。", ja), []);
    assert.deepEqual(durations("You work 3 days a week from April 1, 2026 to June 30, 2026.", en), []);
    assert.deepEqual(durations("The office closes 10 days per year, from December 29, 2026 to January 3, 2027.", en), []);
  });

  it("本当の食い違いは言う（年をまたぐ範囲も、向きの逆な範囲も）", () => {
    assert.deepEqual(durations("4月1日から3日間（5月1日まで）休みます。", ja), ["5月1日→4月3日"]);
    assert.deepEqual(durations("年末年始（12月29日～1月3日）の10日間は休みです。", ja), ["1月3日→1月7日"]);
    assert.deepEqual(durations("3月1日から2月1日まで（30日間）休みます。", ja), ["2月1日→3月30日"]);
    assert.deepEqual(durations("契約は2026年4月1日から毎年1年間（2027年4月30日まで）です。", ja), ["2027年4月30日→2027年3月31日"]);
    assert.deepEqual(durations("We rent it for 3 days from April 1, 2026 until May 1, 2026.", en), ["May 1, 2026→April 3, 2026"]);
  });
});

describe("isCountPerPeriod", () => {
  const words: PerPeriodWords = {
    periods: [
      { word: "週", position: "before", unit: "week" },
      { word: "毎年", position: "before", unit: "year" },
      { word: "月", position: "before", unit: "month" },
      { word: "a week", position: "after", unit: "week" },
    ],
    schedules: spanIndex([{ start: 10, end: 16 }]),
  };
  const days: Span & { readonly unit: DurationUnit } = { start: 2, end: 4, unit: "day" };

  it("期間の語のすぐ後ろの、期間より小さな単位の数", () => {
    assert.equal(isCountPerPeriod(days, "勤務は週", "", words), true);
    assert.equal(isCountPerPeriod(days, "", "a week from", words), true);
    assert.equal(isCountPerPeriod({ ...days, unit: "month" }, "毎年", "", words), true);
  });

  it("期間と同じか大きな単位なら長さ（毎年1年間、週1週間）", () => {
    assert.equal(isCountPerPeriod({ ...days, unit: "year" }, "毎年", "", words), false);
    assert.equal(isCountPerPeriod({ ...days, unit: "week" }, "週", "", words), false);
    assert.equal(isCountPerPeriod({ ...days, unit: "month" }, "", "a week", words), false);
  });

  it("数か数え方の後ろの 月 は長さの一部", () => {
    assert.equal(isCountPerPeriod(days, "3か月", "", words), false);
    assert.equal(isCountPerPeriod(days, "1ヶ月", "", words), false);
    assert.equal(isCountPerPeriod(days, "十月", "", words), false);
  });

  it("決まりの名の中の数", () => {
    assert.equal(isCountPerPeriod({ ...days, start: 12, end: 14 }, "", "", words), true);
    assert.equal(isCountPerPeriod({ ...days, start: 16, end: 18 }, "", "", words), false);
  });

  it("何も無ければ期間", () => {
    assert.equal(isCountPerPeriod(days, "", "", words), false);
    assert.equal(isCountPerPeriod(days, "から", "間", { periods: [], schedules: spanIndex([]) }), false);
  });
});
