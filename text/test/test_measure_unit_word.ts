import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lineHasContext, standsAsUnitWord } from "../packages/chaff/src/facts/unit-word.ts";
import { approximateTolerance } from "../packages/chaff/src/facts/approximate-tolerance.ts";
import type { Measured } from "../packages/chaff/src/facts/measures.ts";

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
