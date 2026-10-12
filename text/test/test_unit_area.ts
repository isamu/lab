import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { measuredValues } from "../packages/chaff/src/facts/measures.ts";
import { measureUnitsOf } from "../packages/chaff/src/facts/measure-units.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 面積の単位（unit-area）を unit-mismatch が換算して比べる。

const found = (lines: readonly string[], adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", ["# T", "", ...lines].join("\n"), adapter), loadRules(language), { "unit-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "unit-mismatch")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

const read = (text: string, adapter: LanguageAdapter): string[] =>
  measuredValues(text, measureUnitsOf(buildDocument("t.md", text, adapter)))
    .filter((value) => value.dimension === "unit-area")
    .map((value) => text.slice(value.start, value.end));

const foundJa = (...lines: string[]): string[] => found(lines, ja, "ja");
const foundEn = (...lines: string[]): string[] => found(lines, en, "en");

describe("unit-mismatch: area", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("㎡ and 坪 (400/121 ㎡) of one item", () => {
    assert.deepEqual(foundJa("専有面積：52.80㎡", "", "- 所在階：2階", "- 専有面積：15.97坪"), []);
    assert.deepEqual(foundJa("専有面積：52.80㎡", "", "- 所在階：2階", "- 専有面積：17.97坪"), ["専有面積:17.97坪≠52.80㎡"]);
  });

  it("平方メートル, 平米 and m² are one unit with ㎡", () => {
    assert.deepEqual(foundJa("敷地面積は330平方メートルです。", "", "敷地面積は100坪です。"), []);
    assert.deepEqual(foundJa("敷地面積は330平米です。", "", "敷地面積は120坪です。"), ["敷地面積:120坪≠330平米"]);
    assert.deepEqual(foundJa("面積：2 ㎢", "", "面積：200ヘクタール"), []);
    assert.deepEqual(foundJa("面積：2 ㎢", "", "面積：20ヘクタール"), ["面積:20ヘクタール≠2 ㎢"]);
  });

  it("square feet, square metres and acres", () => {
    assert.deepEqual(foundEn("Floor area: 68 m²", "", "Floor area: 732 sq ft"), []);
    assert.deepEqual(foundEn("Floor area: 68 m²", "", "Floor area: 832 sq ft"), ["Floor area:832 sq ft≠68 m²"]);
    assert.deepEqual(foundEn("The site is 2 acres.", "", "The site is 0.81 hectares."), []);
    assert.deepEqual(foundEn("The site is 2 acres.", "", "The site is 2 hectares."), ["The site:2 hectares≠2 acres"]);
    assert.deepEqual(foundEn("Floor area: 400 square metres", "", "Floor area: 4,306 square feet"), []);
  });

  it("one area in two units in one table cell", () => {
    const table = (cell: string): string[] => ["| 項目 | 内容 |", "| --- | --- |", `| 専有面積 | ${cell} |`];
    assert.deepEqual(foundJa(...table("52.80㎡（約15.97坪）")), []);
    assert.deepEqual(foundJa(...table("165.29㎡（50.00坪）")), []);
    assert.deepEqual(foundJa(...table("52.80㎡（約17.97坪）")), [":17.97坪≠52.80㎡"]);
    assert.deepEqual(foundJa(...table("165.29㎡（55.00坪）")), [":55.00坪≠165.29㎡"]);
    assert.deepEqual(foundEn("| Item | Value |", "| --- | --- |", "| Floor area | 68 m² (732 sq ft) |"), []);
    assert.deepEqual(foundEn("| Item | Value |", "| --- | --- |", "| Floor area | 4,306 sq ft (400 m²) |"), []);
    assert.deepEqual(foundEn("| Item | Value |", "| --- | --- |", "| Floor area | 68 m² (832 sq ft) |"), [":832 sq ft≠68 m²"]);
    assert.deepEqual(foundEn("The plot is 5 acres (about 2 ha)."), []);
    assert.deepEqual(foundEn("The plot is 5 acres (about 5 ha)."), [":5 ha≠5 acres"]);
  });

  it("a rounded tsubo agrees within the rounding written", () => {
    assert.deepEqual(foundJa("延床面積は100㎡（30坪）です。"), []);
    assert.deepEqual(foundJa("延床面積は100㎡（33坪）です。"), [":33坪≠100㎡"]);
  });

  it("the plain-text spellings m2, m^2, km2 and sq.m. are one unit with m²", () => {
    assert.deepEqual(foundEn("Floor area: 68 m2", "", "Floor area: 732 sq ft"), []);
    assert.deepEqual(foundEn("Floor area: 68 m2", "", "Floor area: 832 sq ft"), ["Floor area:832 sq ft≠68 m2"]);
    assert.deepEqual(foundEn("Floor area: 68m2", "", "Floor area: 832 sq ft"), ["Floor area:832 sq ft≠68m2"]);
    assert.deepEqual(foundEn("Floor area: 68 m^2", "", "Floor area: 832 sq ft"), ["Floor area:832 sq ft≠68 m^2"]);
    assert.deepEqual(foundEn("Floor area: 68 sq.m.", "", "Floor area: 832 sq ft"), ["Floor area:832 sq ft≠68 sq.m."]);
    assert.deepEqual(foundEn("Floor area: 68 sq. m.", "", "Floor area: 732 sq ft"), []);
    assert.deepEqual(foundEn("The site is 2 km2.", "", "The site is 200 hectares."), []);
    assert.deepEqual(foundEn("The site is 2 km2.", "", "The site is 20 hectares."), ["The site:20 hectares≠2 km2"]);
    assert.deepEqual(foundJa("専有面積：52.80m2", "", "専有面積：15.97坪"), []);
    assert.deepEqual(foundJa("専有面積：52.80m2", "", "専有面積：17.97坪"), ["専有面積:17.97坪≠52.80m2"]);
    assert.deepEqual(foundJa("延床面積は100m2（33坪）です。"), [":33坪≠100m2"]);
  });

  it("m2 is not an area when it is not right after a number, is upper case, or runs on", () => {
    assert.deepEqual(read("The M2 chip and PM2.5 levels.", en), []);
    assert.deepEqual(read("Print it on A4 m2 paper; set x = m2 + 1.", en), []);
    assert.deepEqual(read("A 42 M2 tank.", en), []);
    assert.deepEqual(read("Add 3 m23 rows and 5 m2x.", en), []);
    assert.deepEqual(read("Floor area: 68 m2.", en), ["68 m2"]);
    assert.deepEqual(read("Floor area: 68m2, 9 sq.m.", en), ["68m2", "9 sq.m."]);
    assert.deepEqual(read("専有面積は52.80m2の住戸。", ja), ["52.80m2"]);
    assert.deepEqual(read("PM2.5の濃度とM2チップ。", ja), []);
  });

  it("畳 is not read as an area, and an area is not compared with a length", () => {
    assert.deepEqual(foundJa("居室：10㎡", "", "居室：6畳"), []);
    assert.deepEqual(foundJa("広さ：10㎡", "", "広さ：10m"), []);
    assert.deepEqual(foundEn("Size: 10 m²", "", "Size: 10 m"), []);
  });
});
