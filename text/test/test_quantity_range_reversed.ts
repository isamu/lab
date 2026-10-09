import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { reversedAmountRanges, type AmountRangeWords, type RangeAmount } from "../packages/chaff/src/structure/amount-range.ts";
import { quantityRangeEnds } from "../packages/chaff/src/structure/quantity-range.ts";
import { measuredValues, type MeasureUnit } from "../packages/chaff/src/facts/measures.ts";

// 測った量の範囲の上限が下限より小さい（quantity-range-reversed）。

const RULE = "quantity-range-reversed";

const found = (source: string, adapter: LanguageAdapter = en): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "technical/spec")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["range"]));

const doc = (...lines: string[]): string => ["# Spec", "", ...lines, ""].join("\n");

describe("quantity-range-reversed, Japanese", () => {
  it("a range with its unit written once, the second end smaller", () => {
    assert.deepEqual(found(doc("重さ：5〜2 kg"), ja), ["5〜2 kg"]);
    assert.deepEqual(found(doc("幅：30〜10 cm"), ja), ["30〜10 cm"]);
    assert.deepEqual(found(doc("重さ：2〜5 kg"), ja), []);
  });

  it("both ends written with the unit", () => {
    assert.deepEqual(found(doc("幅：30 cm〜10 cm"), ja), ["30 cm〜10 cm"]);
    assert.deepEqual(found(doc("幅：10 cm〜30 cm"), ja), []);
  });

  it("negative ends are read with their sign", () => {
    assert.deepEqual(found(doc("動作温度：40〜-10℃"), ja), ["40〜-10℃"]);
    assert.deepEqual(found(doc("使用温度範囲：-10〜-40℃（凍結しないこと）"), ja), ["-10〜-40℃"]);
    assert.deepEqual(found(doc("使用温度範囲：-40〜-10℃"), ja), []);
    assert.deepEqual(found(doc("使用温度範囲：-10〜40℃（凍結しないこと）"), ja), []);
    assert.deepEqual(found(doc("保存温度：−20〜60℃"), ja), []);
  });

  it("から … まで joins a range; a word of change or of descending order does not", () => {
    assert.deepEqual(found(doc("使用できる温度は40℃から10℃までです。"), ja), ["40℃から10℃"]);
    assert.deepEqual(found(doc("40℃から10℃まで冷却します。"), ja), []);
    assert.deepEqual(found(doc("カウントダウン：10〜0秒"), ja), []);
    assert.deepEqual(found(doc("重い順に 50〜10 kg の箱を並べます。"), ja), []);
  });

  it("two quantities labelled 下限 and 上限", () => {
    assert.deepEqual(found(doc("荷重：下限50 kg・上限20 kg"), ja), ["50 kg・上限20 kg"]);
    assert.deepEqual(found(doc("荷重：下限20 kg・上限50 kg"), ja), []);
  });

  it("different units, or a clock time, are not compared", () => {
    assert.deepEqual(found(doc("長さ：5 m〜20 cm"), ja), []);
    assert.deepEqual(found(doc("受付：平日 9時〜17時、夜間 22時〜6時"), ja), []);
  });
});

describe("quantity-range-reversed, English", () => {
  it("a range mark or to between two quantities, the second smaller", () => {
    assert.deepEqual(found(doc("Weight: 5–2 kg")), ["5–2 kg"]);
    assert.deepEqual(found(doc("Operating temperature: -10 to -40 °C (no freezing)")), ["-10 to -40 °C"]);
    assert.deepEqual(found(doc("Operating temperature: 40 to -10 °C")), ["40 to -10 °C"]);
    assert.deepEqual(found(doc("Length: 5 m – 2 m")), ["5 m – 2 m"]);
  });

  it("a range that rises is silent, negative start included", () => {
    assert.deepEqual(found(doc("Operating temperature: −10 to 40 °C")), []);
    assert.deepEqual(found(doc("Operating temperature: -10 to 40 °C")), []);
    assert.deepEqual(found(doc("Storage temperature: -40 to -10 °C")), []);
    assert.deepEqual(found(doc("Weight: 2–5 kg")), []);
  });

  it("a hyphen right after a number is a range mark, not a minus sign", () => {
    assert.deepEqual(found(doc("Weight: 5-10 kg")), []);
    assert.deepEqual(found(doc("Weight: 12-5 kg")), ["12-5 kg"]);
  });

  it("10 and a minus sign before a number is a power of ten written flat", () => {
    assert.deepEqual(found(doc("Angstrom: A unit of length equal to 10-8 cm.")), []);
    assert.deepEqual(found(doc("Weight: 110-8 kg")), ["110-8 kg"]);
  });

  it("a change or a descending order in the sentence keeps the pair silent", () => {
    assert.deepEqual(found(doc("The oven is cooled from 200 °C to 50 °C before cleaning.")), []);
    assert.deepEqual(found(doc("The probe moves from 100 m down to 10 m.")), []);
    assert.deepEqual(found(doc("Boxes are stacked in descending order, 50–10 kg.")), []);
  });

  it("two quantities labelled min and max", () => {
    assert.deepEqual(found(doc("Load: min 50 kg, max 20 kg")), ["50 kg, max 20 kg"]);
    assert.deepEqual(found(doc("Load: min 20 kg, max 50 kg")), []);
  });

  it("different units, and numbers without a unit, are not compared", () => {
    assert.deepEqual(found(doc("Weight: 5 kg to 2 lb")), []);
    assert.deepEqual(found(doc("Pages 30–10 of the manual")), []);
    assert.deepEqual(found(doc("Humidity: 85–20% RH")), []);
  });
});

