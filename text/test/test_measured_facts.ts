import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { precisionTolerance, writtenHalfStep } from "../packages/chaff/src/facts/written-precision.ts";

// 測った量（重さ、長さ）の同じ項目の二つの値。同じ単位なら fact-conflict、違う単位なら換算して unit-mismatch。

const RULES = { "fact-conflict": "normal", "unit-mismatch": "normal" } as const;

const found = (lines: readonly string[], adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", ["# T", "", ...lines].join("\n"), adapter), loadRules(language), RULES, false, "technical/spec")
    .findings.filter((finding) => finding.rule === "fact-conflict" || finding.rule === "unit-mismatch")
    .map((finding) => `${finding.rule} ${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const foundJa = (...lines: string[]): string[] => found(lines, ja, "ja");
const foundEn = (...lines: string[]): string[] => found(lines, en, "en");

const specJa = (...prose: string[]): string[] => foundJa("| 項目 | 仕様 |", "| --- | --- |", "| 幅 | 120 mm |", "| 重さ | 410 g |", "", ...prose);
const specEn = (...prose: string[]): string[] => foundEn("| Item | Specification |", "| --- | --- |", "| Width | 120 mm |", "| Weight | 410 g |", "", ...prose);

const KG = 1000;

describe("writtenHalfStep: half of the last written decimal, in the base unit", () => {
  it("a decimal gives half of its last digit", () => {
    assert.ok(Math.abs(writtenHalfStep("1.2 kg", [KG]) - 50) < 1e-6);
    assert.ok(Math.abs(writtenHalfStep("1.25 kg", [KG]) - 5) < 1e-6);
    assert.ok(Math.abs(writtenHalfStep("１．２ｋｇ", [KG]) - 50) < 1e-6);
    assert.ok(Math.abs(writtenHalfStep("大さじ1.5", [15]) - 0.75) < 1e-6);
  });

  it("a whole number, an empty text or no factor gives nothing", () => {
    assert.equal(writtenHalfStep("410 g", [1]), 0);
    assert.equal(writtenHalfStep("1,200 g", [1]), 0);
    assert.equal(writtenHalfStep("", [1]), 0);
    assert.equal(writtenHalfStep("1.2 kg", []), 0);
    assert.equal(writtenHalfStep("1. kg", [KG]), 0);
  });

  it("the widest factor counts (a unit read two ways)", () => {
    assert.ok(Math.abs(writtenHalfStep("1.5 GB", [1e9, 2 ** 30]) - 0.05 * 2 ** 30) < 1);
  });

  it("precisionTolerance keeps the wider of the kind's tolerance and the half steps", () => {
    assert.deepEqual(precisionTolerance({ relative: 0.02, absolute: 0 }, [50, 0]), { relative: 0.02, absolute: 50 });
    assert.deepEqual(precisionTolerance({ relative: 0, absolute: 8 }, [1]), { relative: 0, absolute: 8 });
    assert.deepEqual(precisionTolerance({ relative: 0.02, absolute: 0 }, []), { relative: 0.02, absolute: 0 });
  });
});

describe("fact-conflict: a measured value in a table row against the prose, in the same unit", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a different value is reported, the same value is not (ja)", () => {
    assert.deepEqual(specJa("重さ：450 g"), ["fact-conflict 重さ:450 g≠410 g"]);
    assert.deepEqual(specJa("重さ：410 g"), []);
    assert.deepEqual(specJa("幅：125 mm"), ["fact-conflict 幅:125 mm≠120 mm"]);
  });

  it("a different value is reported, the same value is not (en)", () => {
    assert.deepEqual(specEn("Weight: 450 g"), ["fact-conflict Weight:450 g≠410 g"]);
    assert.deepEqual(specEn("The weight is 450 g."), ["fact-conflict The weight:450 g≠410 g"]);
    assert.deepEqual(specEn("Weight: 410 g"), []);
  });

  it("an approximate value (約, about) is not read as the item's value", () => {
    assert.deepEqual(specJa("重さ：約450 g"), []);
    assert.deepEqual(specEn("Weight: about 450 g"), []);
  });

  it("a range is not one value", () => {
    assert.deepEqual(specJa("重さ：400〜450 g"), []);
    assert.deepEqual(specEn("Weight: 400-450 g"), []);
  });

  it("different items with similar labels are different items", () => {
    assert.deepEqual(foundJa("本体重量：410 g", "", "総重量：650 g"), []);
    assert.deepEqual(foundEn("Net weight: 410 g", "", "Gross weight: 650 g"), []);
    assert.deepEqual(specJa("総重量：650 g"), []);
  });

  it("a value inside a fenced code block is not the item's value", () => {
    assert.deepEqual(foundEn("Weight: 410 g", "", "```", "Weight: 450 g", "```"), []);
    assert.deepEqual(foundEn("Weight: 410 g", "", "```", "Weight: 0.5 kg", "```"), []);
    assert.deepEqual(foundEn("Weight: 410 g", "", "Weight: 450 g"), ["fact-conflict Weight:450 g≠410 g"]);
  });

  it("two models in one document: one column or one section each", () => {
    const columns = foundJa("| 項目 | S3 | S5 |", "| --- | --- | --- |", "| 重さ | 410 g | 620 g |");
    assert.deepEqual(columns, []);
    const sections = foundEn("## S3", "", "Weight: 410 g", "", "## S5", "", "Weight: 620 g");
    assert.deepEqual(sections, []);
  });
});

describe("unit-mismatch: the written precision of a decimal", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("1.2 kg is 1.15 to 1.25 kg, both ends included", () => {
    assert.deepEqual(foundEn("Weight: 1.2 kg", "", "Weight: 1,250 g"), []);
    assert.deepEqual(foundEn("Weight: 1.2 kg", "", "Weight: 1,150 g"), []);
    assert.deepEqual(foundEn("Weight: 1.2 kg", "", "Weight: 1,300 g"), ["unit-mismatch Weight:1,300 g≠1.2 kg"]);
    assert.deepEqual(foundEn("Weight: 1.2 kg", "", "Weight: 1,140 g"), ["unit-mismatch Weight:1,140 g≠1.2 kg"]);
  });

  it("the coarser value sets the width, whichever comes first (ja)", () => {
    assert.deepEqual(foundJa("重さ：1,250 g", "", "重さ：1.2 kg"), []);
    assert.deepEqual(foundJa("重さ：1.25 kg", "", "重さ：1,300 g"), ["unit-mismatch 重さ:1,300 g≠1.25 kg"]);
  });

  it("a whole number keeps the 2% of its kind", () => {
    assert.deepEqual(foundEn("Weight: 1 kg", "", "Weight: 1,040 g"), ["unit-mismatch Weight:1,040 g≠1 kg"]);
    assert.deepEqual(foundEn("Weight: 1 kg", "", "Weight: 1,010 g"), []);
  });

  it("a table row in g against prose in kg", () => {
    assert.deepEqual(specJa("重さ：0.4 kg"), []);
    assert.deepEqual(specJa("重さ：0.5 kg"), ["unit-mismatch 重さ:0.5 kg≠410 g"]);
  });
});
