import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { taxMatches, taxMismatches, type TaxWords } from "../packages/chaff/src/structure/tax.ts";
import { statedTaxRates, taxIncludedPriceMismatches, taxPricePairsOf, type TaxPriceWord } from "../packages/chaff/src/structure/tax-price.ts";

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

  it("全角の％の率と、項目が一つだけの並びも読む", () => {
    assert.deepEqual(findingsOf(table(["| 小計 | 800,000円 |", "| 消費税（10％） | 88,000円 |"])), [
      "税額「88,000円」が、上の金額の10%（80,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf("- Design: $8,000\n- Sales tax (10%): $880\n", en), ["The tax $880 is not 10% of the amount above it ($800)"]);
    assert.deepEqual(findingsOf("- Design: $8,000\n- Sales tax (10%): $800\n", en), []);
  });

  it("小計と税の行の間に金額の行（値引き、送料）があれば、税の掛かる額が決まらないので比べない", () => {
    assert.deepEqual(
      findingsOf(table(["| 作業費 | 100,000円 |", "| 小計 | 100,000円 |", "| 値引き | -10,000円 |", "| 消費税（10%） | 9,000円 |", "| 合計 | 99,000円 |"])),
      [],
    );
    assert.deepEqual(
      findingsOf(enTable(["| Design | $1,000.00 |", "| Subtotal | $1,000.00 |", "| Shipping | $50.00 |", "| Sales tax (8%) | $84.00 |"]), en),
      [],
    );
  });

  it("負の印のある金額（値引き）は足し方が決まらないので比べない", () => {
    assert.deepEqual(findingsOf("- Item: $1,000\n- Discount: -$200\n- Sales tax (10%): $80\n", en), []);
    assert.deepEqual(findingsOf(table(["| 設計 | 300,000円 |", "| 値引き | ▲50,000円 |", "| 消費税（10%） | 25,000円 |"])), []);
    assert.deepEqual(findingsOf("- $8,000\n- Sales tax (10%): $880\n", en), ["The tax $880 is not 10% of the amount above it ($800)"]);
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

  it("上に金額が無いか単位の違う表、文の中の税は読まない", () => {
    assert.deepEqual(findingsOf(table(["| 消費税（10%） | 33,000円 |"])), []);
    assert.deepEqual(findingsOf(table(["| 小計 | $8,000 |", "| 消費税（10%） | 88,000円 |"])), []);
    assert.deepEqual(findingsOf("小計は800,000円、消費税（10%）は88,000円です。\n"), []);
  });

  it("語の無い言語と空の入力", () => {
    const none: TaxWords = { labels: [], totals: [], included: [], charges: [] };
    assert.deepEqual(taxMismatches(table([...ITEMS, "| 消費税（10%） | 1円 |"]), [], none), []);
    assert.deepEqual(taxMismatches("", [], { ...none, labels: ["消費税"] }), []);
    assert.deepEqual(findingsOf(""), []);
  });
});

const priceTable = (headings: readonly string[], rows: readonly (readonly string[])[]): string =>
  [headings, headings.map(() => "---"), ...rows].map((cells) => `| ${cells.join(" | ")} |`).join("\n") + "\n";

const JA_HEADINGS = ["品名", "1箱の価格（税抜）", "1箱の価格（税込・10%）"];
const EN_HEADINGS = ["Item", "Pack price (excl. tax)", "Pack price (incl. 8% tax)"];

describe("tax-mismatch: 価格表の税込の価格が、税抜の価格に率を足した額と合わない", () => {
  it("税込の列の見出しの率で、行ごとに比べて違う行を指す", () => {
    assert.deepEqual(
      findingsOf(
        priceTable(JA_HEADINGS, [
          ["封筒", "1,200円", "1,320円"],
          ["便箋", "1,100円", "1,188円"],
        ]),
      ),
      ["税込の価格「1,188円」が、税抜の価格「1,100円」に10%の税を足した額（1,210円）と合いません"],
    );
    assert.deepEqual(
      findingsOf(
        priceTable(EN_HEADINGS, [
          ["Envelope", "$12.00", "$12.96"],
          ["Notepad", "$11.00", "$11.66"],
        ]),
        en,
      ),
      ["The price with tax $11.66 is not the price before tax $11.00 plus 8% tax ($11.88)"],
    );
  });

  it("合っていれば言わない。端数は切り捨て・四捨五入・切り上げのどれでもよい", () => {
    assert.deepEqual(
      findingsOf(
        priceTable(JA_HEADINGS, [
          ["封筒", "1,200円", "1,320円"],
          ["鉛筆", "95円", "104円"],
          ["消しゴム", "95円", "105円"],
        ]),
      ),
      [],
    );
    assert.deepEqual(
      findingsOf(
        priceTable(EN_HEADINGS, [
          ["Clip", "$0.35", "$0.37"],
          ["Clip", "$0.35", "$0.38"],
        ]),
        en,
      ),
      [],
    );
    assert.deepEqual(findingsOf(priceTable(["品名", "税抜価格", "税込価格（10%）"], [["封筒", "500円", "550円"]])), []);
    assert.deepEqual(findingsOf(priceTable(["Item", "Price (excl. tax)", "Price (incl. 10% tax)"], [["Tag", "$0.335", "$0.36"]]), en), []);
  });

  it("見出しに率が無ければ、文書が税の語の隣に書いた率で比べる", () => {
    const ja = priceTable(["品名", "価格（税抜）", "価格（税込）"], [["封筒", "1,000円", "1,080円"]]);
    assert.deepEqual(findingsOf(`税込の価格は、税抜の価格に消費税10%を加えた額です。\n\n${ja}`), [
      "税込の価格「1,080円」が、税抜の価格「1,000円」に10%の税を足した額（1,100円）と合いません",
    ]);
    assert.deepEqual(findingsOf(`消費税率は10%です。\n\n${ja.replace("1,080円", "1,100円")}`), []);
    const enTablePrices = priceTable(["Item", "Price (before tax)", "Price (after tax)"], [["Pen", "$10.00", "$10.50"]]);
    assert.deepEqual(findingsOf(`Prices after tax include 8% sales tax.\n\n${enTablePrices}`, en), [
      "The price with tax $10.50 is not the price before tax $10.00 plus 8% tax ($10.80)",
    ]);
  });

  it("率がどこにも無い表、二つの率を書いた文書は比べない", () => {
    const ja = priceTable(["品名", "価格（税抜）", "価格（税込）"], [["封筒", "1,000円", "1,080円"]]);
    assert.deepEqual(findingsOf(ja), []);
    assert.deepEqual(findingsOf(`食品は軽減税率8%、そのほかは消費税10%です。\n\n${ja}`), []);
    assert.deepEqual(findingsOf(`割引は10%です。\n\n${ja}`), []);
    assert.deepEqual(findingsOf(`食品は軽減税率8%です。\n\n${priceTable(JA_HEADINGS, [["パン", "1,000円", "1,080円"]])}`), []);
  });

  it("見出しが税抜・税込の語と率のほかでも違う列、組の決まらない列、単位の違う升は比べない", () => {
    assert.deepEqual(findingsOf(priceTable(["品名", "単価（税抜）", "1箱の価格（税込・10%）"], [["封筒", "120円", "1,320円"]])), []);
    assert.deepEqual(findingsOf(priceTable(["品名", "価格（税抜）", "価格（税抜）", "価格（税込・10%）"], [["封筒", "100円", "200円", "330円"]])), []);
    assert.deepEqual(findingsOf(priceTable(JA_HEADINGS, [["封筒", "$12.00", "1,320円"]])), []);
    assert.deepEqual(findingsOf(priceTable(["Item", "Price $ (excl. tax)", "Price € (incl. 10% tax)"], [["Pen", "10", "12"]]), en), []);
    assert.deepEqual(
      findingsOf(
        priceTable(JA_HEADINGS, [
          ["封筒", "-", "1,320円"],
          ["便箋", "1,100円", "要見積"],
        ]),
      ),
      [],
    );
    assert.deepEqual(findingsOf(priceTable(["Item", "Price (incl. tax / excl. tax)", "Price (incl. 8% tax)"], [["Pen", "$10.00", "$9.00"]]), en), []);
  });

  it("価格表の読み方を語と見出しで確かめる", () => {
    const words: TaxPriceWord[] = [
      { pattern: "税抜", role: "excluded" },
      { pattern: "税込", role: "included" },
      { pattern: "税込み", role: "included" },
      { pattern: "消費税", role: "rate" },
    ];
    assert.deepEqual(taxPricePairsOf(["品名", "税抜", "税込み（8%）"], words), [{ excluded: 1, included: 2, rate: 8 }]);
    assert.deepEqual(taxPricePairsOf(["税込（10%）", "税抜"], words), [{ excluded: 1, included: 0, rate: 10 }]);
    assert.deepEqual(taxPricePairsOf(["税込", "税込", "税抜"], words), []);
    assert.deepEqual(taxPricePairsOf(["価格", "金額"], words), []);
    assert.deepEqual(statedTaxRates(["消費税10%を加えます。", "消費税（10%）", "消費税率は10%です。"], [...words, { pattern: "税率", role: "rate" }]), [10]);
    assert.deepEqual(
      statedTaxRates(
        ["A sales tax of 8% applies.", "VAT: 20%", "8% tax", "8% taxable"],
        [
          { pattern: "tax", role: "rate" },
          { pattern: "VAT", role: "rate" },
        ],
      ),
      [8, 20],
    );
    assert.deepEqual(statedTaxRates(["割引10%", "10%引き", ""], words), []);
    assert.deepEqual(taxIncludedPriceMismatches({ tables: [], lines: [] }, words), []);
    assert.deepEqual(taxIncludedPriceMismatches({ tables: [], lines: ["消費税10%"] }, []), []);
  });

  it("価格表の読みは、税の行の読みを変えない", () => {
    assert.deepEqual(findingsOf(table([...ITEMS, "| 小計 | 800,000円 |", "| 消費税（10%） | 88,000円 |"])), [
      "税額「88,000円」が、上の金額の10%（80,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(table([...ITEMS, "| 合計（税込） | 880,000円 |", "| うち消費税（10%） | 80,000円 |"])), []);
  });
});

describe("tax-mismatch: サービス料の行と、その下の税の行", () => {
  const BANQUET = ["| 料理 | 400,000円 |", "| 会場 | 100,000円 |", "| 小計 | 500,000円 |"];
  const EN_BANQUET = ["| Dinner | $4,000.00 |", "| Room | $1,000.00 |", "| Subtotal | $5,000.00 |"];

  it("サービス料の率と合わない金額を指す", () => {
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料（15%） | 50,000円 |", "| 消費税（10%） | 55,000円 |"])), [
      "税額「50,000円」が、上の金額の15%（75,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(table([...BANQUET, "| 奉仕料（10%） | 55,000円 |"])), ["税額「55,000円」が、上の金額の10%（50,000円）と合いません"]);
    assert.deepEqual(findingsOf(enTable([...EN_BANQUET, "| Service charge (18%) | $1,000.00 |", "| Sales tax (8%) | $480.00 |"]), en), [
      "The tax $1,000.00 is not 18% of the amount above it ($900.00)",
    ]);
    assert.deepEqual(findingsOf("- Dinner: $1,000\n- Gratuity (20%): $150\n", en), ["The tax $150 is not 20% of the amount above it ($200)"]);
  });

  it("税は小計にサービス料を足した額に掛けても、小計だけに掛けてもよい", () => {
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料（10%） | 50,000円 |", "| 消費税（10%） | 55,000円 |", "| 合計 | 605,000円 |"])), []);
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料（10%） | 50,000円 |", "| 消費税（10%） | 50,000円 |"])), []);
    assert.deepEqual(findingsOf(enTable([...EN_BANQUET, "| Service charge (20%) | $1,000.00 |", "| Sales tax (8%) | $480.00 |"]), en), []);
    assert.deepEqual(findingsOf(enTable([...EN_BANQUET, "| Service charge (20%) | $1,000.00 |", "| Sales tax (8%) | $400.00 |"]), en), []);
    assert.deepEqual(findingsOf("- Dinner: $1,000\n- Gratuity (20%): $200\n- Tax (10%): $120\n", en), []);
    assert.deepEqual(
      findingsOf(
        enTable([
          "| Food | $100.00 |",
          "| Subtotal | $100.00 |",
          "| Service charge (10%) | $10.00 |",
          "| Gratuity (20%) | $20.00 |",
          "| Sales tax (10%) | $11.00 |",
        ]),
        en,
      ),
      [],
    );
  });

  it("サービス料の下の税が、どちらの額の率とも合わなければ指す", () => {
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料（10%） | 50,000円 |", "| 消費税（10%） | 60,000円 |"])), [
      "税額「60,000円」が、上の金額の10%（55,000円）と合いません",
    ]);
    assert.deepEqual(findingsOf(enTable([...EN_BANQUET, "| Service charge (20%) | $1,000.00 |", "| Sales tax (8%) | $500.00 |"]), en), [
      "The tax $500.00 is not 8% of the amount above it ($480.00)",
    ]);
  });

  it("率の無いサービス料、税の下のチップ、サービス料と税の間の別の金額、軽減税率の並びは比べない", () => {
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料 | 50,000円 |", "| 消費税（10%） | 1,000円 |"])), []);
    assert.deepEqual(
      findingsOf(enTable(["| Subtotal | $100.00 |", "| Sales tax (8%) | $8.00 |", "| Total | $108.00 |", "| Gratuity (20%) | $20.00 |"]), en),
      [],
    );
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料（10%） | 50,000円 |", "| 送料 | 2,000円 |", "| 消費税（10%） | 1,000円 |"])), []);
    assert.deepEqual(findingsOf(table([...BANQUET, "| サービス料（10%） | 50,000円 |", "| 消費税（8%） | 1,000円 |", "| 消費税（10%） | 2,000円 |"])), []);
  });
});
