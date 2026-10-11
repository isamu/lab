import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { prepare } from "../packages/lang-ja/src/pos.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import type { ChangeTable } from "../packages/chaff/src/structure/change-rate-table.ts";
import {
  backorderMismatches,
  deliveredOverOrdered,
  quantityColumnsOf,
  type QuantityWord,
  type QuantityWords,
} from "../packages/chaff/src/structure/order-quantity.ts";

// 発注・納品の数量の表の一行の食い違い（delivered-over-ordered、backorder-mismatch）。例の表は自作。

const COLUMNS: readonly QuantityWord[] = [
  { pattern: "発注数", role: "ordered" },
  { pattern: "ordered", role: "ordered" },
  { pattern: "納品数", role: "delivered" },
  { pattern: "delivered", role: "delivered" },
  { pattern: "shipped", role: "delivered" },
  { pattern: "残数", role: "backordered" },
  { pattern: "発注残", role: "backordered" },
  { pattern: "未納", role: "backordered" },
  { pattern: "backordered", role: "backordered" },
  { pattern: "back ordered", role: "backordered" },
  { pattern: "remaining", role: "backordered" },
];
const WORDS: QuantityWords = { columns: COLUMNS, qualifiers: ["以上", "程度", "or more"] };

/** A table written as rows of cell texts, with offsets counted along one line per row. */
const tableOf = (rows: readonly (readonly string[])[]): ChangeTable => {
  const lines = rows.map((texts, line) =>
    texts.map((text, index) => {
      const start = line * 1000 + index * 100;
      return { start, end: start + text.length, text };
    }),
  );
  const [header = [], ...body] = lines;
  return { header, rows: body };
};

const rowOf = (offset: number): string => String(Math.floor(offset / 1000));

const overIssues = (rows: readonly (readonly string[])[]): string[] =>
  deliveredOverOrdered([tableOf(rows)], WORDS).map((issue) => `${rowOf(issue.offset)}:${String(issue.values["delivered"])}>${String(issue.values["ordered"])}`);

const backorderIssues = (rows: readonly (readonly string[])[]): string[] =>
  backorderMismatches([tableOf(rows)], WORDS).map(
    (issue) => `${rowOf(issue.offset)}:${String(issue.values["backordered"])}→${String(issue.values["computed"])}`,
  );

const JA_HEADER = ["品名", "発注数量", "今回の納品数量", "残数"];
const EN_HEADER = ["Item", "Ordered", "Delivered now", "Backordered"];

describe("order quantities: the columns the headings name", () => {
  it("finds the ordered, delivered and backordered columns wherever they stand", () => {
    assert.deepEqual(quantityColumnsOf(JA_HEADER, COLUMNS), { ordered: 1, delivered: 2, backordered: 3 });
    assert.deepEqual(quantityColumnsOf(["Backordered", "Item", "Delivered", "Qty ordered"], COLUMNS), { ordered: 3, delivered: 2, backordered: 0 });
  });
  it("a backorder word is read before the ordered or delivered word it holds", () => {
    assert.deepEqual(quantityColumnsOf(["品名", "発注数量", "納品数量", "発注残数"], COLUMNS), { ordered: 1, delivered: 2, backordered: 3 });
    assert.deepEqual(quantityColumnsOf(["品名", "発注数量", "納品数量", "未納品数"], COLUMNS), { ordered: 1, delivered: 2, backordered: 3 });
    assert.deepEqual(quantityColumnsOf(["Item", "Ordered", "Shipped", "Back ordered"], COLUMNS), { ordered: 1, delivered: 2, backordered: 3 });
  });
  it("a table without a backordered column still has the ordered and delivered ones", () => {
    assert.deepEqual(quantityColumnsOf(["Item", "Ordered", "Delivered"], COLUMNS), { ordered: 1, delivered: 2 });
  });
  it("no ordered or delivered column, or two of a role, is no table to read", () => {
    assert.equal(quantityColumnsOf(["品名", "数量", "単価", "金額"], COLUMNS), undefined);
    assert.equal(quantityColumnsOf(["Item", "Ordered", "Backordered"], COLUMNS), undefined);
    assert.equal(quantityColumnsOf(["Item", "Delivered", "Backordered"], COLUMNS), undefined);
    assert.equal(quantityColumnsOf(["Item", "Ordered", "Delivered previously", "Delivered now", "Remaining"], COLUMNS), undefined);
    assert.equal(quantityColumnsOf(["Item", "Ordered", "Delivered", "Backordered", "Remaining"], COLUMNS), undefined);
    assert.equal(quantityColumnsOf([], COLUMNS), undefined);
    assert.equal(quantityColumnsOf(EN_HEADER, []), undefined);
  });
  it("a heading that names both ordered and delivered is no column to read", () => {
    assert.equal(quantityColumnsOf(["Item", "Ordered", "Ordered / Delivered", "Remaining"], COLUMNS), undefined);
    assert.equal(quantityColumnsOf(["品名", "発注数", "発注数・納品数", "残数"], COLUMNS), undefined);
  });
});

