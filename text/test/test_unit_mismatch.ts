import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 同じ項目の量を違う単位で書いて、換算すると合わない（unit-mismatch）。

const found = (lines: readonly string[], adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", ["# T", "", ...lines].join("\n"), adapter), loadRules(language), { "unit-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "unit-mismatch")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const foundJa = (...lines: string[]): string[] => found(lines, ja, "ja");
const foundEn = (...lines: string[]): string[] => found(lines, en, "en");

describe("unit-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a length in km and in m that do not convert (ja)", () => {
    assert.deepEqual(foundJa("距離：5 km", "", "- 集合：駅前", "- 距離：3000 m"), ["距離:3000 m≠5 km"]);
    assert.deepEqual(foundJa("距離：5 km", "", "- 集合：駅前", "- 距離：5000 m"), []);
  });

  it("a time in minutes and in hours (ja)", () => {
    assert.deepEqual(foundJa("所要時間は90分です。", "", "所要時間は2時間です。"), ["所要時間:2時間≠90分"]);
    assert.deepEqual(foundJa("所要時間は90分です。", "", "所要時間は1.5時間です。"), []);
    assert.deepEqual(foundJa("所要時間は90分間です。", "", "所要時間は2時間です。"), ["所要時間:2時間≠90分間"]);
  });

  it("a length and a mass in English", () => {
    assert.deepEqual(foundEn("Distance: 5 km", "", "Distance: 3000 m"), ["Distance:3000 m≠5 km"]);
    assert.deepEqual(foundEn("The weight is 2 kg.", "", "The weight is 2000 g."), []);
    assert.deepEqual(foundEn("The weight is 2 kg.", "", "The weight is 3 lb."), ["The weight:3 lb≠2 kg"]);
  });

  it("a value is compared with every earlier value in another unit", () => {
    assert.deepEqual(foundEn("The height is 4 m.", "", "The height is 400 cm.", "", "The height is 3 feet."), ["The height:3 feet≠4 m"]);
    assert.deepEqual(foundEn("The height is 4 m.", "", "The height is 400 cm.", "", "The height is 13 feet."), []);
    assert.deepEqual(foundEn("The distance is 3 km.", "", "The distance is 5 km.", "", "The distance is 3000 m."), []);
    assert.deepEqual(foundEn("The height is 5 m.", "", "The height is 13 feet.", "", "The height is 400 cm."), ["The height:13 feet≠5 m"]);
    assert.deepEqual(foundEn("Weight: 1 pound", "", "Weight: 1 kg"), ["Weight:1 kg≠1 pound"]);
  });

  it("a rounded figure within 2% agrees", () => {
    assert.deepEqual(foundEn("Distance: 1 mile", "", "Distance: 1.6 km"), []);
    assert.deepEqual(foundEn("Distance: 1 mile", "", "Distance: 2 km"), ["Distance:2 km≠1 mile"]);
  });

  it("data sizes agree in either decimal or binary units", () => {
    assert.deepEqual(foundEn("Storage: 1 GB", "", "Storage: 1024 MB"), []);
    assert.deepEqual(foundEn("Storage: 1 GB", "", "Storage: 1000 MB"), []);
    assert.deepEqual(foundEn("Storage: 1 GB", "", "Storage: 500 MB"), ["Storage:500 MB≠1 GB"]);
  });

  it("the same unit, another kind of quantity, or another scope is left alone", () => {
    assert.deepEqual(foundEn("Distance: 5 km", "", "Distance: 3 km"), []);
    assert.deepEqual(foundEn("Size: 5 km", "", "Size: 3 kg"), []);
    assert.deepEqual(foundJa("## 第1回", "", "距離：5 km", "", "## 第2回", "", "距離：3000 m"), []);
  });

  it("a label heading many lines is a field of repeated records", () => {
    assert.deepEqual(foundEn("Distance: 5 km", "", "Distance: 3000 m", "", "Distance: 2 km"), []);
  });

  it("a unit that is the start of a word is not a unit", () => {
    assert.deepEqual(foundEn("Distance: 5 km", "", "Distance: 3 miners."), []);
  });
});
