import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { countedAmounts, type SummedCounter } from "../packages/chaff/src/structure/counted-amounts.ts";

// 足してよい助数詞の付いた数（countedAmounts）。total-mismatch が木の数量に加える。

const counters: SummedCounter[] = [
  { pattern: "単位", unit: "単位" },
  { pattern: "コマ", unit: "コマ" },
  { pattern: "credits", unit: "credit" },
  { pattern: "credit", unit: "credit" },
];

const read = (source: string, known: { offset: number; end: number; value: number; unit: string }[] = []): string[] =>
  countedAmounts(source, counters, known).map((amount) => `${source.slice(amount.offset, amount.end)}=${String(amount.value)}${amount.unit}`);

describe("countedAmounts", () => {
  it("a number followed by a counter, with or without one space, in half- or full-width digits", () => {
    assert.deepEqual(read("必修16単位、選択４コマ"), ["16単位=16単位", "４コマ=4コマ"]);
    assert.deepEqual(read("3 credits and 1 credit, 1,200 Credits"), ["3 credits=3credit", "1 credit=1credit", "1,200 Credits=1200credit"]);
    assert.deepEqual(read("1.5単位"), ["1.5単位=1.5単位"]);
  });

  it("a counter that is part of a longer word, an ordinal, or a number inside a code is not read", () => {
    assert.deepEqual(read("1単位あたり、3単位目、第2単位、4コマ漫画、3 creditsworth"), []);
    assert.deepEqual(read("v2単位、A4コマ、1.2.3単位"), []);
    assert.deepEqual(read("3 credit-bearing courses, 2 credit_hours"), []);
  });

  it("a counter with no number before it is not read: a caption", () => {
    assert.deepEqual(read("単位：千円"), []);
    assert.deepEqual(read("千円単位で丸める"), []);
  });

  it("a number the tree already read is not read twice", () => {
    assert.deepEqual(read("16単位", [{ offset: 0, end: 4, value: 16, unit: "単位" }]), []);
  });

  it("empty input and no counters read nothing", () => {
    assert.deepEqual(read(""), []);
    assert.deepEqual(countedAmounts("16単位", [], []), []);
    assert.deepEqual(read("単位"), []);
  });
});
