import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { measuredAmounts, type MeasureMarks, type SummedMeasure } from "../packages/chaff/src/structure/measured-amounts.ts";

// 足してよい、単位の付いた量（measuredAmounts）。total-mismatch が表と箇条書きの合計で足す。

const measures: SummedMeasure[] = [
  { pattern: "mg", dimension: "mass", factors: [0.001] },
  { pattern: "g", dimension: "mass", factors: [1] },
  { pattern: "kg", dimension: "mass", factors: [1000] },
  { pattern: "mL", dimension: "volume", factors: [0.001] },
  { pattern: "L", dimension: "volume", factors: [1] },
  { pattern: "cup", dimension: "volume", factors: [0.24, 0.25] },
  { pattern: "m", dimension: "length", factors: [1] },
];

const marks: MeasureMarks = {
  roughBefore: ["約", "about"],
  roughAfter: ["程度", "or so"],
  connectors: ["〜", "-"],
  perMarks: ["/", "あたり", "per"],
};

const read = (source: string, known: { offset: number; end: number; value: number; unit: string }[] = []): string[] =>
  measuredAmounts(source, measures, marks, known).map(
    (amount) =>
      `${source.slice(amount.offset, amount.end)}=${String(Math.round(amount.value * 1000) / 1000)}${amount.unit.replace(/\?\d+$/u, "?")}×${String(amount.scale ?? "-")}`,
  );

describe("measuredAmounts", () => {
  it("a number and a unit, converted to the smallest unit of its kind, with the scale of the written unit", () => {
    assert.deepEqual(read("300mg と 0.5 g、1kg"), ["300mg=300mass×1", "0.5 g=500mass×1000", "1kg=1000000mass×1000000"]);
    assert.deepEqual(read("200 mL and 1.5 L"), ["200 mL=200volume×1", "1.5 L=1500volume×1000"]);
    assert.deepEqual(read("３００mg"), ["３００mg=300mass×1"]);
  });

  it("the longest unit wins and case is kept: mg is not m, ML is not mL", () => {
    assert.deepEqual(read("5 mg"), ["5 mg=5mass×1"]);
    assert.deepEqual(read("5 ML"), []);
  });

  it("a unit that starts a longer word, or a number inside a code, is not a measure", () => {
    assert.deepEqual(read("5 miners, 3 games, v2 g, A4 m"), []);
    assert.deepEqual(read("2.5gです"), []);
  });

  it("a rough, ranged, per-unit or ambiguous amount, or the measure a price is per, is read but cannot be added: its unit is marked", () => {
    assert.deepEqual(read("約300mg"), ["300mg=300mass?×-"]);
    assert.deepEqual(read("about 300 mg"), ["300 mg=300mass?×-"]);
    assert.deepEqual(read("300mg程度"), ["300mg=300mass?×-"]);
    assert.deepEqual(read("300 mg or so"), ["300 mg=300mass?×-"]);
    assert.deepEqual(read("200〜300mg"), ["300mg=300mass?×-"]);
    assert.deepEqual(read("200 - 300 mg"), ["300 mg=300mass?×-"]);
    assert.deepEqual(read("300mg/錠"), ["300mg=300mass?×-"]);
    assert.deepEqual(read("300mgあたり"), ["300mg=300mass?×-"]);
    assert.deepEqual(read("300 mg per tablet"), ["300 mg=300mass?×-"]);
    assert.deepEqual(read("2 cup"), ["2 cup=2volume?×-"]);
    assert.deepEqual(read("$3 / 200 g"), ["200 g=200mass?×-"]);
  });

  it("a list bullet, or a word that only starts or ends with a mark, is not a mark", () => {
    assert.deepEqual(read("- 300 mg"), ["300 mg=300mass×1"]);
    assert.deepEqual(read("Tabout 300 mg"), ["300 mg=300mass×1"]);
    assert.deepEqual(read("300 mg personal"), ["300 mg=300mass×1"]);
  });

  it("an amount the tree already read is not read again", () => {
    assert.deepEqual(read("300mg", [{ offset: 0, end: 5, value: 300, unit: "mg" }]), []);
  });

  it("no units, no amounts", () => {
    assert.deepEqual(measuredAmounts("300 mg", [], marks, []), []);
    assert.deepEqual(read(""), []);
  });
});
