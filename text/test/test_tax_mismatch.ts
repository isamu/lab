import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { taxMatches, taxMismatches, type TaxWords } from "../packages/chaff/src/structure/tax.ts";

// 税額が小計に税率を掛けた額と合わない（tax-mismatch）。例文はすべて自作。

const RULE = "tax-mismatch";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const table = (rows: readonly string[]): string => ["| 項目 | 金額 |", "| --- | --- |", ...rows].join("\n") + "\n";
const enTable = (rows: readonly string[]): string => ["| Item | Amount |", "| --- | --- |", ...rows].join("\n") + "\n";

const ITEMS = ["| 設計 | 300,000円 |", "| 開発 | 500,000円 |"];
const EN_ITEMS = ["| Design | $3,000 |", "| Build | $5,000 |"];

describe("tax-mismatch: 税額が小計に税率を掛けた額と合わない", () => {
  it("小計の率と違う税額を指す", () => {
    assert.deepEqual(findingsOf(table([...ITEMS, "| 小計 | 800,000円 |", "| 消費税（10%） | 88,000円 |", "| 合計 | 888,000円 |"])), [
      "税額「88,000円」が、上の金額の10%（80,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(enTable([...EN_ITEMS, "| Subtotal | $8,000 |", "| Sales tax (10%) | $880 |"]), en), [
      "The tax $880 is not 10% of the amount above it ($800)",
    ]);
  });

  it("小計の率と合えば言わない", () => {
    assert.deepEqual(findingsOf(table([...ITEMS, "| 小計 | 800,000円 |", "| 消費税（10%） | 80,000円 |", "| 合計 | 880,000円 |"])), []);
    assert.deepEqual(findingsOf(enTable([...EN_ITEMS, "| Subtotal | $8,000 |", "| Tax (8.25%) | $660 |"]), en), []);
  });

  it("小計の行が無ければ、上の項目の和に掛ける", () => {
    assert.deepEqual(findingsOf(table([...ITEMS, "| 消費税（10%） | 80,000円 |"])), []);
    assert.deepEqual(findingsOf(table([...ITEMS, "| 消費税（10%） | 85,000円 |"])), ["税額「85,000円」が、上の金額の10%（80,000円）と合いません"]);
  });

  it("箇条書きも読む", () => {
    assert.deepEqual(findingsOf("- 設計：300,000円\n- 開発：500,000円\n- 小計：800,000円\n- 消費税（10%）：80,000円\n"), []);
    assert.deepEqual(findingsOf("- 設計：300,000円\n- 開発：500,000円\n- 小計：800,000円\n- 消費税（10%）：88,000円\n"), [
      "税額「88,000円」が、上の金額の10%（80,000円）と合いません",
    ]);
  });

  it("端数は切り捨て・四捨五入・切り上げのどれでもよい", () => {
    assert.deepEqual(findingsOf(table(["| 設計 | 1,234円 |", "| 開発 | 1,000円 |", "| 小計 | 2,234円 |", "| 消費税（10%） | 223円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 設計 | 1,234円 |", "| 開発 | 1,000円 |", "| 小計 | 2,234円 |", "| 消費税（10%） | 224円 |"])), []);
    assert.equal(taxMatches(22_300, 2_234, 10), true);
    assert.equal(taxMatches(22_400, 2_234, 10), true);
    assert.equal(taxMatches(22_340, 2_234, 10), true);
    assert.equal(taxMatches(22_500, 2_234, 10), false);
    assert.equal(taxMatches(165, 19.99, 8.25), true);
  });

  it("率の無い税の行、内税の行、率の違う税の行が並ぶ表は比べない", () => {
    assert.deepEqual(findingsOf(table([...ITEMS, "| 小計 | 800,000円 |", "| 消費税 | 88,000円 |"])), []);
    assert.deepEqual(findingsOf(table([...ITEMS, "| 合計 | 880,000円 |", "| うち消費税（10%） | 80,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 合計（税込） | 880,000円 |", "| 消費税（10%）内税 | 80,000円 |"])), []);
    assert.deepEqual(
      findingsOf(table(["| 食品 | 1,000円 |", "| 雑貨 | 2,000円 |", "| 小計 | 3,000円 |", "| 消費税（8%） | 80円 |", "| 消費税（10%） | 200円 |"])),
      [],
    );
    assert.deepEqual(findingsOf(enTable([...EN_ITEMS, "| Total | $8,800 |", "| Tax included (10%) | $800 |"]), en), []);
  });

  it("税の語で始まらない行と、税の語に別の語が続く行は読まない", () => {
    assert.deepEqual(findingsOf(enTable([...EN_ITEMS, "| Subtotal | $8,000 |", "| Taxes and fees (10%) | $900 |"]), en), []);
    assert.deepEqual(findingsOf(table([...ITEMS, "| 小計 | 800,000円 |", "| 割引（10%） | 50,000円 |"])), []);
  });

  it("上の金額が足りないか単位の違う表、文の中の税は読まない", () => {
    assert.deepEqual(findingsOf(table(["| 設計 | 300,000円 |", "| 消費税（10%） | 33,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 小計 | $8,000 |", "| 消費税（10%） | 88,000円 |"])), []);
    assert.deepEqual(findingsOf("小計は800,000円、消費税（10%）は88,000円です。\n"), []);
  });

  it("語の無い言語と空の入力", () => {
    const none: TaxWords = { labels: [], totals: [], included: [] };
    assert.deepEqual(taxMismatches(table([...ITEMS, "| 消費税（10%） | 1円 |"]), [], none), []);
    assert.deepEqual(taxMismatches("", [], { ...none, labels: ["消費税"] }), []);
    assert.deepEqual(findingsOf(""), []);
  });
});