describe("delivered-over-ordered", () => {
  it("reports a row that delivers more than was ordered, at the delivered cell", () => {
    assert.deepEqual(overIssues([JA_HEADER, ["クリアファイル", "250枚", "300枚", "0枚"]]), ["1:300枚>250枚"]);
    assert.deepEqual(overIssues([EN_HEADER, ["Pens", "10 boxes", "8 boxes", "2 boxes"], ["Folders", "250 folders", "300 folders", "0 folders"]]), [
      "2:300 folders>250 folders",
    ]);
    assert.deepEqual(
      overIssues([
        ["Item", "Ordered", "Delivered"],
        ["Paper", "1,000", "1,200"],
      ]),
      ["1:1,200>1,000"],
    );
  });
  it("delivering all or less is not reported", () => {
    assert.deepEqual(overIssues([JA_HEADER, ["用紙", "40冊", "40冊", "0冊"], ["ボールペン", "120本", "100本", "20本"]]), []);
    assert.deepEqual(overIssues([EN_HEADER, ["Box", "1 box", "0 boxes", "1 box"]]), []);
  });
  it("cells that are not plain counts in one unit are not compared", () => {
    const skipped = ["", "-", "—", "未定", "TBD", "1.5", "(300)", "-300", "約300枚", "300kg", "$300", "300枚以上", "300枚程度", "10〜300枚"];
    skipped.forEach((delivered) => assert.deepEqual(overIssues([JA_HEADER, ["クリアファイル", "250枚", delivered, "0枚"]]), [], delivered));
    assert.deepEqual(overIssues([EN_HEADER, ["Paper", "2 cartons", "40 reams", "0 reams"]]), []);
    assert.deepEqual(overIssues([EN_HEADER, ["Paper", "10 or more", "12 or more", "0"]]), []);
    assert.deepEqual(overIssues([EN_HEADER, ["Gift set", "10 can", "12 canes", "0 can"]]), []);
  });
  it("a row shorter or longer than the header is not read", () => {
    assert.deepEqual(overIssues([JA_HEADER, ["クリアファイル", "250枚", "300枚"]]), []);
    assert.deepEqual(deliveredOverOrdered([], WORDS), []);
  });
});

describe("backorder-mismatch", () => {
  it("reports a backordered quantity that is not the ordered less the delivered, with the count it should be", () => {
    assert.deepEqual(backorderIssues([JA_HEADER, ["用紙", "40冊", "40冊", "0冊"], ["ホッチキス針", "50箱", "30箱", "25箱"]]), ["2:25箱→20箱"]);
    assert.deepEqual(backorderIssues([EN_HEADER, ["Staples", "50 boxes", "30 boxes", "25 boxes"]]), ["1:25 boxes→20 boxes"]);
    assert.deepEqual(backorderIssues([EN_HEADER, ["Pens", "2,500", "1,000", "1,600"]]), ["1:1,600→1,500"]);
    assert.deepEqual(backorderIssues([EN_HEADER, ["Pens", "10 boxes", "9 boxes", "2 boxes"]]), ["1:2 boxes→1 boxes"]);
  });
  it("a remainder that is the ordered less the delivered is not reported, with one unit written singular or plural", () => {
    assert.deepEqual(backorderIssues([JA_HEADER, ["用紙", "40冊", "40冊", "0冊"], ["ボールペン", "120本", "100本", "20本"]]), []);
    assert.deepEqual(backorderIssues([EN_HEADER, ["Pens", "10 boxes", "9 boxes", "1 box"], ["Paper", "3 reams", "2 reams", "1 ream"]]), []);
    assert.deepEqual(backorderIssues([EN_HEADER, ["Manual", "3 copies", "2 copies", "1 copy"]]), []);
    assert.deepEqual(overIssues([EN_HEADER, ["Manual", "1 copy", "2 copies", "0 copies"]]), ["1:2 copies>1 copy"]);
  });
  it("a row that delivered more than was ordered is left to delivered-over-ordered", () => {
    assert.deepEqual(backorderIssues([JA_HEADER, ["クリアファイル", "250枚", "300枚", "0枚"]]), []);
  });
  it("a blank, dash or TBD remainder, or cells in different units, are not compared", () => {
    ["", "-", "未定", "TBD", "5.0"].forEach((left) => assert.deepEqual(backorderIssues([JA_HEADER, ["用紙", "40冊", "30冊", left]]), [], left));
    assert.deepEqual(backorderIssues([JA_HEADER, ["用紙", "40冊", "30冊", "5箱"]]), []);
    assert.deepEqual(backorderIssues([JA_HEADER, ["用紙", "40冊", "30冊", "5"]]), []);
  });
  it("a row with another count in the same unit (opening stock) is not compared: the remainder may count it", () => {
    const header = ["SKU", "Opening stock", "Ordered", "Delivered", "Remaining"];
    assert.deepEqual(backorderIssues([header, ["A", "20", "100", "80", "40"]]), []);
    assert.deepEqual(backorderIssues([header, ["A", "20 kg", "100", "80", "40"]]), ["1:40→20"]);
  });
  it("a table without a backordered column has nothing to compare", () => {
    assert.deepEqual(
      backorderIssues([
        ["Item", "Ordered", "Delivered"],
        ["Paper", "40", "30"],
      ]),
      [],
    );
    assert.deepEqual(backorderMismatches([], WORDS), []);
  });
});

