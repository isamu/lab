import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { marginOf, statedTotal, stepItems, stepLists, stepTime, type StepTimeWords } from "../packages/chaff/src/structure/step-times.ts";

// 所要時間が、手順に書いた時間の和と合わない（step-time-sum-mismatch）。

const RULE = "step-time-sum-mismatch";

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["written"])}!=${String(finding.values["sum"])}@${String(finding.line)}`);

const slipsJa = (source: string): string[] => findings(source, ja, "ja");
const slipsEn = (source: string): string[] => findings(source, en, "en");

const recipe = (total: string, ...steps: string[]): string =>
  ["# Recipe", "", `- ${total}`, "", ...steps.map((step, index) => `${String(index + 1)}. ${step}`)].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("step-time-sum-mismatch: a total that is not the sum", () => {
  it("ja: 所要時間 60分 against steps that add up to 80", () => {
    const source = recipe(
      "所要時間：60分",
      "玉ねぎをみじん切りにします（10分）。",
      "180℃に予熱したオーブンで焼きます（40分）。",
      "型に入れたまま置いて肉汁を落ち着かせます（10分）。",
      "ソースを煮立てます（20分）。",
    );
    assert.deepEqual(slipsJa(source), ["60分!=80@3"]);
  });

  it("en: Total time in hours and minutes, against steps written in the sentence", () => {
    const source = recipe(
      "Total time: 1 hr 10 min",
      "Chop the onion (10 minutes).",
      "Bake for 40 minutes.",
      "Let it rest for 10 minutes.",
      "Boil the glaze for 5 minutes.",
    );
    assert.deepEqual(slipsEn(source), ["1 hr 10 min!=65@3"]);
  });

  it("ja: an 約 total is reported when the sum is beyond the margin", () => {
    const source = recipe("所要時間：約30分", "下ごしらえをします（10分）。", "煮込みます（30分）。");
    assert.deepEqual(slipsJa(source), ["30分!=40@3"]);
  });

  it("en: a time that is not the step's own is passed over", () => {
    const source = recipe("Total time: 30 minutes", "Bake for 40 minutes; after 20 minutes, turn the tray.", "Rest for 10 minutes.");
    assert.deepEqual(slipsEn(source), ["30 minutes!=50@3"]);
  });
});

describe("step-time-sum-mismatch: what it does not report", () => {
  it("ja: a total that is the sum", () => {
    const source = recipe("所要時間：1時間20分", "玉ねぎを切ります（10分）。", "焼きます（60分）。", "休ませます（10分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("ja: an 約 total within a tenth (at least 5 minutes) agrees", () => {
    const source = recipe("所要時間：約60分", "切ります（10分）。", "焼きます（45分）。", "盛り付けます（10分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("en: a step time marked as rough lets the total agree within the margin", () => {
    const source = recipe("Total time: 60 minutes", "Chop (about 10 minutes).", "Bake for 45 minutes.", "Serve (10 minutes).");
    assert.deepEqual(slipsEn(source), []);
  });

  it("ja: a step without a time stops the rule", () => {
    const source = recipe("所要時間：60分", "玉ねぎを切ります（10分）。", "器に盛ります。", "焼きます（40分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("ja: a step with two times stops the rule", () => {
    const source = recipe("所要時間：30分", "10分煮て、20分蒸らします。", "盛り付けます（5分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("en: a range stops the rule", () => {
    const source = recipe("Total time: 30 minutes", "Simmer for 10 to 15 minutes.", "Rest (5 minutes).");
    assert.deepEqual(slipsEn(source), []);
  });

  it("ja: a range with 〜 stops the rule", () => {
    const source = recipe("所要時間：30分", "10〜15分煮ます。", "休ませます（5分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("ja: a temperature is not a time, and a moment (10分後) is not the step's own", () => {
    const source = recipe("所要時間：50分", "180℃に予熱したオーブンで焼きます（40分）。", "焼き始めて10分後に向きを変え、そのまま置きます（10分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("en: two different totals are not compared", () => {
    const source = ["# R", "", "- Total time: 30 minutes", "- Total: 45 minutes", "", "1. Chop (10 minutes).", "2. Cook (40 minutes)."].join("\n");
    assert.deepEqual(slipsEn(source), []);
  });

  it("en: no total label, no comparison (Prep time is a part)", () => {
    const source = recipe("Prep time: 10 minutes", "Chop (10 minutes).", "Cook (40 minutes).");
    assert.deepEqual(slipsEn(source), []);
  });

  it("ja: one step is no procedure to add up", () => {
    const source = recipe("所要時間：60分", "焼きます（40分）。");
    assert.deepEqual(slipsJa(source), []);
  });

  it("en: a total written as a range is no exact total", () => {
    const steps = ["", "1. Chop (10 minutes).", "2. Cook (40 minutes)."];
    assert.deepEqual(slipsEn(["# R", "", "- Total time: 10 minutes to 15 minutes", ...steps].join("\n")), []);
    assert.deepEqual(slipsEn(["# R", "", "- Total time: one to two hours", ...steps].join("\n")), []);
  });

  it("en: two numbered lists may be two procedures, and are not added up", () => {
    const source = [
      "# R",
      "",
      "- Total time: 30 minutes",
      "",
      "1. Chop (10 minutes).",
      "2. Cook (40 minutes).",
      "",
      "## Sauce",
      "",
      "1. Boil (5 minutes).",
      "2. Thicken (5 minutes).",
    ].join("\n");
    assert.deepEqual(slipsEn(source), []);
  });

  it("en: a loose list with blank lines between its items is one list", () => {
    const source = ["# R", "", "- Total time: 30 minutes", "", "1. Chop (10 minutes).", "", "2. Cook (40 minutes)."].join("\n");
    assert.deepEqual(slipsEn(source), ["30 minutes!=50@3"]);
  });
});

const WORDS: StepTimeWords = {
  lengths: { hourUnits: ["時間", "hours", "hour", "hr"], minuteUnits: ["分", "minutes", "minute", "min"], halves: ["半"], numberWords: ["one", "two"] },
  totals: [{ pattern: "所要時間" }, { pattern: "total time" }],
  approximate: [
    { pattern: "約", position: "before" },
    { pattern: "about", position: "before" },
    { pattern: "程度", position: "after" },
  ],
  notOwn: [
    { pattern: "後", position: "after" },
    { pattern: "after", position: "before" },
  ],
  rangeJoiners: ["〜", "to"],
};

describe("step-time-sum-mismatch: the pure parts", () => {
  it("stepItems reads numbered lines and the indented lines under them", () => {
    const source = "intro\n1. one\n   more\n2) two\n\n- bullet\n10. ten";
    assert.deepEqual(
      stepItems(source).map((item) => source.slice(item.start, item.end)),
      ["1. one\n   more", "2) two", "10. ten"],
    );
    assert.deepEqual(stepItems(""), []);
  });

  it("stepLists splits at a line that is neither an item, indented, nor blank, and keeps CRLF continuations", () => {
    const source = "1. one\r\n   more\r\n\r\n2. two\r\ntext\r\n1. again";
    assert.deepEqual(
      stepLists(source).map((list) => list.map((item) => source.slice(item.start, item.end))),
      [["1. one\r\n   more", "2. two"], ["1. again"]],
    );
    assert.deepEqual(stepLists("1.5 hours is long\n2.5 too"), []);
    assert.deepEqual(stepLists("1．全角\n2）括弧").length, 1);
  });

  it("stepTime reads one own length, and nothing from none, two, or a range", () => {
    assert.equal(stepTime("焼きます（40分）。", WORDS)?.minutes, 40);
    assert.equal(stepTime("bake for 1 hour", WORDS)?.minutes, 60);
    assert.equal(stepTime("約20分煮ます", WORDS)?.approximate, true);
    assert.equal(stepTime("20分程度煮ます", WORDS)?.approximate, true);
    assert.equal(stepTime("10分後に返し、20分焼きます", WORDS)?.minutes, 20);
    assert.equal(stepTime("after 10 minutes, bake 30 minutes", WORDS)?.minutes, 30);
    assert.equal(stepTime("盛り付けます", WORDS), undefined);
    assert.equal(stepTime("10分煮て20分蒸らす", WORDS), undefined);
    assert.equal(stepTime("10〜15分煮ます", WORDS), undefined);
    assert.equal(stepTime("10 to 15 minutes", WORDS), undefined);
    assert.equal(stepTime("", WORDS), undefined);
  });

  it("statedTotal reads the length right after a total label, outside the steps", () => {
    const source = "所要時間：約1時間半\n\n1. 所要時間：5分";
    const total = statedTotal(source, stepItems(source), WORDS);
    assert.equal(total?.minutes, 90);
    assert.equal(total?.approximate, true);
    assert.equal(statedTotal("Total time: 40 minutes", [], WORDS)?.minutes, 40);
    assert.equal(statedTotal("Cook time: 40 minutes", [], WORDS), undefined);
    assert.equal(statedTotal("所要時間：60分\n所要時間：70分", [], WORDS), undefined);
    assert.equal(statedTotal("所要時間：60分\n所要時間：60分", [], WORDS)?.minutes, 60);
  });

  it("marginOf allows a tenth of a rough total, at least 5 minutes, and nothing for an exact one", () => {
    assert.equal(marginOf(120, true), 12);
    assert.equal(marginOf(30, true), 5);
    assert.equal(marginOf(120, false), 0);
  });
});
