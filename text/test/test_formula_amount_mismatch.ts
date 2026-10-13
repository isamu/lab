import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { profileFor } from "../packages/chaff/src/profile/for-file.ts";
import { loadProfiles } from "../packages/chaff/src/profile/load.ts";
import { parseProfile } from "../packages/chaff/src/profile/parse.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { formulaMatches } from "../packages/chaff/src/structure/formula-amount.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 見出しに書いた計算と合わない金額（formula-amount-mismatch）。例の精算書はすべて自作。

const RULE = "formula-amount-mismatch";
const GENRE = "business/proposal";

/** As the CLI runs it: the profile chaff.yaml names, or the one the content has the shape of. */
const findingsOf = (source: string, adapter: LanguageAdapter, profile?: string): string[] => {
  const rules = loadRules(adapter.id);
  const definition = rules.find((rule) => rule.id === RULE);
  if (definition === undefined) throw new Error(`no rule ${RULE}`);
  const doc = buildDocument("t.md", source, adapter, undefined, profileFor({ ...EMPTY, profile }, "t.md", source, adapter.id, GENRE));
  return runRules(doc, rules, { [RULE]: "normal" }, false, GENRE)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => messageOf(definition, finding, adapter.id));
};

const lines = (...rows: string[]): string => [...rows, ""].join("\n");

/** A Japanese settlement statement: its date lines and price table make the property-sale profile apply. */
const jaStatement = (fee: string, extra: readonly string[] = []): string =>
  lines(
    "# 不動産売買代金精算書",
    "",
    "売買契約日：2026年7月18日",
    "",
    "決済日：2026年9月30日",
    "",
    ...extra,
    "| 項目 | 金額 |",
    "| --- | --- |",
    "| 売買代金 | 48,000,000円 |",
    "| 手付金（契約時にお支払い済み） | 2,400,000円 |",
    fee,
  );

/** A Japanese bill that is not a settlement statement: no profile applies. */
const jaBill = (fee: string, extra: readonly string[] = []): string =>
  lines("# ご請求書", "", ...extra, "| 項目 | 金額 |", "| --- | --- |", "| 売買代金 | 48,000,000円 |", fee);

const enStatement = (fee: string, extra: readonly string[] = []): string =>
  lines("# Seller's Settlement Statement", "", ...extra, "| Item | Amount |", "| --- | --- |", "| Sale price | $324,000.00 |", fee);

