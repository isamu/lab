import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { measuredValues, sameMeasure } from "../packages/chaff/src/facts/measures.ts";
import { measureUnitsOf } from "../packages/chaff/src/facts/measure-units.ts";

// 濃度と血球の数の単位（unit-concentration）。組（group）ごとに別の量の種類で、組をまたいで比べない。

const readOf = (text: string, adapter: LanguageAdapter): string[] =>
  measuredValues(text, measureUnitsOf(buildDocument("t.md", text, adapter))).map((value) => `${text.slice(value.start, value.end)}|${value.dimension}`);

const ruleFindings = (rule: string, genre: string, lines: readonly string[], adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", ["# T", "", ...lines, ""].join("\n"), adapter), loadRules(adapter.id), { [rule]: "normal" }, false, genre)
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => String(finding.values["range"] ?? `${String(finding.values["value"])}≠${String(finding.values["other"])}`));

const reversed = (adapter: LanguageAdapter, ...lines: string[]): string[] => ruleFindings("quantity-range-reversed", "technical/spec", lines, adapter);
const mismatched = (adapter: LanguageAdapter, ...lines: string[]): string[] => ruleFindings("unit-mismatch", "business/report", lines, adapter);

describe("unit-concentration: reading a compound unit whole", () => {
  it("reads mg/dL, U/L, mmol/L and ×10⁴/µL whole, not as mg, m or mm", () => {
    assert.deepEqual(readOf("尿酸 6.2 mg/dL、ALT 31 U/L、K 4.2 mmol/L、血小板 25.0×10⁴/µL", ja), [
      "6.2 mg/dL|unit-concentration:mass",
      "31 U/L|unit-concentration:enzyme",
      "4.2 mmol/L|unit-concentration:molar",
      "25.0×10⁴/µL|unit-concentration:count",
    ]);
    assert.deepEqual(readOf("TSH 2.1 mIU/L, sodium 140 mEq/L, glucose 5.5 mmol/l", en), [
      "2.1 mIU/L|unit-concentration:international",
      "140 mEq/L|unit-concentration:equivalent",
      "5.5 mmol/l|unit-concentration:molar",
    ]);
  });

  it("the exponent of ×10^4/µL is not a count of its own", () => {
    assert.deepEqual(readOf("Platelets 25.0×10^4/µL, WBC 5×10^3/µL, RBC 4.5×10^6/µL", en), [
      "25.0×10^4/µL|unit-concentration:count",
      "5×10^3/µL|unit-concentration:count",
      "4.5×10^6/µL|unit-concentration:count",
    ]);
    assert.deepEqual(readOf("WBC 5000/µL", en), ["5000/µL|unit-concentration:count"]);
  });

  it("leaves the plain units and other per-units as they were", () => {
    assert.deepEqual(readOf("5 mg and 2 L and 3 mm", en), ["5 mg|unit-mass", "2 L|unit-volume", "3 mm|unit-length"]);
    assert.deepEqual(readOf("10 mg/day", en), ["10 mg|unit-mass"]);
  });

  it("converts within a family only", () => {
    const [mgdl, mgl, mmol] = measuredValues("6.2 mg/dL 62 mg/L 6.2 mmol/L", measureUnitsOf(buildDocument("t.md", "", en)));
    assert.ok(mgdl !== undefined && mgl !== undefined && mmol !== undefined);
    assert.equal(mgdl.dimension, mgl.dimension);
    assert.notEqual(mgdl.dimension, mmol.dimension);
    assert.ok(sameMeasure(mgdl, mgl, { relative: 0.02, absolute: 0 }));
  });
});

describe("quantity-range-reversed with concentrations", () => {
  it("a reversed reference range in U/L, mmol/L and mg/dL is reported with its whole unit", () => {
    assert.deepEqual(reversed(ja, "| ALT | 31 U/L | 45〜5 U/L |"), ["45〜5 U/L"]);
    assert.deepEqual(reversed(ja, "空腹時血糖：109〜70 mg/dL"), ["109〜70 mg/dL"]);
    assert.deepEqual(reversed(en, "| Potassium | 4.2 mmol/L | 5.1–3.5 mmol/L |"), ["5.1–3.5 mmol/L"]);
    assert.deepEqual(reversed(ja, "血小板：35.0〜15.0×10⁴/µL"), ["35.0〜15.0×10⁴/µL"]);
  });

  it("a range in order, or two ends of different families, is not reported", () => {
    assert.deepEqual(reversed(ja, "| ALT | 31 U/L | 5〜45 U/L |"), []);
    assert.deepEqual(reversed(en, "| Potassium | 4.2 mmol/L | 3.5–5.1 mmol/L |"), []);
    assert.deepEqual(reversed(en, "Glucose: 99 mg/dL–5.5 mmol/L"), []);
    assert.deepEqual(reversed(en, "Activity: 40 IU/L–30 U/L"), []);
  });
});

describe("unit-mismatch with concentrations", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("two units of one family convert, and a value that does not convert is reported", () => {
    assert.deepEqual(mismatched(en, "Uric acid: 6.2 mg/dL", "", "Uric acid: 62 mg/L"), []);
    assert.deepEqual(mismatched(en, "Uric acid: 6.2 mg/dL", "", "Uric acid: 30 mg/L"), ["30 mg/L≠6.2 mg/dL"]);
    assert.deepEqual(mismatched(ja, "クレアチニン：88 µmol/L", "", "クレアチニン：0.088 mmol/L"), []);
  });

  it("two families are never compared: mg/dL against mmol/L depends on the substance", () => {
    assert.deepEqual(mismatched(en, "Glucose: 99 mg/dL", "", "Glucose: 5.5 mmol/L"), []);
    assert.deepEqual(mismatched(ja, "ナトリウム：140 mEq/L", "", "ナトリウム：3.2 mmol/L"), []);
  });
});
