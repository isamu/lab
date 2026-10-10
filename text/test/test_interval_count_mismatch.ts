import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { paragraphsOf } from "../packages/chaff/src/derived/period-counts.ts";
import { intervalCountMismatches, type IntervalWords } from "../packages/chaff/src/derived/use-interval.ts";
import type { TimeLength } from "../packages/chaff/src/derived/time-lengths.ts";

// 使う間隔の下限と回数の上限が両立しない、または表の回数と合わない（interval-count-mismatch）。

const RULE = "interval-count-mismatch";

const run = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) =>
      finding.variant === "table"
        ? `${String(finding.values["count"])} table ${String(finding.values["table"])}`
        : `${String(finding.values["count"])} needs ${String(finding.values["needed"])}`,
    );

const checkJa = (...lines: string[]): string[] => run(["# 用法", "", ...lines, ""].join("\n"), ja, "ja");
const checkEn = (...lines: string[]): string[] => run(["# Directions", "", ...lines, ""].join("\n"), en, "en");

const TABLE_JA = ["| 年齢 | 1回量 | 1日の服用回数 |", "| --- | --- | --- |", "| 15歳以上 | 2錠 | 3回 |", "| 7歳未満 | 服用しないでください | - |", ""];
const TABLE_EN = ["| Age | Dose | Times a day |", "| --- | --- | --- |", "| 15 and over | 2 tablets | 3 |", "| Under 7 | do not take | - |", ""];

describe("interval-count-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a count that does not fit the period at the minimum interval (ja)", () => {
    assert.deepEqual(checkJa("与える間隔は8時間以上あけ、1日4回を超えて与えないでください。"), ["1日4回 needs 24"]);
    assert.deepEqual(checkJa("服用の間隔は4時間以上あけ、1日7回までとしてください。"), ["1日7回 needs 24"]);
    assert.deepEqual(checkJa("使用間隔は30分以上あけてください。1日50回を限度とします。"), ["1日50回 needs 24.5"]);
  });

  it("a count that does not fit the period at the minimum interval (en)", () => {
    assert.deepEqual(checkEn("Leave at least 8 hours between feedings, and do not give more than 4 feedings a day."), ["4 feedings a day needs 24"]);
    assert.deepEqual(checkEn("Doses must be at least 4 hours apart. Take no more than 7 doses in 24 hours."), ["7 doses in 24 hours needs 24"]);
  });

  it("a count that fits stays silent", () => {
    assert.deepEqual(checkJa("服用の間隔は4時間以上あけ、1日6回を超えて服用しないでください。"), []);
    assert.deepEqual(checkJa("与える間隔は8時間以上あけ、1日2回を超えて与えないでください。"), []);
    assert.deepEqual(checkEn("Leave at least 4 hours between doses, and do not take more than 6 doses a day."), []);
    assert.deepEqual(checkEn("Leave at least 8 hours between feedings, and give no more than twice a day."), []);
  });

  it("a limit that differs from the table's times a day under the same heading", () => {
    assert.deepEqual(checkJa(...TABLE_JA, "服用の間隔は4時間以上あけ、1日6回を超えて服用しないでください。"), ["1日6回 table 3"]);
    assert.deepEqual(checkJa(...TABLE_JA, "服用の間隔は4時間以上あけ、1日2回を超えて服用しないでください。"), ["1日2回 table 3"]);
    assert.deepEqual(checkEn(...TABLE_EN, "Leave at least 4 hours between doses, and do not take more than 6 doses a day."), ["6 doses a day table 3"]);
    assert.deepEqual(checkJa(...TABLE_JA, "服用の間隔は4時間以上あけ、1日3回を超えて服用しないでください。"), []);
    assert.deepEqual(checkEn(...TABLE_EN, "Leave at least 4 hours between doses, and do not take more than 3 doses a day."), []);
  });

  it("a table under another heading is not compared", () => {
    assert.deepEqual(checkJa(...TABLE_JA, "## 注意", "", "服用の間隔は4時間以上あけ、1日6回を超えて服用しないでください。"), []);
    assert.deepEqual(checkEn(...TABLE_EN, "  ## Warnings", "", "Leave at least 4 hours between doses, and do not take more than 6 doses a day."), []);
  });

  it("a count cell is read only when it holds a count alone, in figures or words", () => {
    const noted = ["| Age | Times a day |", "| --- | --- |", "| Adult | 3 times (keep at least 4 hours apart) |", ""];
    assert.deepEqual(checkEn(...noted, "Leave at least 4 hours between doses, and do not take more than 6 doses a day."), []);
    const worded = ["| Age | Times a day |", "| --- | --- |", "| Adult | three |", ""];
    assert.deepEqual(checkEn(...worded, "Leave at least 4 hours between doses, and do not take more than 6 doses a day."), ["6 doses a day table 3"]);
  });

  it("no minimum, no interval word, no limit, or two of either stays silent", () => {
    assert.deepEqual(checkJa("服用の間隔は8時間あけ、1日4回を超えて服用しないでください。"), []);
    assert.deepEqual(checkJa("作業は8時間以上かかるので、1日4回までにしてください。"), []);
    assert.deepEqual(checkJa("服用の間隔は8時間以上あけ、1日4回服用してください。"), []);
    assert.deepEqual(checkJa("間隔は8時間以上あけ、1日4回まで、子どもは1日2回までです。"), []);
    assert.deepEqual(checkEn("Leave 8 hours between doses, and do not take more than 4 doses a day."), []);
    assert.deepEqual(checkEn("The session lasts at least 8 hours, and no more than 4 doses a day are given."), []);
  });
});

const WORDS: IntervalWords = {
  periods: [{ pattern: "1日", position: "before", hours: 24 }],
  counters: ["回"],
  numberWords: [],
  minimum: [{ pattern: "以上", position: "after" }],
  cues: ["間隔"],
  limits: [{ pattern: "まで", position: "after" }],
  negations: [],
  columns: [{ pattern: "1日の回数", hours: 24 }],
};

const lengthAt = (text: string, written: string, minutes: number): TimeLength => {
  const start = text.indexOf(written);
  return { start, end: start + written.length, minutes, unit: 1 };
};

describe("interval and count, pure", () => {
  it("(n - 1) × interval reaching the period is reported, below it is not", () => {
    const at = (count: number, hours: number): number => {
      const text = `間隔は${hours}時間以上、1日${count}回まで。`;
      return intervalCountMismatches(text, paragraphsOf(text), [lengthAt(text, `${hours}時間`, hours * 60)], WORDS).length;
    };
    assert.equal(at(4, 8), 1);
    assert.equal(at(3, 8), 0);
    assert.equal(at(7, 4), 1);
    assert.equal(at(6, 4), 0);
    assert.equal(at(1, 48), 0);
    assert.equal(at(2, 24), 1);
  });

  it("reads the largest count of the table column, and nothing without a table", () => {
    const text = ["| 年齢 | 1日の回数 |", "| --- | --- |", "| 大人 | 2〜3回 |", "| 子ども | 1回 |", "", "間隔は4時間以上、1日5回まで。"].join("\n");
    const found = intervalCountMismatches(text, paragraphsOf(text), [lengthAt(text, "4時間", 240)], WORDS);
    assert.deepEqual(
      found.map((item) => (item.kind === "table" ? item.tableCount : -1)),
      [3],
    );
    assert.deepEqual(intervalCountMismatches("", [], [], WORDS), []);
  });
});
