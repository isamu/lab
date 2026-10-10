import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import { bmiDisagreement, cellBmi, cellMeasure, sectionBmiMismatches, type BodyWords } from "../packages/chaff/src/structure/bmi.ts";
import type { TableRow } from "../packages/chaff/src/structure/ratio.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// BMI と、同じ節の身長・体重（bmi-mismatch）。例は自作。

const RULE = "bmi-mismatch";

const found = (text: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", `# 報告\n\n${text}\n`, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["written"])}:${String(finding.values["computed"])}`);

const table = (rows: readonly string[]): string => ["| 項目 | 結果 | 基準値 |", "| --- | --- | --- |", ...rows].join("\n");

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

describe("bmiDisagreement", () => {
  const measure = (value: number, half: number): { value: number; half: number } => ({ value, half });
  const bmi = (value: number, decimals = 1): { start: number; value: number; decimals: number } => ({ start: 0, value, decimals });

  it("is silent when the written BMI is within the rounding of the height and the weight", () => {
    // 56.3 / 1.6² = 21.99.
    assert.equal(bmiDisagreement(bmi(22.0), measure(1.6, 0.0005), measure(56.3, 0.05)), undefined);
    assert.equal(bmiDisagreement(bmi(22, 0), measure(1.6, 0.0005), measure(56.3, 0.05)), undefined);
  });

  it("gives the computed BMI, to the written decimals, when no rounding reaches it", () => {
    assert.equal(bmiDisagreement(bmi(24.0), measure(1.6, 0.0005), measure(56.3, 0.05)), "22.0");
    assert.equal(bmiDisagreement(bmi(21.4), measure(1.78, 0.005), measure(74, 0.05)), "23.4");
    assert.equal(bmiDisagreement(bmi(21.4, 2), measure(1.78, 0.005), measure(74, 0.05)), "23.36");
  });

  it("widens with coarse heights and weights: 178 cm and 74 kg can give 23.2 to 23.6", () => {
    assert.equal(bmiDisagreement(bmi(23.6), measure(1.78, 0.005), measure(74, 0.5)), undefined);
    assert.equal(bmiDisagreement(bmi(23.2), measure(1.78, 0.005), measure(74, 0.5)), undefined);
    assert.equal(bmiDisagreement(bmi(23.8), measure(1.78, 0.005), measure(74, 0.5)), "23.4");
  });

  it("is silent on a height its rounding can make zero, or a weight of zero", () => {
    assert.equal(bmiDisagreement(bmi(20), measure(0.4, 0.5), measure(56, 0.5)), undefined);
    assert.equal(bmiDisagreement(bmi(20), measure(1.6, 0.0005), measure(0, 0.5)), undefined);
  });
});

describe("cell readers", () => {
  const lengths = [
    { pattern: "cm", factor: 0.01 },
    { pattern: "m", factor: 1 },
    { pattern: "in", factor: 0.0254 },
  ];

  it("reads a height in cm or m, with the half step of its last digit", () => {
    assert.deepEqual(cellMeasure("160.0 cm", "身長", lengths), { value: 1.6, half: 0.0005 });
    assert.equal(cellMeasure("1.78 m", "Height", lengths)?.value, 1.78);
    assert.equal(cellMeasure("１６０ｃｍ", "身長", lengths)?.value, 1.6);
    assert.equal(cellMeasure("160.0", "身長（cm）", lengths)?.value, 1.6);
    assert.ok(Math.abs((cellMeasure("70 in", "Height", lengths)?.value ?? 0) - 1.778) < 1e-9);
  });

  it("does not read a range, a rough figure, two numbers, no unit, or a unit not listed", () => {
    for (const text of ["160〜165 cm", "約160 cm", "about 160 cm", "5 ft 10 in", "160", "160 cm前後", "160 cm (barefoot)", "—", "160 yd", "-160 cm"]) {
      assert.equal(cellMeasure(text, "Height", lengths), undefined, text);
    }
  });

  it("does not read a row whose label notes something other than a unit", () => {
    assert.equal(cellMeasure("74.0 kg", "Weight (last year)", [{ pattern: "kg", factor: 1000 }]), undefined);
    assert.equal(cellMeasure("74.0", "Weight (kg)", [{ pattern: "kg", factor: 1000 }])?.value, 74000);
    assert.equal(cellBmi({ start: 0, text: "21.4" }, "BMI (percentile)", ["kg/m²"]), undefined);
    assert.equal(cellBmi({ start: 0, text: "21.4" }, "BMI（kg/m²）", ["kg/m²"])?.value, 21.4);
  });

  it("reads a BMI as a plain number or with a BMI unit, and nothing else", () => {
    const cell = (text: string): { start: number; text: string } => ({ start: 7, text });
    assert.deepEqual(cellBmi(cell("22.0"), "BMI", ["kg/m²"]), { start: 7, value: 22, decimals: 1 });
    assert.equal(cellBmi(cell("22.0 kg/m2"), "BMI", ["kg/m²"])?.value, 22);
    assert.equal(cellBmi(cell("22.0 kg/m²"), "BMI", ["kg/m2"])?.value, 22);
    assert.equal(cellBmi(cell("22.0kg/㎡"), "BMI", ["kg/m²"])?.value, 22);
    for (const text of ["18.5〜24.9", "約22", "22.0 %", "基準内", ""]) assert.equal(cellBmi(cell(text), "BMI", ["kg/m²"]), undefined, text);
  });
});

describe("sectionBmiMismatches", () => {
  const words: BodyWords = {
    terms: [
      { pattern: "身長", kind: "height" },
      { pattern: "体重", kind: "weight" },
      { pattern: "BMI", kind: "bmi" },
    ],
    lengthUnits: [{ pattern: "cm", factor: 0.01 }],
    massUnits: [{ pattern: "kg", factor: 1000 }],
    bmiUnits: [],
  };
  const row = (label: string, ...texts: string[]): TableRow => ({ label, cells: texts.map((text, index) => ({ start: index * 10, text })) });

  it("compares the one height, weight and BMI of one group, column by column", () => {
    const rows = [row("身長", "160.0 cm", "160.0 cm"), row("体重", "56.3 kg", "60.0 kg"), row("BMI", "24.0", "23.4")];
    assert.deepEqual(sectionBmiMismatches([rows], words), [{ offset: 0, values: { written: "24.0", computed: "22.0" } }]);
  });

  it("is silent when one of the three is missing, written twice, or in another group", () => {
    const [height, weight, bmi] = [row("身長", "160.0 cm"), row("体重", "56.3 kg"), row("BMI", "24.0")];
    assert.deepEqual(sectionBmiMismatches([[height, weight, bmi]], words).length, 1);
    assert.deepEqual(sectionBmiMismatches([[height, bmi]], words), []);
    assert.deepEqual(sectionBmiMismatches([[height, weight, bmi, row("体重", "60.0 kg")]], words), []);
    assert.deepEqual(sectionBmiMismatches([[height, weight], [bmi]], words), []);
    assert.deepEqual(sectionBmiMismatches([[height, weight, row("BMI", "24.0", "22.0")]], words), []);
    assert.deepEqual(sectionBmiMismatches([], words), []);
  });
});

describe("bmi-mismatch", () => {
  it("reports a BMI in a checkup table that the height and weight beside it do not give (ja)", () => {
    const rows = (value: string): string => table(["| 身長 | 160.0 cm | — |", "| 体重 | 56.3 kg | — |", `| BMI | ${value} | 18.5〜24.9 |`]);
    assert.deepEqual(found(rows("24.0"), ja), ["24.0:22.0"]);
    assert.deepEqual(found(rows("22.0"), ja), []);
  });

  it("reports one in English, and reads the unit noted in the row label", () => {
    const rows = (value: string): string =>
      ["| Item | Result |", "| --- | --- |", "| Height (cm) | 178 |", "| Weight (kg) | 74.0 |", `| Body mass index | ${value} |`].join("\n");
    assert.deepEqual(found(rows("21.4"), en), ["21.4:23.4"]);
    assert.deepEqual(found(rows("23.4"), en), []);
  });

  it("is silent on a BMI row noted as something else than a BMI", () => {
    const rows = ["| Item | Result |", "| --- | --- |", "| Height | 178 cm |", "| Weight | 74.0 kg |", "| BMI (percentile) | 21.4 |"];
    assert.deepEqual(found(rows.join("\n"), en), []);
    assert.deepEqual(found(["Height: 178 cm", "", "Weight: 74.0 kg", "", "BMI (percentile): 21.4"].join("\n"), en), []);
  });

  it("converts the units of the lexicons: 70 in and 163 lb give 23.4", () => {
    const lines = (value: string): string => ["Height: 70 in", "", "Weight: 163 lb", "", `BMI: ${value}`].join("\n");
    assert.deepEqual(found(lines("25.0"), en), ["25.0:23.4"]);
    assert.deepEqual(found(lines("23.4"), en), []);
  });

  it("reads 'label: value' lines, in a list too", () => {
    assert.deepEqual(found(["- 身長：160.0 cm", "- 体重：56.3 kg", "- BMI：24.0"].join("\n"), ja), ["24.0:22.0"]);
    assert.deepEqual(found(["- 身長：160.0 cm", "- 体重：56.3 kg", "- BMI：22.0"].join("\n"), ja), []);
  });

  it("reads each section as one person", () => {
    const person = (bmi: string): string => ["身長：160.0 cm", "", "体重：56.3 kg", "", `BMI：${bmi}`].join("\n");
    assert.deepEqual(found(["## 一人目", "", person("22.0"), "", "## 二人目", "", person("24.0")].join("\n"), ja), ["24.0:22.0"]);
    assert.deepEqual(found([person("22.0"), "", "身長：170.0 cm"].join("\n"), ja), []);
  });

  it("is silent on a rough or ranged height, a height without a unit, and two numbers", () => {
    for (const height of ["約160 cm", "160〜165 cm", "160"]) {
      assert.deepEqual(found(table([`| 身長 | ${height} | — |`, "| 体重 | 56.3 kg | — |", "| BMI | 24.0 | — |"]), ja), [], height);
    }
    assert.deepEqual(found(["Height: 5 ft 10 in", "", "Weight: 163 lb", "", "BMI: 25.0"].join("\n"), en), []);
  });

  it("does not read the words inside code", () => {
    assert.deepEqual(found(["```", "身長：160.0 cm", "体重：56.3 kg", "BMI：24.0", "```"].join("\n"), ja), []);
  });
});
