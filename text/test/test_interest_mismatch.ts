import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { interestMismatches, type InterestWords } from "../packages/chaff/src/structure/interest.ts";
import { linesOf } from "../packages/chaff/src/structure/lines.ts";

// 利息が残高に利率を掛けた額と合わない（interest-mismatch）。例の明細はすべて自作。

const RULE = "interest-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;
const doc = (lines: readonly string[]): string => ["## お利息", "", ...lines, ""].join("\n");
const enDoc = (lines: readonly string[]): string => ["## Interest", "", ...lines, ""].join("\n");
const WORDS: InterestWords = {
  labels: [
    { pattern: "interest", role: "interest" },
    { pattern: "balance", role: "base" },
    { pattern: "rate", role: "rate" },
  ],
  periods: [],
};

describe("interest-mismatch: ja, a calculation written on one line", () => {
  it("points at the interest that is not the balance times the rate", () => {
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高400,000円 × 利率0.01% ＝ 400円"])), [
      "利息「400円」が、残高「400,000円」に利率0.01%を掛けた額（40円）と合いません",
    ]);
    assert.deepEqual(findingsOf(doc(["利息：元本1,000,000円 × 利率0.02% ＝ 利息300円"])), [
      "利息「300円」が、残高「1,000,000円」に利率0.02%を掛けた額（200円）と合いません",
    ]);
  });
  it("says nothing when the interest is the balance times the rate, rounded down, to nearest or up", () => {
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高400,000円 × 利率0.10% ＝ 400円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高1,234,567円 × 利率0.001% ＝ 12円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高1,234,567円 × 利率0.001% ＝ 13円。"])), []);
  });
  it("does not read a line marked after tax, and reads one marked before tax", () => {
    assert.deepEqual(findingsOf(doc(["税引後のお利息：対象残高400,000円 × 利率0.10% ＝ 319円"])), []);
    assert.equal(findingsOf(doc(["税引前のお利息：対象残高400,000円 × 利率0.10% ＝ 319円"])).length, 1);
  });
  it("uses a rate marked as annual only when the interest is for the year too, never converted to a month", () => {
    assert.deepEqual(findingsOf(doc(["当月のお利息：対象残高400,000円 × 年利0.10% ＝ 33円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息：対象残高400,000円 × 利率 年0.10% ＝ 33円"])), []);
    assert.deepEqual(findingsOf(doc(["年間のお利息：対象残高400,000円 × 年利0.10% ＝ 400円"])), []);
    assert.equal(findingsOf(doc(["年間のお利息：対象残高400,000円 × 年利0.10% ＝ 33円"])).length, 1);
  });
  it("does not read a line with no interest word, no balance word, no rate, days multiplied in, or two units", () => {
    assert.deepEqual(findingsOf(doc(["手数料の計算：対象残高400,000円 × 利率0.01% ＝ 400円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息の計算：400,000円 × 利率0.01% ＝ 400円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息400円 ＝ 対象残高400,000円 × 利率0.01%"])), []);
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高400,000円 × 0.01 ＝ 400円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高400,000円 × 利率0.10% × 30/365 ＝ 32円"])), []);
    assert.deepEqual(findingsOf(doc(["お利息の計算：対象残高400,000円 × 利率0.01% ＝ $4.00"])), []);
  });
  it("does not read a calculation inside a table", () => {
    assert.deepEqual(findingsOf(doc(["| 計算 |", "| --- |", "| お利息：対象残高400,000円 × 利率0.01% ＝ 400円 |"])), []);
  });
});

describe("interest-mismatch: en, a calculation written on one line", () => {
  it("points at the interest that is not the balance times the rate", () => {
    assert.deepEqual(findingsOf(enDoc(["Interest for the month: average balance $3,600.00 × rate 0.50% = $1.80"]), en), [
      "The interest $1.80 is not the balance $3,600.00 at 0.50% ($18.00)",
    ]);
  });
  it("says nothing when it is, to the cent", () => {
    assert.deepEqual(findingsOf(enDoc(["Interest for the month: average balance $3,600.00 × rate 0.05% = $1.80"]), en), []);
    assert.deepEqual(findingsOf(enDoc(["Interest for the month: average balance $12,345.67 × rate 0.10% = $12.35."]), en), []);
  });
  it("an amount written with cents is rounded to the cent only", () => {
    assert.equal(findingsOf(enDoc(["Interest for the month: average balance $12,400.00 × rate 0.10% = $12.00"]), en).length, 1);
  });
  it("does not read net interest, or an APR on a line that names no matching period", () => {
    assert.deepEqual(findingsOf(enDoc(["Net interest: average balance $3,600.00 × rate 0.05% = $1.50"]), en), []);
    assert.deepEqual(findingsOf(enDoc(["Interest after tax: average balance $3,600.00 × rate 0.05% = $1.50"]), en), []);
    assert.deepEqual(findingsOf(enDoc(["Interest for the month: average balance $3,600.00 × rate 0.60% APR = $1.80"]), en), []);
    assert.equal(findingsOf(enDoc(["Interest for the year: average balance $3,600.00 × rate 0.60% APR = $1.80"]), en).length, 1);
    assert.deepEqual(findingsOf(enDoc(["Interest for the year: average balance $3,600.00 × rate 0.60% APR = $21.60"]), en), []);
  });
  it("does not take interest rate for the interest itself", () => {
    assert.deepEqual(findingsOf(enDoc(["Charge: balance $3,600.00 × interest rate 0.50% = $1.80"]), en), []);
  });
});

describe("interest-mismatch: the written forms around the figures", () => {
  it("reads a full-width percent sign", () => {
    assert.equal(findingsOf(doc(["年間のお利息：対象残高400,000円 × 年利0.10％ ＝ 33円"])).length, 1);
  });
  it("puts the finding on the amount, not on a bracketed note before it", () => {
    const line = "Interest for the month: average balance $3,600.00 × rate 0.50% = (posted 2026-01-31) $1.80";
    const [issue] = interestMismatches(linesOf(line), WORDS);
    assert.equal(issue === undefined ? undefined : line.slice(issue.offset), "$1.80");
  });
  it("skips a line that names interest after tax, not one that mentions something else net", () => {
    const line = "Interest for the month, net deposits only: average balance $3,600.00 × rate 0.50% = $1.80";
    assert.equal(findingsOf(enDoc([line]), en).length, 1);
  });
});
