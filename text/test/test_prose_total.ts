import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { phraseSpans, proseTotalMismatches } from "../packages/chaff/src/structure/prose-total.ts";
import type { Amount } from "../packages/chaff/src/structure/total.ts";

// 文の中の合計と内訳（total-mismatch の文の側）。木を作らずに、金額の位置を直に渡して確かめる。

const WORDS = {
  totals: ["合計", "合計で", "a total of", "total of"],
  breakdowns: ["内訳：", "made up of"],
  discounts: ["値引き", "discount"],
  joiners: [" and "],
};

/** source の中の金額を、書いた順に単位付きで拾う（テスト用の小さな読み方: 3桁区切りの数と、前の $ か後ろの 円）。 */
const amountsIn = (source: string): Amount[] =>
  [...source.matchAll(/\$?(\d{1,3}(?:,\d{3})*)(円)?/gu)].map((match) => {
    const number = match[1] ?? "";
    const offset = match.index + (match[0].startsWith("$") ? 1 : 0);
    return { offset, end: offset + number.length + (match[2] === undefined ? 0 : 1), value: Number(number.replaceAll(",", "")), unit: match[2] ?? "$" };
  });

const mismatches = (source: string): string[] =>
  proseTotalMismatches(source, [{ start: 0, end: source.length }], amountsIn(source), WORDS).map(
    (issue) => `${String(issue.values["written"])}≠${String(issue.values["sum"])}`,
  );

describe("phraseSpans", () => {
  it("finds each phrase, the longest where two start at the same place, ignoring case", () => {
    assert.deepEqual(phraseSpans("内訳は、合計で9", 10, ["合計", "合計で"]), [{ start: 14, end: 17 }]);
    assert.deepEqual(phraseSpans("For A Total Of $9", 0, ["a total of"]), [{ start: 4, end: 14 }]);
  });

  it("does not read an English phrase inside a longer word", () => {
    assert.deepEqual(phraseSpans("a subtotal of $3", 0, ["total of"]), []);
    assert.deepEqual(phraseSpans("the total of $3", 0, ["total of"]), [{ start: 4, end: 12 }]);
  });

  it("finds nothing in empty text or for empty phrases, and reads phrases as plain text", () => {
    assert.deepEqual(phraseSpans("", 0, ["合計"]), []);
    assert.deepEqual(phraseSpans("合計", 0, [""]), []);
    assert.deepEqual(phraseSpans("a (total) of", 0, ["(total)"]), [{ start: 2, end: 9 }]);
  });
});

describe("proseTotalMismatches", () => {
  it("compares a total after its items, and a total before its breakdown", () => {
    assert.deepEqual(mismatches("保守費60,000円、運用費30,000円、合計100,000円"), ["100,000円≠90,000円"]);
    assert.deepEqual(mismatches("$8, made up of $5 and $2"), ["$8≠$7"]);
    assert.deepEqual(mismatches("$8, made up of $6 and $2"), []);
  });

  it("says nothing with no sentence, no amount, too few items, or no phrase", () => {
    assert.deepEqual(proseTotalMismatches("合計100円", [], amountsIn("合計100円"), WORDS), []);
    assert.deepEqual(proseTotalMismatches("", [{ start: 0, end: 0 }], [], WORDS), []);
    assert.deepEqual(mismatches("保守費60,000円、合計100,000円"), []);
    assert.deepEqual(mismatches("保守費60,000円、運用費30,000円、100,000円"), []);
    assert.deepEqual(
      proseTotalMismatches("A 1円、B 2円、合計9円", [{ start: 0, end: 13 }], amountsIn("A 1円、B 2円、合計9円"), {
        totals: [],
        breakdowns: [],
        discounts: [],
        joiners: [],
      }),
      [],
    );
  });

  it("needs the total right after the phrase: other words between are not a total", () => {
    assert.deepEqual(mismatches("A 1円、B 2円、合計の上限は9円"), []);
    assert.deepEqual(mismatches("A $1, B $2, a total of: $9"), ["$9≠$3"]);
  });

  it("reports one total once even when both readings reach it", () => {
    assert.deepEqual(mismatches("A $1, B $2, a total of $9, made up of $1 and $2"), ["$9≠$3"]);
  });

  it("subtracts an item only after a discount word, so an item that happens to make the total when taken away is still a mismatch", () => {
    assert.deepEqual(mismatches("A $100 and B $20, a total of $80"), ["$80≠$120"]);
    assert.deepEqual(mismatches("A $100 and a discount of $20, a total of $80"), []);
    assert.deepEqual(mismatches("本体100,000円、値引き10,000円、合計90,000円"), []);
  });

  it("does not take an amount joined to another item as the total a breakdown adds up to", () => {
    assert.deepEqual(mismatches("a $1,000 fee and a subscription, made up of $600 and $300"), []);
    assert.deepEqual(mismatches("a $1,000 fee, made up of $600 and $300"), ["$1,000≠$900"]);
  });

  it("allows a comma between the total phrase and the amount", () => {
    assert.deepEqual(mismatches("保守費60,000円、運用費30,000円、合計、100,000円"), ["100,000円≠90,000円"]);
  });
});
