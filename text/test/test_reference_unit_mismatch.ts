import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { referenceUnitMismatches, unitMatcher, unitsDisagree, type ReferenceUnitWords } from "../packages/chaff/src/structure/reference-unit.ts";

// 検査結果の単位が基準値の単位と違う（reference-unit-mismatch）。例文はすべて自作。

const RULE = "reference-unit-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const jaTable = (rows: readonly string[], header = "| 項目 | 結果 | 基準値 | 判定 |"): string => [header, "| --- | --- | --- | --- |", ...rows, ""].join("\n");

const enTable = (rows: readonly string[], header = "| Test | Result | Reference range | Flag |"): string =>
  [header, "| --- | --- | --- | --- |", ...rows, ""].join("\n");

const WORDS: ReferenceUnitWords = {
  units: [
    { pattern: "mg/dL", unit: "mg/dl" },
    { pattern: "mmol/L", unit: "mmol/l" },
    { pattern: "mol/L", unit: "mol/l" },
    { pattern: "U/L", unit: "u/l" },
    { pattern: "IU/L", unit: "u/l" },
    { pattern: "×10⁴/µL", unit: "10^4/ul" },
    { pattern: "万/µL", unit: "10^4/ul" },
    { pattern: "/µL", unit: "/ul" },
    { pattern: "mg", unit: "mg" },
    { pattern: "%", unit: "percent" },
  ],
  columns: [
    { pattern: "結果", role: "result" },
    { pattern: "前回", role: "result" },
    { pattern: "基準値", role: "range" },
    { pattern: "単位", role: "unit" },
  ],
};

const units = unitMatcher(WORDS.units);
const unitsOf = (text: string): string[] => [...units(text)].toSorted((left, right) => left.localeCompare(right));

const decide = (source: string): readonly string[] => referenceUnitMismatches(source, WORDS).map((issue) => String(issue.values["result"]));

describe("reference-unit-mismatch: 結果と基準値の単位が違う行", () => {
  it("ja: mmol/L の結果と mg/dL の基準値を指す", () => {
    assert.deepEqual(findingsOf(jaTable(["| HDLコレステロール | 64 mmol/L | 40〜96 mg/dL | 基準内 |"])), [
      "「HDLコレステロール」の結果「64 mmol/L」の単位が、基準値「40〜96 mg/dL」の単位と違います",
    ]);
  });

  it("en: mmol/L の結果と mg/dL の基準値を指す", () => {
    assert.deepEqual(findingsOf(enTable(["| Creatinine | 0.82 mmol/L | 0.57–1.11 mg/dL | Normal |"]), en), [
      'The result "0.82 mmol/L" for "Creatinine" is in another unit than its reference range "0.57–1.11 mg/dL"',
    ]);
  });

  it("同じ単位、書き方だけ違う同じ単位なら言わない", () => {
    assert.deepEqual(findingsOf(jaTable(["| 空腹時血糖 | 92 mg/dL | 70〜109 mg/dl | 基準内 |", "| γ-GTP | 88 IU/L | 79 U/L 以下 | 高 |"])), []);
    assert.deepEqual(findingsOf(jaTable(["| 白血球数 | 450 ×10⁴/µL | 380〜500 万/μL | 基準内 |"])), []);
    assert.deepEqual(findingsOf(jaTable(["| 尿酸 | ６.２ ｍｇ／ｄＬ | 3.6〜7.0 mg/dL | 基準内 |"])), []);
    assert.deepEqual(findingsOf(enTable(["| HbA1c | 5.2 % | 4.0–5.6 % | Normal |"]), en), []);
  });

  it("単位が見出しにだけあり、結果と基準値が共有するなら言わない", () => {
    assert.deepEqual(findingsOf(jaTable(["| 空腹時血糖 | 92 | 70〜109 | 基準内 |"], "| 項目 | 結果（mg/dL） | 基準値（mg/dL） | 判定 |")), []);
    assert.deepEqual(findingsOf(jaTable(["| 空腹時血糖 | 5.1 | 70〜109 mg/dL | 基準内 |"], "| 項目 | 結果（mmol/L） | 基準値 | 判定 |")), [
      "「空腹時血糖」の結果「5.1」の単位が、基準値「70〜109 mg/dL」の単位と違います",
    ]);
    assert.deepEqual(findingsOf(enTable(["| Glucose | 91 | 70–99 | mg/dL |"], "| Test | Result | Reference range | Unit |"), en), []);
  });

  it("単位の列は升に単位の無い側に使い、升の単位と違えば言う", () => {
    const withUnitColumn = "| Test | Result | Unit | Reference range |\n| --- | --- | --- | --- |\n| Glucose | 5.1 | mmol/L | 70–99 mg/dL |\n";
    assert.deepEqual(findingsOf(withUnitColumn, en), ['The result "5.1" for "Glucose" is in another unit than its reference range "70–99 mg/dL"']);
  });

  it("列の見出しの単位は、行の単位の列より先に使う", () => {
    const headed = "| Test | Result | Unit | Reference range (mg/dL) |\n| --- | --- | --- | --- |\n| Glucose | 5.1 | mmol/L | 70–99 |\n";
    assert.deepEqual(findingsOf(headed, en), ['The result "5.1" for "Glucose" is in another unit than its reference range "70–99"']);
  });

  it("基準値の列が二つなら、それぞれと比べる", () => {
    const twoRanges =
      "| 項目 | 結果 | 基準値（男性） | 基準値（女性） |\n| --- | --- | --- | --- |\n| 尿酸 | 0.4 mmol/L | 0.2〜0.4 mmol/L | 2.6〜5.5 mg/dL |\n";
    assert.deepEqual(findingsOf(twoRanges), ["「尿酸」の結果「0.4 mmol/L」の単位が、基準値「2.6〜5.5 mg/dL」の単位と違います"]);
    const bothSame = "| 項目 | 結果 | 基準値（男性） | 基準値（女性） |\n| --- | --- | --- | --- |\n| 尿酸 | 6.2 mg/dL | 3.6〜7.0 mg/dL | 2.6〜5.5 mg/dL |\n";
    assert.deepEqual(findingsOf(bothSame), []);
  });

  it("一価のイオンの mEq/L と mmol/L は同じ単位と読む", () => {
    assert.deepEqual(findingsOf(enTable(["| Potassium | 4.2 mmol/L | 3.5–5.1 mEq/L | Normal |"]), en), []);
  });

  it("単位の無い升、数の無い升、知らない単位は比べない", () => {
    assert.deepEqual(findingsOf(jaTable(["| HDLコレステロール | 64 | 40〜96 mg/dL | 基準内 |"])), []);
    assert.deepEqual(findingsOf(jaTable(["| 尿蛋白 | 陰性 | 陰性 | 基準内 |", "| 体温 | 36.5 ℃ | 35〜37 mg/dL | — |"])), []);
    assert.deepEqual(findingsOf(enTable(["| Hepatitis B | Negative | Negative mg/dL | Normal |"]), en), []);
    const qualitative = "| 項目 | 結果 | 単位 | 基準値 |\n| --- | --- | --- | --- |\n| 尿糖 | 陰性 | mg/dL | 0.8 mmol/L 未満 |\n";
    assert.deepEqual(findingsOf(qualitative), []);
  });

  it("換算した値を並べた升は、どれか一つの単位が合えば言わない", () => {
    assert.deepEqual(findingsOf(enTable(["| Glucose | 5.5 mmol/L (99 mg/dL) | 70–99 mg/dL | Normal |"]), en), []);
    assert.deepEqual(findingsOf(enTable(["| Glucose | 99 mg/dL | 3.9–5.5 mmol/L (70–99 mg/dL) | Normal |"]), en), []);
  });

  it("結果と基準値の列が無い表と、コードの中は読まない", () => {
    assert.deepEqual(findingsOf("| 品名 | 数量 | 価格 |\n| --- | --- | --- |\n| 試薬 | 64 mmol/L | 40 mg/dL |\n"), []);
    assert.deepEqual(findingsOf(["```", jaTable(["| HDL | 64 mmol/L | 40〜96 mg/dL | 基準内 |"]), "```", ""].join("\n")), []);
  });
});

