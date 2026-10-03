import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { impossibleDates, type CalendarWords } from "../packages/chaff/src/detectors/impossible-date.ts";
import { loadLexicons as loadJaLexicons } from "../packages/lang-ja/src/lexicons.ts";

// 暦に無い日付（impossible-date）。例文はすべて自作。

const RULE = "impossible-date";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const WORDS: CalendarWords = {
  months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December", "Feb", "Sept"],
  units: ["年", "月", "日"],
  eras: ["令和"],
};

const writtenIn = (text: string): string[] => impossibleDates(text, WORDS).map((found) => `${found.written}:${found.reason}`);

describe("impossible-date: 暦に無い日付", () => {
  it("月に無い日（2月30日、4月31日）を言う", () => {
    assert.deepEqual(findingsOf("締切は 4月31日 です。\n"), ["「4月31日」は暦にありません（4月は30日まで）"]);
    assert.deepEqual(writtenIn("2月30日と9月31日と11月31日"), ["2月30日:day", "9月31日:day", "11月31日:day"]);
  });

  it("うるう年でない年の 2月29日を言い、うるう年なら言わない", () => {
    assert.deepEqual(writtenIn("2023年2月29日、2024年2月29日、1900年2月29日、2000年2月29日"), ["2023年2月29日:leap", "1900年2月29日:leap"]);
    assert.deepEqual(findingsOf("監査は 2023-02-29 に行います。\n", en), [
      '"2023-02-29" is not on the calendar (that year is not a leap year, so February has 28 days)',
    ]);
  });

  it("単位で書いた日付は、月が 1〜12 にない・日が 31 を超えるのも言う", () => {
    assert.deepEqual(writtenIn("13月1日と0月5日と5月32日"), ["13月1日:month", "0月5日:month", "5月32日:day"]);
  });

  it("英語の月の名前の日付（前と後ろ、略した名前）", () => {
    assert.deepEqual(findingsOf("Applications close on April 31.\n", en), ['"April 31" is not on the calendar (that month has 30 days)']);
    assert.deepEqual(writtenIn("on 31 September, Sept. 31 and Feb 30, 2024"), ["31 September:day", "Sept. 31:day", "Feb 30, 2024:day"]);
  });

  it("日時（T の後ろに時刻）の日付も読む", () => {
    assert.deepEqual(writtenIn("2023-02-29T10:00 と 2024-02-29T10:00"), ["2023-02-29:leap"]);
  });

  it("全角の数字も読む", () => {
    assert.deepEqual(writtenIn("２月３０日"), ["２月３０日:day"]);
  });

  it("暦にある日付は言わない", () => {
    assert.deepEqual(findingsOf("締切は 4月30日、発表は 2024年2月29日 です。\n"), []);
    assert.deepEqual(findingsOf("Applications close on April 30, 2026-10-31 at the latest.\n", en), []);
  });

  it("元号の年と年の無い日付では、2月29日をうるう年で決めない", () => {
    assert.deepEqual(writtenIn("令和5年2月29日と2月29日"), []);
  });

  it("数字だけの並びは、月が 12 を超えたり日が 31 を超えたりすれば番号として読まない", () => {
    assert.deepEqual(writtenIn("2026-13-45 と 2026/10/45 と 2026-02-31"), ["2026-02-31:day"]);
  });

  it("名前の月でも 31 を超える日は数として読まない。小文字の may は月ではない", () => {
    assert.deepEqual(writtenIn("In March 45 people came, and may 31 is fine."), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("例：`2023-02-29` は不正な値です。\n"), []);
  });

  it("空の文字列と語の無い言語", () => {
    assert.deepEqual(impossibleDates("", WORDS), []);
    assert.deepEqual(impossibleDates("2月30日 April 31", { months: [], units: [], eras: [] }), []);
  });
});

describe("impossible-date: 語彙表", () => {
  it("month-name の初めの十二は一月から順の月の名前", () => {
    const months = (loadJaLexicons()["month-name"] ?? []).map((entry) => entry.pattern).slice(0, 12);
    assert.equal(months[0], "January");
    assert.equal(months[11], "December");
  });
});
