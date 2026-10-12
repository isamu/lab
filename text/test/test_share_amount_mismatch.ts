import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { shareMatches, shareRateIn } from "../packages/chaff/src/structure/share-amount.ts";

// 負担額が合計に負担の割合を掛けた額と合わない（share-amount-mismatch）。例の明細はすべて自作。

const RULE = "share-amount-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;
const doc = (lines: readonly string[]): string => [...lines, ""].join("\n");

const JA_HEAD = ["| 合計 | 負担割合 | 負担額 |", "| --- | --- | --- |"];
const EN_HEAD = ["| Total charges | Patient share | Amount paid |", "| --- | --- | --- |"];

describe("share-amount-mismatch: the rate written as 30% or 3割", () => {
  it("reads a percentage and tenths (3割 is 30%)", () => {
    assert.equal(shareRateIn("30%")?.value, 30);
    assert.equal(shareRateIn("３割")?.value, 30);
    assert.equal(shareRateIn("1割")?.value, 10);
    assert.equal(shareRateIn("20 %")?.value, 20);
    assert.equal(shareRateIn("12.5%")?.value, 12.5);
  });
  it("reads nothing else as a share", () => {
    ["", "3", "10割", "100%", "0%", "3割負担", "約3割", "3,000円", "abc"].forEach((text) => assert.equal(shareRateIn(text), undefined, text));
  });
});

describe("share-amount-mismatch: the arithmetic", () => {
  it("the rate of the total, rounded down, to nearest or up, to the unit", () => {
    assert.equal(shareMatches(3000, 10000, 30, undefined), true);
    assert.equal(shareMatches(1037, 3456, 30, undefined), true);
    assert.equal(shareMatches(1036, 3456, 30, undefined), true);
    assert.equal(shareMatches(1040, 3456, 30, undefined), false);
  });
  it("a unit with a rounding step may be rounded to it (10 yen)", () => {
    assert.equal(shareMatches(1040, 3456, 30, 10), true);
    assert.equal(shareMatches(1030, 3456, 30, 10), true);
    assert.equal(shareMatches(1050, 3456, 30, 10), false);
    assert.equal(shareMatches(3300, 10000, 30, 10), false);
  });
});

describe("share-amount-mismatch: a table of total, share and amount", () => {
  it("ja: points at the amount that is not the share of the total", () => {
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 10,000円 | 3割 | 3,300円 |"])), ["負担額「3,300円」が、合計「10,000円」の3割（3,000円）と合いません"]);
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 10,000円 | 30% | 3,500円 |"])), ["負担額「3,500円」が、合計「10,000円」の30%（3,000円）と合いません"]);
  });
  it("ja: says nothing when the amount is the share, also rounded to 10 yen", () => {
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 10,000円 | 3割 | 3,000円 |"])), []);
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 3,456円 | 3割 | 1,040円 |"])), []);
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 3,456円 | 1割 | 350円 |"])), []);
  });
  it("en: points at the amount paid that is not the share", () => {
    assert.deepEqual(findingsOf(doc([...EN_HEAD, "| $600.00 | 30% | $108.00 |"]), en), ["The amount $108.00 is not 30% of the total $600.00 ($180.00)"]);
    assert.deepEqual(findingsOf(doc([...EN_HEAD, "| $600.00 | 30% | $180.00 |"]), en), []);
    assert.deepEqual(findingsOf(doc([...EN_HEAD, "| $333.33 | 20% | $66.67 |"]), en), []);
  });
  it("takes the share stated on a line of its own when the table has no share column", () => {
    const table = ["| 合計 | 負担額 |", "| --- | --- |", "| 10,000円 | 3,500円 |"];
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", ...table])), ["負担額「3,500円」が、合計「10,000円」の3割（3,000円）と合いません"]);
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", ...table.slice(0, 2), "| 10,000円 | 3,000円 |"])), []);
    // The same share stated twice is still one share.
    assert.equal(findingsOf(doc(["負担割合：3割", "", "負担割合：30%", "", ...table])).length, 1);
  });
  it("takes the share in brackets in the amount's heading", () => {
    const table = ["| 合計 | 自己負担額（3割） |", "| --- | --- |", "| 10,000円 | 3,500円 |"];
    assert.deepEqual(findingsOf(doc(table)), ["負担額「3,500円」が、合計「10,000円」の3割（3,000円）と合いません"]);
  });
  it("does not read a table with no share to use, two shares stated, or an amount named only as paid with no share cell", () => {
    const table = ["| 合計 | 負担額 |", "| --- | --- |", "| 10,000円 | 3,500円 |"];
    assert.deepEqual(findingsOf(doc(table)), []);
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", "負担割合：1割", "", ...table])), []);
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", "| 合計 | 請求額 |", "| --- | --- |", "| 10,000円 | 3,500円 |"])), []);
  });
  it("does not compare a total and an amount in different units", () => {
    assert.deepEqual(findingsOf(doc([...JA_HEAD, "| 1,000点 | 3割 | 3,500円 |"])), []);
  });
  it("does not read a table without a total column", () => {
    assert.deepEqual(findingsOf(doc(["| 項目 | 負担割合 | 負担額 |", "| --- | --- | --- |", "| 初診料 | 3割 | 3,500円 |"])), []);
  });
});

describe("share-amount-mismatch: labelled lines", () => {
  it("en: Your share (30%) under a total", () => {
    assert.deepEqual(findingsOf(doc(["- Total: $1,000.00", "- Your share (30%): $350.00"]), en), [
      "The amount $350.00 is not 30% of the total $1,000.00 ($300.00)",
    ]);
    assert.deepEqual(findingsOf(doc(["- Total: $1,000.00", "- Your share (30%): $300.00"]), en), []);
  });
  it("ja: 合計 and 自己負担額 with the stated share", () => {
    const lines = ["負担割合：3割", "", "合計：10,000円", "", "自己負担額：3,500円"];
    assert.deepEqual(findingsOf(doc(lines)), ["負担額「3,500円」が、合計「10,000円」の3割（3,000円）と合いません"]);
    assert.deepEqual(findingsOf(doc(lines.map((line) => line.replace("3,500円", "3,000円")))), []);
  });
  it("two-cell rows of a table read as labelled lines", () => {
    const table = ["| 項目 | 金額 |", "| --- | --- |", "| 合計 | 10,000円 |", "| 自己負担（3割） | 3,500円 |"];
    assert.deepEqual(findingsOf(doc(table)), ["負担額「3,500円」が、合計「10,000円」の3割（3,000円）と合いません"]);
  });
  it("does not read a total below the amount, or a total and an amount in different sections", () => {
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", "負担額：3,000円", "", "合計：3,500円"])), []);
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", "## 明細", "", "合計：10,000円", "", "## お支払い", "", "負担額：3,500円"])), []);
  });
  it("does not read two amounts named as a share in one section", () => {
    assert.deepEqual(findingsOf(doc(["負担割合：3割", "", "合計：10,000円", "", "負担額：3,500円", "", "自己負担額：3,500円"])), []);
  });
});