describe("reference-unit-mismatch: 判定（Pure）", () => {
  it("unitsDisagree は両方が読めて共通の単位が無いときだけ", () => {
    assert.equal(unitsDisagree(new Set(["mmol/l"]), new Set(["mg/dl"])), true);
    assert.equal(unitsDisagree(new Set(["mmol/l", "mg/dl"]), new Set(["mg/dl"])), false);
    assert.equal(unitsDisagree(new Set(), new Set(["mg/dl"])), false);
    assert.equal(unitsDisagree(new Set(["mg/dl"]), new Set()), false);
    assert.equal(unitsDisagree(new Set(), new Set()), false);
  });

  it("unitMatcher は語やもっと長い単位の中には当てない", () => {
    assert.deepEqual(unitsOf("64 mmol/L"), ["mmol/l"]);
    assert.deepEqual(unitsOf("2 mol/L"), ["mol/l"]);
    assert.deepEqual(unitsOf("88 IU/L"), ["u/l"]);
    assert.deepEqual(unitsOf("450 ×10⁴/µL"), ["10^4/ul"]);
    assert.deepEqual(unitsOf("5,600 /µL"), ["/ul"]);
    assert.deepEqual(unitsOf("450 × 10⁴/µL"), []);
    assert.deepEqual(unitsOf("6.2 x10^5/µL"), []);
    assert.deepEqual(unitsOf("2 mg/kg"), []);
    assert.deepEqual(unitsOf("5 kU/L"), []);
    assert.deepEqual(unitsOf("5 mgs"), []);
    assert.deepEqual(unitsOf("45 %RH"), []);
    assert.deepEqual(unitsOf(""), []);
    assert.deepEqual([...unitMatcher([])("64 mmol/L")], []);
  });

  it("結果の列が二つなら、それぞれを基準値と比べる", () => {
    const source = "| 項目 | 結果 | 前回 | 基準値 |\n| --- | --- | --- | --- |\n| 血糖 | 92 mg/dL | 5.1 mmol/L | 70〜109 mg/dL |\n";
    assert.deepEqual(decide(source), ["5.1 mmol/L"]);
  });

  it("空の文書、見出しだけの表、升の足りない行から何も作らない", () => {
    assert.deepEqual(decide(""), []);
    assert.deepEqual(decide("| 項目 | 結果 | 基準値 |\n| --- | --- | --- |\n"), []);
    assert.deepEqual(decide("| 項目 | 結果 | 基準値 |\n| --- | --- | --- |\n| 血糖 | 5.1 mmol/L |\n"), []);
    assert.deepEqual(
      referenceUnitMismatches("| 項目 | 結果 | 基準値 |\n| --- | --- | --- |\n| 血糖 | 5.1 mmol/L | 70 mg/dL |\n", { units: WORDS.units, columns: [] }),
      [],
    );
  });
});
