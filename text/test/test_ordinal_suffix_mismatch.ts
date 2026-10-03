import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { ordinalSlips } from "../packages/chaff/src/detectors/ordinal-suffix.ts";
import type { Lexicon } from "../packages/chaff/src/plugin.ts";

// 数に合わない序数の字（ordinal-suffix-mismatch）。例文はすべて自作。

const RULE = "ordinal-suffix-mismatch";

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const SUFFIXES: Lexicon = [
  { pattern: "st", group: "1" },
  { pattern: "nd", group: "2" },
  { pattern: "rd", group: "3" },
  { pattern: "th", group: "11" },
  { pattern: "th", group: "12" },
  { pattern: "th", group: "13" },
  { pattern: "th", group: "" },
];

const slipsIn = (text: string): string[] => ordinalSlips(text, SUFFIXES).map((slip) => `${slip.written}>${slip.expected.join("/")}`);

describe("ordinal-suffix-mismatch: 数に合わない序数の字", () => {
  it("数の終わりに合わない字を言う", () => {
    assert.deepEqual(findingsOf("This is our 22th annual meeting.\n"), ['"22th" is written "22nd"']);
    assert.deepEqual(slipsIn("1th 2th 3th 11st 12nd 13rd 21th 113rd"), ["1th>st", "2th>nd", "3th>rd", "11st>th", "12nd>th", "13rd>th", "21th>st", "113rd>th"]);
    assert.deepEqual(slipsIn("the 1,001th and 1,011th customer"), ["1,001th>st"]);
  });

  it("日本語の文書の中の英語の序数も言う", () => {
    assert.deepEqual(findingsOf("今年で 3th イベントになります。\n", ja), ["「3th」は「3rd」と書きます"]);
  });

  it("合っている序数は言わない", () => {
    assert.deepEqual(slipsIn("1st 2nd 3rd 4th 11th 12th 13th 21st 22nd 23rd 100th 101st 111th"), []);
    assert.deepEqual(findingsOf("She finished 11th, and he was 2nd.\n"), []);
  });

  it("語や番号の一部と、法律の引用の 2d・3d は読まない", () => {
    assert.deepEqual(slipsIn("v1th 0x2nd 1-2th 3.5th F.2d 3d Cir. 1ST"), []);
  });

  it("コードの中は読まない", () => {
    assert.deepEqual(findingsOf("Set `rank = 3th` to fail the parser.\n"), []);
  });

  it("空の文字列と字の無い語彙表", () => {
    assert.deepEqual(ordinalSlips("", SUFFIXES), []);
    assert.deepEqual(ordinalSlips("3th", []), []);
  });
});