describe("formula-amount-mismatch in Japanese", () => {
  it("reports a fee that lost its fixed part, at the profile's 10% when the statement states no rate", () => {
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円、消費税込み） | 1,584,000円 |"), ja), [
      "「1,584,000円」が、売買代金「48,000,000円」で「売買代金の3%＋60,000円」を計算した額（1,650,000円）と合いません",
    ]);
  });

  it("does not report the fee the formula gives", () => {
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円、消費税込み） | 1,650,000円 |"), ja), []);
  });

  it("reads a label line outside a table and a formula written with ×", () => {
    assert.equal(findingsOf(jaStatement("仲介手数料（売買代金×3%＋60,000円、消費税込み）：1,500,000円"), ja).length, 1);
    assert.deepEqual(findingsOf(jaStatement("仲介手数料（売買代金×3%＋60,000円、消費税込み）：1,650,000円"), ja), []);
  });

  it("adds no tax when the label does not say it is included", () => {
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円） | 1,500,000円 |"), ja), []);
    assert.equal(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円） | 1,650,000円 |"), ja).length, 1);
  });

  it("uses a rate written in the label, even outside a settlement statement", () => {
    assert.deepEqual(findingsOf(jaBill("| 手数料（売買代金の3%＋60,000円、消費税8%込み） | 1,620,000円 |"), ja), []);
    assert.equal(findingsOf(jaBill("| 手数料（売買代金の3%＋60,000円、消費税8%込み） | 1,650,000円 |"), ja).length, 1);
  });

  it("uses the one rate the document states beside a tax word", () => {
    const stated = ["消費税率は8%です。", ""];
    assert.deepEqual(findingsOf(jaBill("| 手数料（売買代金の3%＋60,000円、税込み） | 1,620,000円 |", stated), ja), []);
    assert.equal(findingsOf(jaBill("| 手数料（売買代金の3%＋60,000円、税込み） | 1,650,000円 |", stated), ja).length, 1);
  });

  it("reads a fixed part written with a word of scale as exact: ＋6万円 is 60,000円", () => {
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋6万円、消費税込み） | 1,650,000円 |"), ja), []);
    assert.equal(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋6万円、消費税込み） | 1,644,500円 |"), ja).length, 1);
  });

  it("adds no tax when the label says the tax is left out", () => {
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円、消費税別） | 1,500,000円 |"), ja), []);
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円、消費税は含まない） | 1,500,000円 |"), ja), []);
  });

  it("does not compare a tax-included fee with no rate anywhere and no profile", () => {
    assert.deepEqual(findingsOf(jaBill("| 手数料（売買代金の3%＋60,000円、消費税込み） | 1,000,000円 |"), ja), []);
    assert.deepEqual(findingsOf(jaStatement("| 仲介手数料（売買代金の3%＋60,000円、消費税込み） | 1,000,000円 |"), ja, "none"), []);
  });

  it("does not compare when the document states two different tax rates", () => {
    const two = ["消費税率は10%です。", "", "軽減税率は8%です。", ""];
    assert.deepEqual(findingsOf(jaBill("| 手数料（売買代金の3%、税込み） | 1,000,000円 |", two), ja), []);
  });

  it("accepts rounding down, to nearest or up, before or after tax", () => {
    const fee = (amount: string): string => lines("| 項目 | 金額 |", "| --- | --- |", "| 売買代金 | 33,333,333円 |", `| 手数料（売買代金の3%） | ${amount} |`);
    assert.deepEqual(findingsOf(fee("999,999円"), ja), []);
    assert.deepEqual(findingsOf(fee("1,000,000円"), ja), []);
    assert.equal(findingsOf(fee("1,000,100円"), ja).length, 1);
  });

  it("does not compare without a labelled amount of that name, or with two that differ", () => {
    assert.deepEqual(findingsOf(lines("| 項目 | 金額 |", "| --- | --- |", "| 手数料（売買価格の3%） | 1円 |"), ja), []);
    const twice = lines("| 項目 | 金額 |", "| --- | --- |", "| 売買代金 | 40,000,000円 |", "| 売買代金 | 48,000,000円 |", "| 手数料（売買代金の3%） | 1円 |");
    assert.deepEqual(findingsOf(twice, ja), []);
  });

  it("does not read a formula in a sentence, a label with another amount, or a label with two rates", () => {
    assert.deepEqual(findingsOf(jaBill("手数料は売買代金の3%で、1円です。"), ja), []);
    assert.deepEqual(findingsOf(jaBill("| 手数料（売買代金の3%、上限2,000,000円） | 1円 |"), ja), []);
    assert.deepEqual(findingsOf(jaBill("| 手数料（売買代金の3%か売買代金の4%） | 1円 |"), ja), []);
  });
});

describe("formula-amount-mismatch in English", () => {
  it("reports a commission that is not its rate of the sale price", () => {
    assert.deepEqual(findingsOf(enStatement("| Commission (5% of the sale price) | $16,020.00 |"), en), [
      '$16,020.00 is not "5% of the sale price" worked out on the sale price $324,000.00 ($16,200.00)',
    ]);
    assert.deepEqual(findingsOf(enStatement("| Commission (5% of the sale price) | $16,200.00 |"), en), []);
  });

  it("adds a fixed part after plus, and reads a label line and a formula with ×", () => {
    assert.deepEqual(findingsOf(enStatement("| Fee (3% of the sale price plus $500.00) | $10,220.00 |"), en), []);
    assert.equal(findingsOf(enStatement("| Fee (3% of the sale price plus $500.00) | $9,720.00 |"), en).length, 1);
    assert.equal(findingsOf(enStatement("Fee (sale price × 3%): $9,000.00"), en).length, 1);
    assert.deepEqual(findingsOf(enStatement("Fee (sale price × 3%): $9,720.00"), en), []);
  });

  it("adds the tax rate the document states when the label says tax is included", () => {
    const stated = ["Sales tax rate: 8%", ""];
    assert.deepEqual(findingsOf(enStatement("| Fee (3% of the sale price, incl. tax) | $10,497.60 |", stated), en), []);
    assert.equal(findingsOf(enStatement("| Fee (3% of the sale price, incl. tax) | $9,720.00 |", stated), en).length, 1);
    assert.deepEqual(findingsOf(enStatement("| Fee (3% of the sale price, incl. tax) | $1.00 |"), en), []);
  });

  it("adds no tax when the label says tax is not included, and reads a name holding the word tax", () => {
    const stated = ["Sales tax rate: 8%", ""];
    assert.deepEqual(findingsOf(enStatement("| Fee (3% of the sale price, tax not included) | $9,720.00 |", stated), en), []);
    const basis = lines("| Item | Amount |", "| --- | --- |", "| Tax basis | $100,000.00 |", "| Fee (5% of tax basis) | $4,000.00 |");
    assert.equal(findingsOf(basis, en).length, 1);
  });

  it("does not accept a dollar off an amount written to the cent", () => {
    assert.equal(findingsOf(enStatement("| Commission (5% of the sale price) | $16,199.00 |"), en).length, 1);
  });

  it("does not compare amounts in different currencies or a sentence", () => {
    assert.deepEqual(findingsOf(enStatement("| Fee (3% of the sale price) | €1.00 |"), en), []);
    assert.deepEqual(findingsOf(enStatement("The fee is 3% of the sale price: about $1.00 in total."), en), []);
  });
});