const run = (adapter: LanguageAdapter, rule: string, text: string): string[] =>
  runRules(buildDocument("t.md", text, adapter), loadRules(adapter.id), { [rule]: "normal" }, false, "business/proposal")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => String(finding.line));

before(async () => {
  await prepare();
  await en.prepare?.({ pos: true });
});

const JA_TABLE = [
  "| 品名 | 発注数量 | 今回の納品数量 | 残数 |",
  "| --- | --- | --- | --- |",
  "| A4コピー用紙 | 40冊 | 40冊 | 0冊 |",
  "| クリアファイル | 250枚 | 300枚 | 0枚 |",
  "| ホッチキス針 | 50箱 | 30箱 | 25箱 |",
];
const EN_TABLE = [
  "| Item | Qty ordered | Qty shipped | Remaining |",
  "| --- | --- | --- | --- |",
  "| Copy paper | 40 reams | 40 reams | 0 reams |",
  "| Clear folders | 250 folders | 300 folders | 0 folders |",
  "| Staples | 50 boxes | 30 boxes | 25 boxes |",
];
const documentOf = (title: string, table: readonly string[]): string => [title, "", ...table, ""].join("\n");

describe("order quantities: through the rules", () => {
  it("ja: 納品書の分納の欄", () => {
    assert.deepEqual(run(ja, "delivered-over-ordered", documentOf("# 納品書", JA_TABLE)), ["6"]);
    assert.deepEqual(run(ja, "backorder-mismatch", documentOf("# 納品書", JA_TABLE)), ["7"]);
    const fixed = JA_TABLE.map((line) => line.replace("250枚", "300枚").replace("25箱", "20箱"));
    assert.deepEqual(run(ja, "delivered-over-ordered", documentOf("# 納品書", fixed)), []);
    assert.deepEqual(run(ja, "backorder-mismatch", documentOf("# 納品書", fixed)), []);
  });
  it("en: the backorder section of a delivery note", () => {
    assert.deepEqual(run(en, "delivered-over-ordered", documentOf("# Delivery Note", EN_TABLE)), ["6"]);
    assert.deepEqual(run(en, "backorder-mismatch", documentOf("# Delivery Note", EN_TABLE)), ["7"]);
    const fixed = EN_TABLE.map((line) => line.replace("250 folders", "300 folders").replace("25 boxes", "20 boxes"));
    assert.deepEqual(run(en, "delivered-over-ordered", documentOf("# Delivery Note", fixed)), []);
    assert.deepEqual(run(en, "backorder-mismatch", documentOf("# Delivery Note", fixed)), []);
  });
  it("en: noun headings (Order Qty, Ship Qty, Back order), and a bound is no count", () => {
    const table = [
      "| Item | Order Qty | Ship Qty | Back order |",
      "| --- | --- | --- | --- |",
      "| Pens | 10 | 12 | 0 |",
      "| Paper | 10 or more | 12 or more | 0 |",
    ];
    assert.deepEqual(run(en, "delivered-over-ordered", documentOf("# Packing slip", table)), ["5"]);
  });
  it("a table that only lists quantities, prices and amounts is not read", () => {
    const invoice = ["| 品名 | 数量 | 単価 | 金額 |", "| --- | --- | --- | --- |", "| 用紙 | 40冊 | 450円 | 18,000円 |"];
    assert.deepEqual(run(ja, "delivered-over-ordered", documentOf("# 納品書", invoice)), []);
    assert.deepEqual(run(ja, "backorder-mismatch", documentOf("# 納品書", invoice)), []);
  });
});