describe("reversedAmountRanges with signed bare numbers", () => {
  const words: AmountRangeWords = {
    connectors: ["〜", "-", "to"],
    openers: [],
    closers: [],
    changes: [],
    lowers: [],
    uppers: [],
    links: [],
    scales: [],
    number: "(?:[-−－](?=[0-9]))?[0-9]+",
  };
  const end = (text: string, written: string, value: number): RangeAmount => {
    const offset = text.lastIndexOf(written);
    return { offset, end: offset + written.length, currency: "℃", value, scale: undefined, position: "after" };
  };
  const ranges = (text: string, written: string, value: number): string[] =>
    reversedAmountRanges(text, [end(text, written, value)], words).map((issue) => String(issue.values["range"]));

  it("reads the sign of the bare end", () => {
    assert.deepEqual(ranges("-10〜-40℃", "-40℃", -40), ["-10〜-40℃"]);
    assert.deepEqual(ranges("-40〜-10℃", "-10℃", -10), []);
    assert.deepEqual(ranges("−10〜−40℃", "−40℃", -40), ["−10〜−40℃"]);
    assert.deepEqual(ranges("10〜-40℃", "-40℃", -40), ["10〜-40℃"]);
  });

  it("takes a hyphen after a digit as the joint", () => {
    assert.deepEqual(ranges("5-10℃", "10℃", 10), []);
    assert.deepEqual(ranges("15-10℃", "10℃", 10), ["15-10℃"]);
  });

  it("reads nothing from an empty or unsigned text", () => {
    assert.deepEqual(reversedAmountRanges("", [], words), []);
    assert.deepEqual(ranges("abc 10℃", "10℃", 10), []);
    assert.deepEqual(ranges("- 10℃", "10℃", 10), []);
  });
});

describe("quantityRangeEnds", () => {
  const unit = (pattern: string, before = false): MeasureUnit => ({ pattern, dimension: "unit-length", factors: [1], zero: 0, before, context: [] });
  const UNITS = [unit("cm"), unit("t"), unit("°C"), unit("大さじ", true)];
  const endsOf = (text: string): RangeAmount[] => quantityRangeEnds(text, measuredValues(text, UNITS));
  const values = (text: string): number[] => endsOf(text).map((end) => end.value);

  it("keeps a quantity whose unit stands alone, keyed by its unit", () => {
    assert.deepEqual(values("5–2 cm"), [2]);
    assert.deepEqual(endsOf("5–2 cm")[0]?.currency, "unit-length:cm");
    assert.deepEqual(endsOf("大さじ2")[0]?.position, "before");
    assert.deepEqual(values("-10〜-40 °C"), [-40]);
  });

  it("drops a Latin unit that runs into a word, and a power of ten written flat", () => {
    assert.deepEqual(values("40 to 10 °C"), [10]);
    assert.deepEqual(values("equal to 10-8 cm"), []);
    assert.deepEqual(values("equal to 10−8 cm"), []);
    assert.deepEqual(values("110-8 cm"), [8]);
  });

  it("reads nothing from nothing", () => {
    assert.deepEqual(quantityRangeEnds("", []), []);
    assert.deepEqual(values("no numbers here"), []);
  });
});