describe("formulaMatches", () => {
  it("accepts the exact amount and a unit's rounding either side, and rejects more", () => {
    assert.equal(formulaMatches(1650000, { low: 1500000, high: 1500000 }, 10), true);
    assert.equal(formulaMatches(1650001, { low: 1500000, high: 1500000 }, 10), false);
    assert.equal(formulaMatches(1649999, { low: 1500000, high: 1500000 }, 10), false);
    assert.equal(formulaMatches(16199, { low: 16200, high: 16200 }, 0), false);
    assert.equal(formulaMatches(16200.5, { low: 16200.5, high: 16200.5 }, 0), true);
    assert.equal(formulaMatches(16201, { low: 16200.5, high: 16200.5 }, 0), true);
    assert.equal(formulaMatches(1584000, { low: 1500000, high: 1500000 }, 10), false);
    assert.equal(formulaMatches(0, { low: 0, high: 0 }, 0), true);
  });

  it("accepts any amount a base written with a word of scale allows, and nothing outside it", () => {
    assert.equal(formulaMatches(1452000, { low: 1437000, high: 1443000 }, 0), false);
    assert.equal(formulaMatches(1440500, { low: 1437000, high: 1443000 }, 0), true);
  });

  it("accepts the tax worked out on the amount rounded before tax", () => {
    // 999.6 rounded up to 1,000 before 10% tax is 1,100; 999.6 × 1.1 is 1,099.56.
    assert.equal(formulaMatches(1100, { low: 999.6, high: 999.6 }, 10), true);
    assert.equal(formulaMatches(1102, { low: 999.6, high: 999.6 }, 10), false);
  });
});

describe("the tax_rate of a profile", () => {
  it("reads a rate above 0 and below 100, and nothing else", () => {
    const rate = (value: unknown): number | undefined => parseProfile({ id: "x", ja: { tax_rate: value } })?.languages["ja"]?.taxRate;
    assert.equal(rate(10), 10);
    assert.equal(rate(8.5), 8.5);
    [0, 100, -1, "10", null, Number.NaN].forEach((value) => assert.equal(rate(value), undefined, String(value)));
  });

  it("the bundled property-sale profile is chosen by a Japanese settlement statement's lines, not by a bill or a listing", () => {
    const profile = loadProfiles().find((definition) => definition.id === "property-sale");
    assert.equal(profile?.languages["ja"]?.taxRate, 10);
    assert.equal(profile?.languages["en"], undefined);
    assert.equal(profileFor(EMPTY, "t.md", jaStatement("| 仲介手数料 | 1円 |"), "ja", GENRE)?.id, "property-sale");
    assert.equal(profileFor(EMPTY, "t.md", jaBill("| 手数料 | 1円 |"), "ja", GENRE), undefined);
    const priceTable = lines("# 請求内訳", "", "| 売買代金 | 48,000,000円 |", "| 手付金 | 2,400,000円 |", "| 残代金 | 45,600,000円 |");
    assert.equal(profileFor(EMPTY, "t.md", priceTable, "ja", GENRE), undefined);
    const listing = lines("| 賃料 | 98,000円 |", "| 管理費 | 5,000円 |", "| 敷金 | 1か月 |", "| 間取り | 1LDK |");
    assert.equal(profileFor(EMPTY, "t.md", listing, "ja", GENRE)?.id, "listing");
  });
});
