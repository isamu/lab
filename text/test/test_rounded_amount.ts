import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { coarsestStep, displayStep, roundingAllowance } from "../packages/chaff/src/structure/rounded-amount.ts";
import type { Amount } from "../packages/chaff/src/structure/total.ts";

// 丸めた単位で書いた金額の最後の桁一つ分（total-mismatch が丸めのずれを許す幅）。

const JA = ["千円", "百万円", "億円"];
const EN = ["million", "billion"];

/** source の中の written の位置に、value の金額を置く。 */
const at = (source: string, written: string, value: number, unit = "円"): Amount => {
  const offset = source.indexOf(written);
  return { offset, end: offset + written.length, value, unit };
};

const close = (actual: number | undefined, expected: number): void => {
  assert.ok(actual !== undefined && Math.abs(actual - expected) < 1e-6 * expected, `${String(actual)} is not ${String(expected)}`);
};

describe("displayStep", () => {
  it("is one last digit in the rounded unit", () => {
    const source = "総額6,655百万円、3.1億円、801千円";
    close(displayStep(source, at(source, "6,655百万円", 6_655_000_000), JA), 1_000_000);
    close(displayStep(source, at(source, "3.1億円", 310_000_000), JA), 10_000_000);
    close(displayStep(source, at(source, "801千円", 801_000), JA), 1000);
  });

  it("reads an English unit right after the number", () => {
    const source = "a total of $5.6 million and $3 billion";
    close(displayStep(source, at(source, "5.6", 5.6, "$"), EN), 0.1);
    close(displayStep(source, at(source, "3", 3, "$"), EN), 1);
  });

  it("reads full-width digits", () => {
    const source = "総額６，６５５百万円";
    close(displayStep(source, at(source, "６，６５５百万円", 6_655_000_000), JA), 1_000_000);
  });

  it("is undefined for an amount not in a rounded unit, a word that only begins with the unit, kanji numerals or zero", () => {
    const source = "81万円、800,001円、$5 millionaires、三百万円、0百万円";
    assert.equal(displayStep(source, at(source, "81万円", 810_000), JA), undefined);
    assert.equal(displayStep(source, at(source, "800,001円", 800_001), JA), undefined);
    assert.equal(displayStep(source, at(source, "5", 5, "$"), EN), undefined);
    assert.equal(displayStep(source, at(source, "三百万円", 3_000_000), JA), undefined);
    assert.equal(displayStep(source, at(source, "0百万円", 0), JA), undefined);
    assert.equal(displayStep(source, at(source, "81万円", 810_000), []), undefined);
  });
});

describe("coarsestStep", () => {
  const source = "A 3.1億円、B 2百万円、C 500円";
  const tenth = at(source, "3.1億円", 310_000_000);
  const million = at(source, "2百万円", 2_000_000);
  const plain = at(source, "500円", 500);

  it("is the coarsest last digit when every amount is rounded", () => {
    close(coarsestStep(source, [tenth, million], JA), 10_000_000);
  });

  it("is 0 when one amount is not rounded, or there are none", () => {
    assert.equal(coarsestStep(source, [tenth, plain], JA), 0);
    assert.equal(coarsestStep(source, [], JA), 0);
  });
});

describe("roundingAllowance", () => {
  it("is one step per item but one, and nothing for one item or none", () => {
    assert.equal(roundingAllowance(100, 3), 200);
    assert.equal(roundingAllowance(100, 2), 100);
    assert.equal(roundingAllowance(100, 1), 0);
    assert.equal(roundingAllowance(100, 0), 0);
    assert.equal(roundingAllowance(0, 5), 0);
  });
});
