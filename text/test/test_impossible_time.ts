import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { impossibleTimes, type ClockWords } from "../packages/chaff/src/detectors/impossible-time.ts";

// 時計に無い時刻（impossible-time）。例文はすべて自作。

const RULE = "impossible-time";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const WORDS: ClockWords = { before: ["午前", "午後"], after: ["AM", "PM", "am", "pm", "a.m.", "p.m."], units: ["時", "分", "秒"] };

const writtenIn = (text: string): string[] => impossibleTimes(text, WORDS).map((found) => `${found.written}:${found.reason}`);

describe("impossible-time: 時計に無い時刻", () => {
  it("午前・午後の付いた 12 を超える時", () => {
    assert.deepEqual(findingsOf("説明会は午後13時から始めます。\n"), ["「午後13時」は時計にありません（午前・午後を付けた時は12まで）"]);
    assert.deepEqual(findingsOf("The briefing starts at 13 PM.\n", en), ['"13 PM" is not a time (with AM or PM, the hour runs to 12)']);
    assert.deepEqual(writtenIn("14:30 p.m. と 13pm と 午前15:00"), ["14:30 p.m.:hour", "13pm:hour", "午前15:00:hour"]);
  });

  it("59 を超える分と秒", () => {
    assert.deepEqual(writtenIn("9時75分、10時5分70秒、午後3:75、12:30:75"), ["9時75分:minute", "10時5分70秒:minute", "午後3:75:minute", "12:30:75:minute"]);
    assert.deepEqual(findingsOf("Doors close at 10:75 sharp.\n", en), ['"10:75" is not a time (minutes and seconds run to 59)']);
  });

  it("時計にある時刻は言わない", () => {
    assert.deepEqual(writtenIn("午前0時、午後12時、10:30 PM、3 p.m.、23:59:59、9時45分"), []);
    assert.deepEqual(findingsOf("会議は午後1時から 13:00 までです。\n"), []);
  });

  it("午前・午後の無い 24 を超える時は、深夜の数え方として言わない", () => {
    assert.deepEqual(writtenIn("放送は25:00から、深夜26時まで"), []);
  });

  it("章と節、巻と頁、縮尺、量の pm は時刻と読まない", () => {
    assert.deepEqual(writtenIn("Genesis 24:67, Science, 12:75, a 1:75 scale model, a 50 pm bond"), []);
  });

  it("全角の数字とコロンも読む", () => {
    assert.deepEqual(writtenIn("１３ PM と 10：75 と １０:７５"), ["１３ PM:hour", "10：75:minute", "１０:７５:minute"]);
  });

  it("英字の語や番号の中の数は時刻と読まない", () => {
    assert.deepEqual(writtenIn("abc10:75bar v10:75 10:75bar id13PM"), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("例：`10:75` は不正な値です。\n"), []);
  });

  it("空の文字列と語の無い言語", () => {
    assert.deepEqual(impossibleTimes("", WORDS), []);
    assert.deepEqual(impossibleTimes("13 PM と 午後13時", { before: [], after: [], units: [] }), []);
  });
});
