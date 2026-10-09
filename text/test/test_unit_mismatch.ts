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

  it("one temperature in two units: the conversion within 15 °F agrees", () => {
    assert.deepEqual(foundJa("オーブンを180℃（350°F）に予熱します。"), []);
    assert.deepEqual(foundJa("オーブンを180℃（400°F）に予熱します。"), [":400°F≠180℃"]);
    assert.deepEqual(foundJa("オーブンを170℃（325°F）に予熱します。"), []);
    assert.deepEqual(foundEn("Preheat the oven to 180°C (350°F)."), []);
    assert.deepEqual(foundEn("Preheat the oven to 180°C (400°F)."), [":400°F≠180°C"]);
    assert.deepEqual(foundEn("The high was 25 °C (77 °F) and the low 10 °C (50 °F)."), []);
    assert.deepEqual(foundEn("The high was 25 °C (97 °F)."), [":97 °F≠25 °C"]);
    assert.deepEqual(foundEn("Being off by a mere 0.5°C (1°F) matters."), []);
    assert.deepEqual(foundEn("Preheat the oven to 100 °C (180 °F)."), [":180 °F≠100 °C"]);
    assert.deepEqual(foundEn("The freezer is -20 °C (-4 °F)."), []);
    assert.deepEqual(foundEn("The freezer is -20 °C (-40 °F)."), [":-40 °F≠-20 °C"]);
    assert.deepEqual(foundEn("Temperature: -20 °C", "", "Temperature: -40 °F"), ["Temperature:-40 °F≠-20 °C"]);
    assert.deepEqual(foundEn("Store at 20-25°C (68-77°F)."), []);
  });

  it("a temperature in one unit only is left alone", () => {
    assert.deepEqual(foundJa("180℃に予熱したオーブンで焼きます。", "", "最高気温は30℃です。"), []);
    assert.deepEqual(foundEn("Bake in the oven preheated to 180°C.", "", "The tea is best at 80 °C."), []);
  });

  it("度 is a temperature only next to a temperature word; degrees needs its scale", () => {
    assert.deepEqual(foundJa("オーブンを180度（400°F）に予熱します。"), [":400°F≠180度"]);
    assert.deepEqual(foundJa("ハンドルを90度（400°F）回します。"), []);
    assert.deepEqual(foundEn("Preheat the oven to 350 degrees Fahrenheit (100 °C)."), [":100 °C≠350 degrees Fahrenheit"]);
  });

  it("one pressure in two units", () => {
    assert.deepEqual(foundJa("空気圧は300kPa（約44psi）まで入れます。"), []);
    assert.deepEqual(foundJa("空気圧は300kPa（約60psi）まで入れます。"), [":60psi≠300kPa"]);
    assert.deepEqual(foundEn("Pump the tire to 300 kPa (about 44 psi)."), []);
    assert.deepEqual(foundEn("Pump the tire to 3 bar (about 60 psi)."), [":60 psi≠3 bar"]);
    assert.deepEqual(foundEn("Pump the tire to 3 bar (44 psi)."), []);
  });

  it("a bracketed conversion agrees when both figures could round one value", () => {
    assert.deepEqual(foundEn("The route is 5 km (3 miles) long."), []);
    assert.deepEqual(foundEn("The swell is now about 3 m (9 feet) high."), []);
    assert.deepEqual(foundEn("A storm within about 100 miles (165 km) counts."), []);
    assert.deepEqual(foundEn("A storm within about 100 miles (200 km) counts."), [":200 km≠100 miles"]);
    assert.deepEqual(foundEn("The route is 5 km (3.5 miles) long."), [":3.5 miles≠5 km"]);
    assert.deepEqual(foundEn("The route is 5 km (3 miles and a bit) long."), []);
    assert.deepEqual(foundEn("Plans: 1 GB / 500 MB."), []);
  });

  it("an ingredient in the table and in a step (ja)", () => {
    const table = [
      "## 材料",
      "",
      "| 材料 | 4人分 | 8人分 |",
      "| --- | --- | --- |",
      "| しょうゆ | 大さじ1 | 大さじ2 |",
      "| 水 | 100ml | 200ml |",
      "",
      "## 作り方",
      "",
    ];
    assert.deepEqual(foundJa(...table, "1. ケチャップ、しょうゆ15mlと水を入れます。"), []);
    assert.deepEqual(foundJa(...table, "1. ケチャップ、しょうゆ30mlと水を入れます。"), ["しょうゆ:30ml≠大さじ1"]);
    assert.deepEqual(foundJa(...table, "1. ケチャップ、しょうゆ大さじ1と水を入れます。"), []);
    assert.deepEqual(foundJa(...table, "1. 鍋に水カップ1を入れます。"), ["水:カップ1≠100ml"]);
    assert.deepEqual(foundJa(...table, "1. 鍋に水カップ1/2を入れます。"), []);
    assert.deepEqual(foundJa(...table, "1. 鍋にカップ1の水を入れます。"), ["水:カップ1≠100ml"]);
    assert.deepEqual(foundJa(...table, "1. 鍋にみりん30mlを入れます。"), []);
    assert.deepEqual(foundJa(...table, "1. 先に水50ccを入れます。"), []);
  });

  it("an ingredient in the table and in a step (en)", () => {
    const table = [
      "## Ingredients",
      "",
      "| Ingredient | Serves 4 | Serves 8 |",
      "| --- | --- | --- |",
      "| Soy sauce | 1 tablespoon | 2 tablespoons |",
      "| Milk | 1 cup | 2 cups |",
      "",
      "## Method",
      "",
    ];
    assert.deepEqual(foundEn(...table, "1. Add 15 ml of soy sauce."), []);
    assert.deepEqual(foundEn(...table, "1. Add 30 ml of the soy sauce."), ["Soy sauce:30 ml≠1 tablespoon"]);
    assert.deepEqual(foundEn(...table, "1. Add the soy sauce 30 ml."), ["Soy sauce:30 ml≠1 tablespoon"]);
    assert.deepEqual(foundEn(...table, "1. Warm 240 ml of milk."), []);
    assert.deepEqual(foundEn(...table, "1. Warm 250 ml of milk."), []);
    assert.deepEqual(foundEn(...table, "1. Warm 500 ml of milk."), ["Milk:500 ml≠1 cup"]);
    assert.deepEqual(foundEn(...table, "1. Warm 100 ml of milk, then add the rest."), []);
    assert.deepEqual(foundEn(...table, "1. Warm 1 1/2 cups of milk."), []);
    assert.deepEqual(foundEn(...table, "1. Add 30 ml of fish sauce."), []);
    assert.deepEqual(foundEn(...table, "1. Add 30 ml of soy sauces."), []);
  });
});
