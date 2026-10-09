import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 面積の単位（unit-area）を unit-mismatch が換算して比べる。

const found = (lines: readonly string[], adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", ["# T", "", ...lines].join("\n"), adapter), loadRules(language), { "unit-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "unit-mismatch")
    .map((finding) => `${String(finding.values["label"])}:${String(finding.values["value"])}≠${String(finding.values["other"])}`);

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

  it("畳 is not read as an area, and an area is not compared with a length", () => {
    assert.deepEqual(foundJa("居室：10㎡", "", "居室：6畳"), []);
    assert.deepEqual(foundJa("広さ：10㎡", "", "広さ：10m"), []);
    assert.deepEqual(foundEn("Size: 10 m²", "", "Size: 10 m"), []);
  });
});
