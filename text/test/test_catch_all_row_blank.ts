import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCatchAllLabel, isCatchAllRowGap } from "../packages/chaff/src/structure/catch-all-row-blank.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// The catch-all row of an if-then table leaves its conditions blank: they do not apply to it. Every example is self-written.

const WORDS = ["none of the above", "otherwise", "上記以外"];

describe("isCatchAllLabel", () => {
  it("is true for a label opening with a catch-all word, in any case and with emphasis", () => {
    ["none of the above conditions apply", "None of the above", "**Otherwise**", "otherwise,", "上記以外の場合"].forEach((label) =>
      assert.equal(isCatchAllLabel(label, WORDS), true, label),
    );
  });

  it("is false for a word that runs on, a catch-all word later in the label, a blank cell or no words", () => {
    ["otherwiser", "if none of the above", "", "a tribe requests an increase"].forEach((label) => assert.equal(isCatchAllLabel(label, WORDS), false, label));
    assert.equal(isCatchAllLabel(undefined, WORDS), false);
    assert.equal(isCatchAllLabel("otherwise", []), false);
    assert.equal(isCatchAllLabel("otherwise", [""]), false);
  });
});

describe("isCatchAllRowGap", () => {
  const row = ["none of the above apply", undefined, "10 percent"];

  it("a catch-all row's blank condition before its filled outcome is not a gap", () => {
    assert.equal(isCatchAllRowGap(row, 1, WORDS), true);
    assert.equal(isCatchAllRowGap(["上記以外", undefined, undefined, "1割"], 2, WORDS), true);
  });

  it("a blank outcome, a filled cell, or a row that is not a catch-all is still a gap", () => {
    assert.equal(isCatchAllRowGap(["none of the above apply", "they ask", undefined], 2, WORDS), false);
    assert.equal(isCatchAllRowGap(row, 2, WORDS), false);
    assert.equal(isCatchAllRowGap(row, 0, WORDS), false);
    assert.equal(isCatchAllRowGap(["a tribe asks", undefined, "the rate asked"], 1, WORDS), false);
    assert.equal(isCatchAllRowGap([], 0, WORDS), false);
  });
});

const blanks = (source: string, adapter: LanguageAdapter): number =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.filter(
    (finding) => finding.rule === "empty-table-cell",
  ).length;

describe("empty-table-cell and the catch-all row of an if-then table", () => {
  const table = (last: string): string =>
    [
      "| If | and | then the fee is |",
      "| --- | --- | --- |",
      "| a member asks for a discount | the board agrees | the discount asked |",
      "| a member asks for a waiver | the board agrees | waived |",
      "| a member pays late | the notice was sent | doubled |",
      last,
      "",
    ].join("\n");

  it("English: the none-of-the-above row's blank second condition is not reported", () => {
    assert.equal(blanks(table("| none of the above apply | | the standard fee |"), en), 0);
    assert.equal(blanks(table("| Otherwise | | the standard fee |"), en), 0);
  });

  it("English: the same blank in a row that is not a catch-all, or a catch-all's blank outcome, is reported", () => {
    assert.equal(blanks(table("| a member moves away | | refunded |"), en), 1);
    assert.equal(blanks(table("| none of the above apply | they ask |  |"), en), 1);
  });

  it("日本語: 「上記以外」の行の条件の空欄は指さない。ほかの行の空欄は指す", () => {
    const source = (last: string): string =>
      [
        "| 場合 | 条件 | 手数料 |",
        "| --- | --- | --- |",
        "| 会員が減額を求めた | 理事会が認めた | 求めた額 |",
        "| 会員が免除を求めた | 理事会が認めた | なし |",
        "| 支払いが遅れた | 通知を送った | 2倍 |",
        last,
        "",
      ].join("\n");
    assert.equal(blanks(source("| 上記以外の場合 | | 通常の額 |"), ja), 0);
    assert.equal(blanks(source("| 会員が転居した | | 返金 |"), ja), 1);
  });
});
