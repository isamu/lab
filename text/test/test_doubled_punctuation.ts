import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { doubledMarks } from "../packages/chaff/src/detectors/doubled-punctuation.ts";

// 句読点の重なり（doubled-punctuation）。例文はすべて自作。

const RULE = "doubled-punctuation";

const findingsOf = (source: string, adapter = ja, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, adapter, path).findings;

const runsOf = (text: string): string[] => doubledMarks(text).map((found) => found.run);

describe("doubled-punctuation: 句読点が重なっている", () => {
  it("同じ句点を二つ", () => {
    assert.deepEqual(findingsOf("資料を送ります。。明日届きます。\n"), ["「。。」と句読点が重なっています"]);
  });

  it("英語の文書は英語で言う", () => {
    assert.deepEqual(findingsOf("Send it (i.e.,, today) please.\n", en), ['Punctuation is doubled: ".,,"']);
  });

  it("違う印の重なり（、。 ,. ,,）と、語の後ろの二つの点", () => {
    assert.deepEqual(runsOf("確認します、。次に進みます。a,, b,. c etc.. d"), ["、。", ",,", ",.", ".."]);
  });

  it("三つ以上の同じ印はわざと伸ばした書き方", () => {
    assert.deepEqual(runsOf("えーと。。。 Well... ，，，"), []);
  });

  it("略語の点の後ろの読点とセミコロン、次の語の頭の点", () => {
    assert.deepEqual(runsOf("e.g., etc.; Inc., すでに、.NET を入れ、.well-known に置く"), []);
  });

  it("範囲と道のり（1..10、a..b、../）", () => {
    assert.deepEqual(runsOf("1..10 a..b ../docs /..x"), []);
  });

  it("コロンと感嘆符は見ない", () => {
    assert.deepEqual(runsOf("std::vector ::1 すごい！！ Really?? Wow!!"), []);
  });

  it("コードの中は数えない", () => {
    assert.deepEqual(findingsOf("`a,,b` と `..` はコードです。\n"), []);
  });

  it("空の文書", () => {
    assert.deepEqual(runsOf(""), []);
  });
});
