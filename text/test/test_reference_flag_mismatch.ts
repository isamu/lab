import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { positionOf, slipKindOf, valueOf, type FlagMeaning, type Position } from "../packages/chaff/src/structure/reference-flags.ts";

// 検査結果の表で、判定の印が結果と基準値に合わない（reference-flag-mismatch）。表は自作の数字。

const RULE = "reference-flag-mismatch";

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["item"])}:${finding.variant ?? "inside"}@${String(finding.line)}`);

const slipsJa = (source: string): string[] => findings(source, ja, "ja");
const slipsEn = (source: string): string[] => findings(source, en, "en");

const table = (header: string, ...rows: string[]): string =>
  [
    "# Results",
    "",
    `| ${header} |`,
    `| ${header
      .split("|")
      .map(() => "---")
      .join(" | ")} |`,
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");

const JA_HEADER = "項目 | 結果 | 基準値 | 判定";
const EN_HEADER = "Test | Result | Reference range | Flag";

describe("reference-flag-mismatch: ja", () => {
  it("高 on a value inside 30〜149", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "中性脂肪 | 88 mg/dL | 30〜149 mg/dL | 高", "LDL | 152 mg/dL | 60〜139 mg/dL | 高")), ["中性脂肪:inside@5"]);
  });

  it("基準内 on a value above 79 以下", () => {
    assert.deepEqual(slipsJa(table("検査項目 | 結果 | 基準値 | 判定", "γ-GTP | 88 U/L | 79 U/L 以下 | 基準内", "AST | 24 U/L | 10〜40 U/L | 基準内")), [
      "γ-GTP:outside@5",
    ]);
  });

  it("高 on a value below the range, 低 on one above", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "HDL | 32 mg/dL | 40〜96 mg/dL | 高", "血糖 | 150 mg/dL | 70〜109 mg/dL | L")), ["HDL:below@5", "血糖:above@6"]);
  });

  it("基準外 or * on a value inside", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "尿酸 | 6.2 mg/dL | 3.6〜7.0 mg/dL | 基準外", "血糖 | 92 mg/dL | 70〜109 mg/dL | *")), [
      "尿酸:inside@5",
      "血糖:inside@6",
    ]);
  });

  it("40以上 and 90.0 cm 未満: one-sided ranges", () => {
    assert.deepEqual(
      slipsJa(table(JA_HEADER, "HDL | 38 mg/dL | 40以上 | 基準内", "腹囲 | 90.0 cm | 90.0 cm 未満 | 基準内", "腹囲2 | 85 cm | 90 cm未満 | 高")),
      ["HDL:outside@5", "腹囲:outside@6", "腹囲2:inside@7"],
    );
  });

  it("columns are found by heading, not by position", () => {
    assert.deepEqual(slipsJa(table("判定 | 項目 | 基準範囲 | 測定値", "高 | 中性脂肪 | 30〜149 | 88")), ["高:inside@5"]);
  });

  it("silent when every flag agrees", () => {
    const source = table(
      JA_HEADER,
      "LDL | 152 mg/dL | 60〜139 mg/dL | 高",
      "HDL | 32 mg/dL | 40〜96 mg/dL | 低",
      "AST | 24 U/L | 10〜40 U/L | 基準内",
      "γ-GTP | 88 U/L | ≦79 | H",
    );
    assert.deepEqual(slipsJa(source), []);
  });
});

describe("reference-flag-mismatch: en", () => {
  it("H on a value inside 4.0–5.6", () => {
    assert.deepEqual(slipsEn(table(EN_HEADER, "HbA1c | 5.2 % | 4.0–5.6 % | H", "Total cholesterol | 214 mg/dL | 125–199 mg/dL | H")), ["HbA1c:inside@5"]);
  });

  it("Normal on a value below 30–100", () => {
    assert.deepEqual(slipsEn(table(EN_HEADER, "Vitamin D | 18 ng/mL | 30–100 ng/mL | Normal", "TSH | 2.1 mIU/L | 0.4–4.0 mIU/L | Normal")), [
      "Vitamin D:outside@5",
    ]);
  });

  it("signs and words: ≤79, >40, below 102 cm, 40 or more", () => {
    const source = table(
      "Test | Value | Normal range | Flags",
      "GGT | 88 U/L | ≤79 U/L | Normal",
      "HDL | 52 mg/dL | >40 mg/dL | Low",
      "Waist | 104 cm | below 102 cm | WNL",
      "HDL 2 | 39 | 40 or more | High",
    );
    assert.deepEqual(slipsEn(source), ["GGT:outside@5", "HDL:inside@6", "Waist:outside@7", "HDL 2:below@8"]);
  });

  it("emphasised flags are read: **H**", () => {
    assert.deepEqual(slipsEn(table(EN_HEADER, "HbA1c | 5.2 % | 4.0–5.6 % | **H**")), ["HbA1c:inside@5"]);
  });
});

describe("reference-flag-mismatch: a value on the boundary is inside the range", () => {
  it("149 against 30〜149 flagged 高 is reported; flagged 基準内 is not", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "中性脂肪 | 149 mg/dL | 30〜149 mg/dL | 高", "中性脂肪2 | 149 mg/dL | 30〜149 mg/dL | 基準内")), [
      "中性脂肪:inside@5",
    ]);
  });

  it("an end that 未満 or < leaves out: 90 against 90 未満 is outside", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "腹囲 | 90 cm | 90 cm 未満 | 基準内", "腹囲2 | 90 cm | 90 cm 以下 | 基準内")), ["腹囲:outside@5"]);
    assert.deepEqual(slipsEn(table(EN_HEADER, "Waist | 102 cm | <102 cm | Normal", "Waist 2 | 102 cm | ≤102 cm | Normal")), ["Waist:outside@5"]);
  });
});

describe("reference-flag-mismatch: silent", () => {
  it("units differ in the row", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "HDL | 64 mmol/L | 40〜96 mg/dL | 高")), []);
    assert.deepEqual(slipsEn(table(EN_HEADER, "Creatinine | 0.82 mmol/L | 0.57–1.11 mg/dL | H")), []);
  });

  it("no range, a reversed range, a range for men and women", () => {
    const source = table(JA_HEADER, "身長 | 160.0 cm | — | 高", "ALT | 31 U/L | 45〜5 U/L | 高", "Hb | 14.0 g/dL | 男 13.5〜17.5 女 11.5〜15.0 | 高");
    assert.deepEqual(slipsJa(source), []);
  });

  it("the value is not a number", () => {
    assert.deepEqual(slipsEn(table(EN_HEADER, "CRP | <0.3 mg/dL | 0.0–0.3 mg/dL | H", "Urine protein | negative | negative | H")), []);
  });

  it("an unknown flag: a grade", () => {
    assert.deepEqual(slipsJa(table(JA_HEADER, "中性脂肪 | 88 mg/dL | 30〜149 mg/dL | C", "血糖 | 150 mg/dL | 70〜109 mg/dL | 要再検査")), []);
  });

  it("a table without a flag column, or two result columns", () => {
    assert.deepEqual(slipsJa(table("項目 | 結果 | 基準値", "中性脂肪 | 88 mg/dL | 30〜149 mg/dL")), []);
    assert.deepEqual(slipsJa(table("項目 | 結果 | 今回 | 基準値 | 判定", "中性脂肪 | 80 | 88 | 30〜149 | 高")), []);
  });

  it("a table that is not a results table", () => {
    assert.deepEqual(slipsEn(table("Item | Price | Range | Note", "Plan | 88 | 30–149 | H")), []);
  });
});

describe("reference-flag-mismatch: the decision", () => {
  const cases: readonly [FlagMeaning, Position, string | undefined][] = [
    ["high", "inside", "inside"],
    ["low", "inside", "inside"],
    ["outside", "inside", "inside"],
    ["normal", "inside", undefined],
    ["normal", "above", "outside"],
    ["normal", "below", "outside"],
    ["high", "above", undefined],
    ["high", "below", "below"],
    ["low", "below", undefined],
    ["low", "above", "above"],
    ["outside", "above", undefined],
    ["outside", "below", undefined],
  ];
  it("slipKindOf: every flag at every position", () => {
    assert.deepEqual(
      cases.map(([flag, position]) => slipKindOf(flag, position)),
      cases.map(([, , expected]) => expected),
    );
  });

  it("positionOf: loose ends are inclusive, exclusive ends are not", () => {
    const loose = { low: { value: 30, kind: "loose" as const, decimals: 0 }, high: { value: 149, kind: "loose" as const, decimals: 0 }, unit: "" };
    assert.deepEqual(
      [29, 30, 149, 150].map((value) => positionOf(value, loose)),
      ["below", "inside", "inside", "above"],
    );
    const exclusive = { low: { value: 40, kind: "exclusive" as const, decimals: 0 }, high: { value: 90, kind: "exclusive" as const, decimals: 0 }, unit: "" };
    assert.deepEqual(
      [40, 41, 89, 90].map((value) => positionOf(value, exclusive)),
      ["below", "inside", "inside", "above"],
    );
  });

  it("valueOf: a number and its unit, nothing else", () => {
    assert.deepEqual(valueOf("1,234.5 mg/dL"), { number: 1234.5, unit: "mg/dl" });
    assert.deepEqual(valueOf(" 24.0 "), { number: 24, unit: "" });
    assert.equal(valueOf("<0.5"), undefined);
    assert.equal(valueOf("陰性"), undefined);
    assert.equal(valueOf(""), undefined);
    assert.equal(valueOf("—"), undefined);
    assert.equal(valueOf("12 13"), undefined);
  });
});
