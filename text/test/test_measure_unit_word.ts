import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineHasContext, runsIntoWord, standsAsUnitWord } from "../packages/chaff/src/facts/unit-word.ts";
import { approximateTolerance } from "../packages/chaff/src/facts/approximate-tolerance.ts";
import { measuredValues, type Measured } from "../packages/chaff/src/facts/measures.ts";
import { measureUnitsOf } from "../packages/chaff/src/facts/measure-units.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 文脈の要る英字の単位（"in"）を単位として読むかと、目安の量（約1.2kg）の合うとみなす差。

describe("lineHasContext", () => {
  it("finds a Latin word only as a whole word, in any case", () => {
    assert.equal(lineHasContext("A 15.6 in Display", ["display"]), true);
    assert.equal(lineHasContext("12 x 8 in", ["x"]), true);
    assert.equal(lineHasContext("a box of 8 in", ["x"]), false);
    assert.equal(lineHasContext("the displays are 15 in", ["display"]), false);
    assert.equal(lineHasContext("x", ["x"]), true);
  });

  it("finds other words as a run of characters", () => {
    assert.equal(lineHasContext("オーブンを180度に", ["オーブン"]), true);
    assert.equal(lineHasContext("12×8 in", ["×"]), true);
    assert.equal(lineHasContext("ハンドルを90度", ["オーブン"]), false);
  });

  it("an empty line or no words has no context", () => {
    assert.equal(lineHasContext("", ["display"]), false);
    assert.equal(lineHasContext("a display", []), false);
  });
});

describe("standsAsUnitWord", () => {
  it("a context-needing Latin unit stands alone", () => {
    assert.equal(standsAsUnitWord("in", true, ""), true);
    assert.equal(standsAsUnitWord("in", true, " display"), true);
    assert.equal(standsAsUnitWord("in", true, ", small"), true);
    assert.equal(standsAsUnitWord("in", true, ")"), true);
    assert.equal(standsAsUnitWord("in", true, ". The"), true);
  });

  it("is not a unit inside a word, before a number or in a hyphenated word", () => {
    assert.equal(standsAsUnitWord("in", true, "terns"), false);
    assert.equal(standsAsUnitWord("in", true, " 3 users"), false);
    assert.equal(standsAsUnitWord("in", true, "3"), false);
    assert.equal(standsAsUnitWord("in", true, " ３"), false);
    assert.equal(standsAsUnitWord("in", true, "-1"), false);
    assert.equal(standsAsUnitWord("in", true, "-wide"), false);
  });

  it("units without context, and non-Latin units, are not judged here", () => {
    assert.equal(standsAsUnitWord("m", false, "iners"), true);
    assert.equal(standsAsUnitWord("度", true, "で10分"), true);
    assert.equal(standsAsUnitWord("度", true, "10分"), true);
  });
});

describe("runsIntoWord", () => {
  it("a unit ending in a Latin letter, followed by a Latin letter, is the start of a word", () => {
    assert.equal(runsIntoWord("t", "o 70"), true);
    assert.equal(runsIntoWord("t", "ons"), true);
    assert.equal(runsIntoWord("mm", "Hg"), true);
    assert.equal(runsIntoWord("g/dL", "s"), true);
    assert.equal(runsIntoWord("m", "é"), true);
  });

  it("stands as a unit before a space, punctuation, a digit, a non-Latin letter or the end", () => {
    assert.equal(runsIntoWord("t", ""), false);
    assert.equal(runsIntoWord("m", " long"), false);
    assert.equal(runsIntoWord("in", ". display"), false);
    assert.equal(runsIntoWord("g", "/dL"), false);
    assert.equal(runsIntoWord("m", "2"), false);
    assert.equal(runsIntoWord("ha", "を"), false);
    assert.equal(runsIntoWord("m", "-wide"), false);
  });

  it("a unit that does not end in a Latin letter is not judged", () => {
    assert.equal(runsIntoWord("℃", "elsius"), false);
    assert.equal(runsIntoWord("m³", "s"), false);
    assert.equal(runsIntoWord("sq. ft.", "x"), false);
    assert.equal(runsIntoWord("", "abc"), false);
  });
});

describe("measuredValues: a Latin unit ends at a word boundary", () => {
  const read = (text: string, adapter: LanguageAdapter = en): string[] =>
    measuredValues(text, measureUnitsOf(buildDocument("t.md", text, adapter))).map((value) => text.slice(value.start, value.end));

  it("does not read the first letter of the next word as a unit", () => {
    assert.deepEqual(read("Between 20 to 70 people."), []);
    assert.deepEqual(read("It weighs 3 tons."), []);
    assert.deepEqual(read("5 miners"), []);
    assert.deepEqual(read("120 mmHg"), []);
    assert.deepEqual(read("100mA"), []);
    assert.deepEqual(read("約560haを一般に", ja), []);
  });

  it("does not fall back to a shorter unit when the longest one runs into a word", () => {
    assert.deepEqual(read("2 g/dLs"), []);
    assert.deepEqual(read("3 kgs"), []);
  });

  it("reads a unit followed by a space, punctuation or the end", () => {
    assert.deepEqual(read("5 m long"), ["5 m"]);
    assert.deepEqual(read("5 mm"), ["5 mm"]);
    assert.deepEqual(read("5 meters"), ["5 meters"]);
    assert.deepEqual(read("10 to 20 kg"), ["20 kg"]);
    assert.deepEqual(read("40 to 10 t"), ["10 t"]);
    assert.deepEqual(read("2 g/dL."), ["2 g/dL"]);
    assert.deepEqual(read("4 in. display"), ["4 in"]);
    assert.deepEqual(read("3 kg, 5 min)"), ["3 kg", "5 min"]);
    assert.deepEqual(read("重さは5kgです。", ja), ["5kg"]);
  });
});

const measured = (amount: number, factors: readonly number[], decimals = String(amount).split(".")[1]?.length ?? 0): Measured => ({
  start: 0,
  end: 1,
  kind: "quantity",
  key: String(amount),
  unit: "",
  dimension: "unit-mass",
  factors,
  zero: 0,
  amount,
  decimals,
});

describe("approximateTolerance", () => {
  const base = { relative: 0.02, absolute: 0 };

  it("widens to half the last written digit, in the base unit", () => {
    assert.deepEqual(approximateTolerance(base, [measured(1.2, [1000])]), { relative: 0.02, absolute: 50 });
    assert.deepEqual(approximateTolerance(base, [measured(12, [1])]), { relative: 0.02, absolute: 0.5 });
    assert.deepEqual(approximateTolerance(base, [measured(-1.25, [1])]), { relative: 0.02, absolute: 0.005 });
    assert.deepEqual(approximateTolerance(base, [measured(1.2, [1000], 2)]), { relative: 0.02, absolute: 5 });
  });

  it("takes the widest of the given values and factors", () => {
    assert.deepEqual(approximateTolerance(base, [measured(1.2, [1000]), measured(3, [1])]), { relative: 0.02, absolute: 500 * 0.1 });
    assert.deepEqual(approximateTolerance(base, [measured(1, [1000, 1024])]), { relative: 0.02, absolute: 512 });
  });

  it("no approximate value, or a wider base, keeps the base", () => {
    assert.deepEqual(approximateTolerance(base, []), base);
    assert.deepEqual(approximateTolerance({ relative: 0, absolute: 8 }, [measured(1.2, [1])]), { relative: 0, absolute: 8 });
  });
});
