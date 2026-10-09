import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { amountOf, expectedOf, servingsOf, type ScaleWords } from "../packages/chaff/src/structure/scaled-quantities.ts";

// 人数の列で、一行だけ比のとおりに増えていない量（scaled-quantity-mismatch）。

const RULE = "scaled-quantity-mismatch";

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["item"])}:${String(finding.values["written"])}->${String(finding.values["expected"])}@${String(finding.line)}`);

const slipsJa = (source: string): string[] => findings(source, ja, "ja");
const slipsEn = (source: string): string[] => findings(source, en, "en");

const table = (header: string, ...rows: string[]): string =>
  [
    "# Recipe",
    "",
    `| ${header} |`,
    `| ${header
      .split("|")
      .map(() => "---")
      .join(" | ")} |`,
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("scaled-quantity-mismatch: one row that does not scale", () => {
  it("ja: ケチャップ stays at 大さじ4 when every other row doubles", () => {
    const source = table(
      "材料 | 4人分 | 8人分",
      "合いびき肉 | 500g | 1000g",
      "玉ねぎ | 1個 | 2個",
      "牛乳 | 60ml | 120ml",
      "ケチャップ | 大さじ4 | 大さじ4",
      "塩 | 小さじ1 | 小さじ2",
    );
    assert.deepEqual(slipsJa(source), ["ケチャップ:大さじ4->8@8"]);
  });

  it("en: the singular and plural of a unit are one unit, and g and kg are converted", () => {
    const source = table(
      "Ingredient | Serves 4 | Serves 8",
      "Ground beef | 500 g | 1 kg",
      "Salt | 1 teaspoon | 2 teaspoons",
      "Milk | 60 ml | 120 ml",
      "Ketchup | 4 tablespoons | 4 tablespoons",
    );
    assert.deepEqual(slipsEn(source), ["Ketchup:4 tablespoons->8@8"]);
  });

  it("en: ×1 / ×3 columns and a fraction", () => {
    const source = table("Ingredient | ×1 | ×3", "Flour | 200 g | 600 g", "Butter | 1/2 cup | 1 1/2 cups", "Eggs | 2 | 6", "Sugar | 50 g | 100 g");
    assert.deepEqual(slipsEn(source), ["Sugar:100 g->150@8"]);
  });

  it("ja: with three columns, a row off against both other columns is reported once, at its first column", () => {
    const source = table(
      "材料 | 2人分 | 4人分 | 8人分",
      "米 | 1合 | 2合 | 4合",
      "水 | 200ml | 400ml | 800ml",
      "卵 | 2個 | 4個 | 8個",
      "砂糖 | 大さじ2 | 大さじ2 | 大さじ4",
    );
    assert.deepEqual(slipsJa(source), ["砂糖:大さじ2->1@8"]);
  });

  it("ja: with three columns, a row off in one column only is reported in that column", () => {
    const source = table(
      "材料 | 2人分 | 4人分 | 8人分",
      "米 | 1合 | 2合 | 4合",
      "水 | 200ml | 400ml | 800ml",
      "卵 | 2個 | 4個 | 8個",
      "砂糖 | 大さじ1 | 大さじ2 | 大さじ3",
    );
    assert.deepEqual(slipsJa(source), ["砂糖:大さじ3->4@8"]);
  });
});

describe("scaled-quantity-mismatch: what it does not report", () => {
  it("ja: an amount left to the cook (少々, 適量) stays as it is", () => {
    const source = table(
      "材料 | 4人分 | 8人分",
      "合いびき肉 | 500g | 1000g",
      "玉ねぎ | 1個 | 2個",
      "牛乳 | 60ml | 120ml",
      "こしょう | 少々 | 少々",
      "塩 | 小さじ1/2（お好みで） | 小さじ1/2（お好みで）",
    );
    assert.deepEqual(slipsJa(source), []);
  });

  it("en: to taste stays as it is", () => {
    const source = table(
      "Ingredient | Serves 2 | Serves 4",
      "Pasta | 200 g | 400 g",
      "Garlic | 1 clove | 2 cloves",
      "Cream | 100 ml | 200 ml",
      "Pepper | 1 pinch, to taste | 1 pinch, to taste",
    );
    assert.deepEqual(slipsEn(source), []);
  });

  it("ja: two rows off is no single slip (the recipe may not scale by design)", () => {
    const source = table(
      "材料 | 4人分 | 8人分",
      "合いびき肉 | 500g | 1000g",
      "玉ねぎ | 1個 | 2個",
      "牛乳 | 60ml | 120ml",
      "卵 | 1個 | 2個",
      "ケチャップ | 大さじ4 | 大さじ4",
      "塩 | 小さじ1 | 小さじ1",
    );
    assert.deepEqual(slipsJa(source), []);
  });

  it("ja: fewer than three rows that scale is no evidence", () => {
    const source = table("材料 | 4人分 | 8人分", "合いびき肉 | 500g | 1000g", "玉ねぎ | 1個 | 2個", "ケチャップ | 大さじ4 | 大さじ4");
    assert.deepEqual(slipsJa(source), []);
  });

  it("en: cells in different units, or holding two numbers, are not compared", () => {
    const source = table(
      "Ingredient | Serves 4 | Serves 8",
      "Ground beef | 500 g | 1 kg",
      "Onion | 1 | 2",
      "Milk | 60 ml | 120 ml",
      "Egg | 1 | 2",
      "Cheese | 1 cup | 200 g",
      "Potatoes | 2 (about 300 g) | 3 (about 450 g)",
    );
    assert.deepEqual(slipsEn(source), []);
  });

  it("en: a table whose columns are not servings is not read", () => {
    const source = table("Item | Price | Quantity", "Pen | 2 | 4", "Ink | 3 | 6", "Pad | 5 | 10", "Clip | 1 | 1");
    assert.deepEqual(slipsEn(source), []);
  });

  it("ja: a table that scales throughout is clean", () => {
    const source = table("材料 | 4人分 | 8人分", "合いびき肉 | 500g | 1000g", "玉ねぎ | 1個 | 2個", "牛乳 | 60ml | 120ml", "ケチャップ | 大さじ4 | 大さじ8");
    assert.deepEqual(slipsJa(source), []);
  });

  it("ja: with three columns, a row with the same amount in every column may be fixed on purpose", () => {
    const source = table(
      "材料 | 2人分 | 4人分 | 8人分",
      "米 | 1合 | 2合 | 4合",
      "水 | 200ml | 400ml | 800ml",
      "卵 | 2個 | 4個 | 8個",
      "塩 | 小さじ1 | 小さじ1 | 小さじ1",
    );
    assert.deepEqual(slipsJa(source), []);
  });
});

const WORDS: ScaleWords = {
  columns: [
    { pattern: "人分", position: "after" },
    { pattern: "Serves", position: "before" },
    { pattern: "×", position: "before" },
  ],
  unscaled: ["少々"],
  unitForms: [
    { pattern: "teaspoons", group: "teaspoon" },
    { pattern: "teaspoon", group: "teaspoon" },
    { pattern: "tsp", group: "teaspoon" },
  ],
  measures: [
    { pattern: "kg", dimension: "unit-mass", factors: [1000] },
    { pattern: "g", dimension: "unit-mass", factors: [1] },
  ],
};

describe("scaled-quantity-mismatch: the pure parts", () => {
  it("servingsOf reads a heading that is only a mark and a number", () => {
    assert.equal(servingsOf("4人分", WORDS.columns), 4);
    assert.equal(servingsOf("**Serves 8**", WORDS.columns), 8);
    assert.equal(servingsOf("×2", WORDS.columns), 2);
    assert.equal(servingsOf("×0", WORDS.columns), undefined);
    assert.equal(servingsOf("4人分（基本）", WORDS.columns), undefined);
    assert.equal(servingsOf("分量", WORDS.columns), undefined);
    assert.equal(servingsOf("", WORDS.columns), undefined);
    assert.equal(servingsOf("٤人分", WORDS.columns), undefined);
  });

  it("amountOf reads one number and its unit", () => {
    assert.deepEqual(amountOf("大さじ4", WORDS), { amount: 4, written: 4, unit: "大さじ#" });
    assert.deepEqual(amountOf("2 tsp", WORDS), amountOf("2 teaspoons", WORDS));
    assert.deepEqual(amountOf("1 kg", WORDS), { amount: 1000, written: 1, unit: "=unit-mass" });
    assert.equal(amountOf("1 1/2 cups", WORDS)?.amount, 1.5);
    assert.equal(amountOf("½", WORDS)?.amount, 0.5);
    assert.equal(amountOf("1½ cups", WORDS)?.amount, 1.5);
    assert.equal(amountOf("1,000g", WORDS)?.amount, 1000);
  });

  it("amountOf reads nothing from a cell with no number or two", () => {
    assert.equal(amountOf("少々", WORDS), undefined);
    assert.equal(amountOf("大さじ1と1/2", WORDS), undefined);
    assert.equal(amountOf("2 (300 g)", WORDS), undefined);
    assert.equal(amountOf("", WORDS), undefined);
    assert.equal(amountOf("1/0 cup", WORDS), undefined);
  });

  it("expectedOf answers in the unit the cell is written in", () => {
    const grams = { amount: 500, written: 500, unit: "=unit-mass" };
    const kilos = { amount: 1500, written: 1.5, unit: "=unit-mass" };
    assert.equal(expectedOf(grams, kilos, 2), 1);
    assert.equal(expectedOf({ amount: 4, written: 4, unit: "x" }, { amount: 4, written: 4, unit: "x" }, 2), 8);
    assert.equal(expectedOf({ amount: 4, written: 4, unit: "x" }, { amount: 0, written: 0, unit: "x" }, 2), 8);
  });
});
