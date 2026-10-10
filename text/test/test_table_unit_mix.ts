import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { captionUnitOf, scaleCellOf, tableScaleSlips, unitsIn, type TableScaleWords } from "../packages/chaff/src/structure/table-scale.ts";

// 表の中で金額の桁の単位が混ざっている（table-unit-mix）。表は自作の数字。

const RULE = "table-unit-mix";

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["item"])}:${String(finding.values["written"])}@${String(finding.line)}`);

const slipsJa = (source: string): string[] => findings(source, ja, "ja");
const slipsEn = (source: string): string[] => findings(source, en, "en");

const table = (caption: string, header: string, ...rows: string[]): string =>
  [
    "# Results",
    "",
    ...(caption === "" ? [] : [caption, ""]),
    `| ${header} |`,
    `| ${header
      .split("|")
      .map(() => "---")
      .join(" | ")} |`,
    ...rows.map((row) => `| ${row} |`),
  ].join("\n");

describe("table-unit-mix: a cell in another scale unit", () => {
  it("ja: 千円 among 百万円 with no caption", () => {
    const source = table(
      "",
      "項目 | 前年同期 | 当期",
      "売上高 | 2,400百万円 | 2,640百万円",
      "営業利益 | 168百万円 | 198百万円",
      "四半期純利益 | 110,000千円 | 130,000千円",
    );
    assert.deepEqual(slipsJa(source), ["四半期純利益:110,000千円@7"]);
  });

  it("ja: 千円 under （単位：百万円）", () => {
    const source = table("（単位：百万円）", "項目 | 前期 | 当期", "売上高 | 1,200 | 1,320,000千円", "営業利益 | 84 | 96", "経常利益 | 80 | 92");
    assert.deepEqual(slipsJa(source), ["売上高:1,320,000千円@7"]);
  });

  it("en: thousand among million with no caption", () => {
    const source = table(
      "",
      "Item | Prior | Current",
      "Net sales | $2,400 million | $2,640 million",
      "Operating profit | $168 million | $198 million",
      "Net profit | $110,000 thousand | $130,000 thousand",
    );
    assert.deepEqual(slipsEn(source), ["Net profit:$110,000 thousand@7"]);
  });

  it("en: thousand under (in millions of dollars)", () => {
    const source = table(
      "(in millions of dollars)",
      "Item | Prior | Current",
      "Net sales | 1,200 | $1,320 thousand",
      "Operating profit | 84 | 96",
      "Profit before tax | 80 | 92",
    );
    assert.deepEqual(slipsEn(source), ["Net sales:$1,320 thousand@7"]);
  });
});

describe("table-unit-mix: a larger unit under a stated one", () => {
  it("ja: 億円 under （単位：百万円）", () => {
    const source = table("（単位：百万円）", "項目 | 前期 | 当期", "売上高 | 1,200 | 13億円", "営業利益 | 84 | 96", "経常利益 | 80 | 92");
    assert.deepEqual(slipsJa(source), ["売上高:13億円@7"]);
  });
});

describe("table-unit-mix: a row a thousand times the others under a stated unit", () => {
  it("ja: 52,000 among 1,200 and 84 under （単位：百万円）", () => {
    const source = table(
      "（単位：百万円）",
      "項目 | 前期 | 当期 | 増減率",
      "売上高 | 1,200 | 1,320 | 10.0%",
      "営業利益 | 84 | 96 | 14.3%",
      "経常利益 | 80 | 92 | 15.0%",
      "当期純利益 | 52,000 | 60,000 | 15.4%",
      "営業利益率 | 7.0% | 7.3% | —",
    );
    assert.deepEqual(slipsJa(source), ["当期純利益:52,000@10"]);
  });

  it("en: a loss in brackets, (52,000), is read as a negative figure", () => {
    const source = table(
      "(In millions of US dollars)",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Operating profit | 84 | 96",
      "Profit before tax | 80 | 92",
      "Net loss | (52,000) | (60,000)",
    );
    assert.deepEqual(slipsEn(source), ["Net loss:(52,000)@10"]);
  });

  it("en: 52,000 under (In millions of US dollars)", () => {
    const source = table(
      "(In millions of US dollars)",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Operating profit | 84 | 96",
      "Profit before tax | 80 | 92",
      "Net profit | 52,000 | 60,000",
    );
    assert.deepEqual(slipsEn(source), ["Net profit:52,000@10"]);
  });
});

describe("table-unit-mix: what it does not report", () => {
  it("a consistent table, with and without a caption", () => {
    assert.deepEqual(slipsJa(table("（単位：百万円）", "項目 | 前期 | 当期", "売上高 | 1,200 | 1,320", "営業利益 | 84 | 96", "当期純利益 | 52 | 60")), []);
    assert.deepEqual(
      slipsEn(table("", "Item | Prior | Current", "Net sales | $2,400 million | $2,640 million", "Net profit | $110 million | $130 million")),
      [],
    );
  });

  it("a genuinely large row that is not whole thousands (total assets)", () => {
    const source = table(
      "（単位：百万円）",
      "項目 | 前期 | 当期",
      "売上高 | 1,200 | 1,320",
      "当期純利益 | 52 | 60",
      "経常利益 | 80 | 92",
      "総資産 | 52,340 | 60,118",
    );
    assert.deepEqual(slipsJa(source), []);
  });

  it("a row in whole thousands in only one column", () => {
    const source = table(
      "(In millions of US dollars)",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Net profit | 52 | 60",
      "Profit before tax | 80 | 92",
      "Total assets | 52,000 | 60,118",
    );
    assert.deepEqual(slipsEn(source), []);
  });

  it("a large row with no caption of unit", () => {
    const source = table(
      "",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Net profit | 52 | 60",
      "Profit before tax | 80 | 92",
      "Total assets | 52,000 | 60,000",
    );
    assert.deepEqual(slipsEn(source), []);
  });

  it("a total row, and a row whose label gives its own unit", () => {
    const total = table("（単位：百万円）", "項目 | 前期 | 当期", "A事業 | 120 | 130", "B事業 | 80 | 90", "C事業 | 300 | 280", "合計 | 5,000 | 5,000");
    assert.deepEqual(slipsJa(total), []);
    const staff = table(
      "(In millions of US dollars)",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Net profit | 52 | 60",
      "Profit before tax | 80 | 92",
      "Employees (persons) | 52,000 | 60,000",
    );
    assert.deepEqual(slipsEn(staff), []);
  });

  it("two rows that stand out (a table of very different sizes)", () => {
    const source = table(
      "（単位：百万円）",
      "項目 | 前期 | 当期",
      "売上高 | 1,200 | 1,320",
      "当期純利益 | 52 | 60",
      "経常利益 | 80 | 92",
      "総資産 | 52,000 | 60,000",
      "純資産 | 30,000 | 31,000",
    );
    assert.deepEqual(slipsJa(source), []);
  });

  it("a row a million times the others, which does not fall among them once divided by a thousand", () => {
    const source = table(
      "(In millions of US dollars)",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Net profit | 52 | 60",
      "Profit before tax | 80 | 92",
      "Shares outstanding | 5,000,000 | 5,000,000",
    );
    assert.deepEqual(slipsEn(source), []);
  });

  it("two rows that stand out, each in its own columns", () => {
    const source = table(
      "(In millions of dollars)",
      "Item | A | B | C | D",
      "Small 1 | 50 | 60 | 70 | 80",
      "Small 2 | 40 | 50 | 60 | 70",
      "Mist A | 50,000 | 60,000 |  | ",
      "Mist B |  |  | 70,000 | 80,000",
    );
    assert.deepEqual(slipsEn(source), []);
  });

  it("without a caption, a larger word for a large amount and a smaller word for a small one", () => {
    const larger = table(
      "",
      "Item | Prior | Current",
      "Net sales | $2.4 billion | $2.6 billion",
      "Operating profit | $168 million | $198 million",
      "Net profit | $110 million | $130 million",
    );
    assert.deepEqual(slipsEn(larger), []);
    const smaller = table("", "項目 | 前期 | 当期", "売上高 | 2,400百万円 | 2,640百万円", "営業利益 | 168百万円 | 198百万円", "寄付金 | 500千円 | 600千円");
    assert.deepEqual(slipsJa(smaller), []);
  });

  it("without a caption, a tie between two units", () => {
    const source = table("", "項目 | 前期 | 当期", "売上高 | 2,400百万円 | 2,640百万円", "純利益 | 110,000千円 | 130,000千円");
    assert.deepEqual(slipsJa(source), []);
  });

  it("a caption that is a sentence with a figure, or that names two scales, is not a caption", () => {
    const sentence = table(
      "Net sales rose to $1,320 million, in millions.",
      "Item | FY2025 | FY2026",
      "Net sales | 1,200 | 1,320",
      "Net profit | 52 | 60",
      "Profit before tax | 80 | 92",
      "Other | 52,000 | 60,000",
    );
    assert.deepEqual(slipsEn(sentence), []);
  });
});

const JA_WORDS: TableScaleWords = {
  units: [
    { word: "千円", value: 1000 },
    { word: "万円", value: 10000 },
    { word: "百万円", value: 1000000 },
  ],
  captionMarks: ["単位"],
  totalLabels: ["合計"],
};

const EN_WORDS: TableScaleWords = {
  units: [
    { word: "thousand", value: 1000 },
    { word: "million", value: 1000000 },
    { word: "millions", value: 1000000 },
  ],
  captionMarks: ["in", "of"],
  totalLabels: ["Total"],
};

describe("table-unit-mix: the pure parts", () => {
  it("unitsIn takes the longest word at each place, and whole Latin words only", () => {
    assert.deepEqual(
      unitsIn("単位：百万円", JA_WORDS.units).map((unit) => unit.word),
      ["百万円"],
    );
    assert.deepEqual(
      unitsIn("In millions of dollars", EN_WORDS.units).map((unit) => unit.word),
      ["millions"],
    );
    assert.deepEqual(unitsIn("millionaire", EN_WORDS.units), []);
    assert.deepEqual(unitsIn("", EN_WORDS.units), []);
  });

  it("scaleCellOf reads one figure with at most a scale word and a currency", () => {
    assert.deepEqual(scaleCellOf("110,000千円", JA_WORDS.units), { number: 110000, digits: "110,000", unit: { word: "千円", value: 1000 } });
    assert.deepEqual(scaleCellOf(" $2,400 million ", EN_WORDS.units)?.number, 2400);
    assert.deepEqual(scaleCellOf("**1,200**", EN_WORDS.units), { number: 1200, digits: "1,200", unit: undefined });
    assert.equal(scaleCellOf("△52", JA_WORDS.units)?.number, -52);
    assert.equal(scaleCellOf("(52,000)", JA_WORDS.units)?.number, -52000);
    assert.equal(scaleCellOf("（110,000千円）", JA_WORDS.units)?.number, -110000);
    assert.equal(scaleCellOf("(-52)", JA_WORDS.units), undefined);
    assert.equal(scaleCellOf("(注1)", JA_WORDS.units), undefined);
    assert.equal(scaleCellOf("7.0%", JA_WORDS.units), undefined);
    assert.equal(scaleCellOf("1,200人", JA_WORDS.units), undefined);
    assert.equal(scaleCellOf("—", JA_WORDS.units), undefined);
    assert.equal(scaleCellOf("", JA_WORDS.units), undefined);
    assert.equal(scaleCellOf("110 thousand 3", EN_WORDS.units), undefined);
  });

  it("captionUnitOf reads a short line with a mark, one scale and no figure", () => {
    assert.equal(captionUnitOf("（単位：百万円）", JA_WORDS)?.value, 1000000);
    assert.equal(captionUnitOf("(In millions of dollars)", EN_WORDS)?.value, 1000000);
    assert.equal(captionUnitOf("百万円", JA_WORDS), undefined);
    assert.equal(captionUnitOf("（単位：百万円、2026年）", JA_WORDS), undefined);
    assert.equal(captionUnitOf("（単位：百万円・千円）", JA_WORDS), undefined);
    assert.equal(captionUnitOf("| 単位 | 百万円 |", JA_WORDS), undefined);
    assert.equal(captionUnitOf("Thousands", EN_WORDS), undefined);
    assert.equal(captionUnitOf("", EN_WORDS), undefined);
  });

  it("tableScaleSlips gives the kind and the reading of a row", () => {
    const source = [
      "（単位：百万円）",
      "",
      "| 項目 | 前期 | 当期 |",
      "| --- | --- | --- |",
      "| 売上高 | 1,200 | 1,320 |",
      "| 営業利益 | 84 | 96 |",
      "| 純利益 | 52,000 | 60,000 |",
    ].join("\n");
    const slips = tableScaleSlips(source, JA_WORDS);
    assert.deepEqual(
      slips.map((slip) => [slip.kind, slip.item, slip.cell.text.trim(), slip.tableUnit, slip.reading]),
      [["row", "純利益", "52,000", "百万円", 52]],
    );
    assert.deepEqual(tableScaleSlips("no table here", JA_WORDS), []);
  });
});
