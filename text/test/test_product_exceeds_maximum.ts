import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { periodCounts, paragraphsOf, type PeriodCountWords } from "../packages/chaff/src/derived/period-counts.ts";
import { exceededMaxima, type UseMaximumWords } from "../packages/chaff/src/derived/use-maximum.ts";

// 1回の量 × 期間あたりの回数が、同じ期間の上限を超える（product-exceeds-maximum）。

const RULE = "product-exceeds-maximum";

const run = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["maximum"])}<${String(finding.values["expected"])}`);

const checkJa = (...lines: string[]): string[] => run(["# 用法", "", ...lines, ""].join("\n"), ja, "ja");
const checkEn = (...lines: string[]): string[] => run(["# Directions", "", ...lines, ""].join("\n"), en, "en");

describe("product-exceeds-maximum", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("an amount per use times the uses a day over the daily maximum (ja)", () => {
    assert.deepEqual(checkJa("1回2錠を1日3回まで服用できます。1日の最大量は4錠です。"), ["4錠<6"]);
    assert.deepEqual(checkJa("1回2粒を1日2回まで与えられます。1日の最大量は3粒です。"), ["3粒<4"]);
    assert.deepEqual(checkJa("1回500円、1日10回まで利用できます。1日の上限は3,000円です。"), []);
    assert.deepEqual(checkJa("- 1回量：2錠", "- 1日3回", "- 1日最大4錠まで"), ["4錠<6"]);
  });

  it("an amount per use times the uses a day over the daily maximum (en)", () => {
    assert.deepEqual(checkEn("Take 2 tablets at a time, up to 3 times a day. The maximum daily dose is 4 tablets."), ["4 tablets<6"]);
    assert.deepEqual(checkEn("Take 2 tablets, 3 times a day. Do not take more than 4 tablets in 24 hours."), ["4 tablets<6"]);
    assert.deepEqual(checkEn("Give 2 chews at a time, twice a day, and no more than 3 chews a day."), ["3 chews<4"]);
    assert.deepEqual(checkEn("Take 2 tablets, up to 3 times a day. No more than 4 tablets in 24 hours."), ["4 tablets<6"]);
  });

  it("a product within the maximum stays silent", () => {
    assert.deepEqual(checkJa("1回2錠を1日3回まで服用できます。1日の最大量は6錠です。"), []);
    assert.deepEqual(checkJa("1回500円、1日6回まで利用できます。1日の上限は3,000円です。"), []);
    assert.deepEqual(checkEn("Take 2 tablets at a time, up to 3 times a day. The maximum daily dose is 6 tablets."), []);
    assert.deepEqual(checkEn("Take 1 tablet, 3 times a day. Do not take more than 4 tablets in 24 hours."), []);
    assert.deepEqual(checkEn("Take 2 tablets at a time, 3 times a day. You may need more than 4 tablets a day during flare-ups."), []);
  });

  it("different units, different periods, ranges and unlabelled amounts stay silent", () => {
    assert.deepEqual(checkJa("1回2錠を1日3回服用します。1日の最大量は400mgです。"), []);
    assert.deepEqual(checkJa("1回2錠を1日3回服用します。1週間の最大量は4錠です。"), []);
    assert.deepEqual(checkJa("1回1〜2錠を1日3回服用します。1日の最大量は4錠です。"), []);
    assert.deepEqual(checkJa("2錠を服用します。1日3回まで。1日の最大量は4錠です。"), []);
    assert.deepEqual(checkEn("Take 2 tablets at a time, up to 3 times a day. The maximum weekly dose is 4 tablets."), []);
    assert.deepEqual(checkEn("Take 1-2 tablets at a time, up to 3 times a day. The maximum daily dose is 4 tablets."), []);
  });

  it("each of the three must be written once in the paragraph, and in the same paragraph", () => {
    assert.deepEqual(checkJa("1回2錠を1日3回まで服用できます。", "", "1日の最大量は4錠です。"), []);
    assert.deepEqual(checkJa("大人は1回2錠、子どもは1回1錠を1日3回まで服用できます。1日の最大量は4錠です。"), []);
    assert.deepEqual(checkEn("Adults take 2 tablets at a time and children 1 tablet at a time, 3 times a day. The maximum daily dose is 4 tablets."), []);
  });

  it("a table is not read", () => {
    assert.deepEqual(checkJa("| 1回量 | 1日の回数 | 1日の最大量 |", "| --- | --- | --- |", "| 1回2錠 | 1日3回 | 最大4錠 |"), []);
  });
});

const WORDS: PeriodCountWords = {
  periods: [
    { pattern: "1日", position: "before", hours: 24 },
    { pattern: "a day", position: "after", hours: 24 },
    { pattern: "in 24 hours", position: "after", hours: 24 },
  ],
  counters: ["回", "times", "doses"],
  numberWords: [
    { pattern: "three", value: 3, alone: false },
    { pattern: "twice", value: 2, alone: true },
  ],
};

const USE_WORDS: UseMaximumWords = {
  ...WORDS,
  perUse: [
    { pattern: "1回", position: "before" },
    { pattern: "at a time", position: "after" },
  ],
  limits: [
    { pattern: "最大", position: "before" },
    { pattern: "maximum", position: "before" },
    { pattern: "まで", position: "after" },
  ],
  negations: [],
};

describe("period counts and maxima, pure", () => {
  it("reads counts with the period before or after", () => {
    const counts = (text: string): string[] => periodCounts(text, WORDS).map((count) => `${text.slice(count.start, count.end)}=${count.amount}/${count.hours}`);
    assert.deepEqual(counts("1日3回"), ["1日3回=3/24"]);
    assert.deepEqual(counts("１日に３回"), ["１日に３回=3/24"]);
    assert.deepEqual(counts("3 times a day, twice a day, three doses in 24 hours"), ["3 times a day=3/24", "twice a day=2/24", "three doses in 24 hours=3/24"]);
    assert.deepEqual(counts("11日3回"), []);
    assert.deepEqual(counts("3 times aday"), []);
    assert.deepEqual(counts(""), []);
  });

  it("splits paragraphs at blank lines and table rows", () => {
    const text = "a\nb\n\nc\n| x |\nd";
    assert.deepEqual(
      paragraphsOf(text).map((span) => text.slice(span.start, span.end)),
      ["a\nb", "c", "d"],
    );
    assert.deepEqual(paragraphsOf(""), []);
  });

  it("compares in each paragraph", () => {
    const text = "1回2錠を1日3回。1日最大4錠。\n\n1回1錠を1日3回。1日最大4錠。";
    const found = exceededMaxima(text, paragraphsOf(text), USE_WORDS);
    assert.deepEqual(
      found.map((item) => [text.slice(item.maximum.start, item.maximum.end), item.expected]),
      [["4錠", 6]],
    );
    assert.deepEqual(exceededMaxima("", [], USE_WORDS), []);
    assert.deepEqual(exceededMaxima(text, paragraphsOf(text), { ...USE_WORDS, limits: [] }), []);
  });
});
