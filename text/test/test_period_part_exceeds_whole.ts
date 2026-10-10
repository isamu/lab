import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { tableRowsOf } from "../packages/chaff/src/derived/period-parts.ts";

// 期間の一部として書いた期間が、全体より長い（period-part-exceeds-whole）。本文はどれも自作。

const RULE = "period-part-exceeds-whole";

const run = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["part"])}>${String(finding.values["whole"])}`);

const inJa = (...lines: string[]): string[] => run(["# 保証規定", "", ...lines.flatMap((line) => [line, ""])].join("\n"), ja, "ja");
const inEn = (...lines: string[]): string[] => run(["# Limited Warranty", "", ...lines.flatMap((line) => [line, ""])].join("\n"), en, "en");

describe("period-part-exceeds-whole (ja)", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("reads the whole's length in brackets after its name", () => {
    assert.deepEqual(inJa("保証期間（12か月）のうち、無料交換期間はお買い上げ日から18か月です。"), ["18か月>12か月"]);
    assert.deepEqual(inJa("保証期間（12か月）のうち、無料交換期間はお買い上げ日から3か月です。"), []);
  });

  it("reads the length written before the whole's name, and converts years to months", () => {
    assert.deepEqual(inJa("12か月の保証期間のうち、無料修理期間は18か月です。"), ["18か月>12か月"]);
    assert.deepEqual(inJa("保証期間（1年）のうち、無料修理期間は18か月です。"), ["18か月>1年"]);
    assert.deepEqual(inJa("保証期間（2年）のうち、無料修理期間は18か月です。"), []);
  });

  it("reads the whole from the same section by its name, in a sentence or a table row", () => {
    assert.deepEqual(inJa("保証期間は1年です。", "保証期間の中で、無料修理期間は18か月です。"), ["18か月>1年"]);
    assert.deepEqual(inJa("| 項目 | 内容 |\n| --- | --- |\n| 保証期間 | 1年 |", "保証期間内の無料修理期間は18か月です。"), ["18か月>1年"]);
    assert.deepEqual(inJa("保証期間は1年です。", "保証期間内の無料修理期間は6か月です。"), []);
  });

  it("does not look into another section", () => {
    assert.deepEqual(inJa("## 1 保証", "保証期間は1年です。", "## 2 無料修理", "保証期間のうち、無料修理期間は18か月です。"), []);
  });

  it("compares with the longest length the section gives the whole", () => {
    assert.deepEqual(inJa("保証期間は1年です。", "本体の保証期間は2年です。", "保証期間のうち、無料修理期間は18か月です。"), []);
    assert.deepEqual(inJa("保証期間は1年です。", "本体の保証期間は1年です。", "保証期間のうち、無料修理期間は18か月です。"), ["18か月>1年"]);
  });

  it("このうち takes the length of the sentence before", () => {
    assert.deepEqual(inJa("本体の保証期間は1年です。このうち、無料修理期間は18か月です。"), ["18か月>1年"]);
    assert.deepEqual(inJa("本体の保証期間は2年です。このうち、無料修理期間は18か月です。"), []);
  });

  it("is silent on an approximate length or a range", () => {
    assert.deepEqual(inJa("保証期間（12か月）のうち、無料交換期間は約18か月です。"), []);
    assert.deepEqual(inJa("保証期間（12か月）のうち、無料交換期間は最長18か月です。"), []);
    assert.deepEqual(inJa("保証期間（12か月）のうち、無料交換期間は12〜18か月です。"), []);
    assert.deepEqual(inJa("保証期間（約12か月）のうち、無料交換期間は18か月です。"), []);
  });

  it("does not read an extended or additional period as a part, nor as the whole", () => {
    assert.deepEqual(inJa("保証期間（1年）のうち、追加の保証期間は2年です。"), []);
    assert.deepEqual(inJa("保証期間（1年）のうち、延長保証期間は3年です。"), []);
    assert.deepEqual(inJa("延長保証期間は3年です。", "保証期間のうち、無料修理期間は18か月です。"), []);
    assert.deepEqual(inJa("保証期間は1年です。", "延長保証期間は3年です。", "保証期間のうち、無料修理期間は18か月です。"), ["18か月>1年"]);
    assert.deepEqual(inJa("保証期間は1年です。", "部品保証期間は3年です。", "保証期間のうち、無料修理期間は18か月です。"), ["18か月>1年"]);
  });

  it("needs the part to be a named period, one length outside the whole, and comparable units", () => {
    assert.deepEqual(inJa("保証期間（12か月）のうち、18か月目以降は有料です。"), []);
    assert.deepEqual(inJa("保証期間（12か月）のうち、無料修理期間は18か月、部品の交換は6か月です。"), []);
    assert.deepEqual(inJa("保証期間（2か月）のうち、無料交換期間は30日です。"), []);
    assert.deepEqual(inJa("期間（12か月）のうち、無料交換期間は18か月です。"), []);
    assert.deepEqual(inJa("保証期間（12か月）のうちに起きた故障の修理請求期間は18か月です。"), []);
    assert.deepEqual(inJa("保証期間（12か月）のうち、保証期間の証明書は18か月保管してください。"), []);
  });
});

describe("period-part-exceeds-whole (en)", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("reads the whole's length before or after its name", () => {
    assert.deepEqual(inEn("Within the 12-month warranty period, the free replacement period is 18 months."), ["18 months>12-month"]);
    assert.deepEqual(inEn("Within the warranty period (1 year), the free repair period is 18 months."), ["18 months>1 year"]);
    assert.deepEqual(inEn("Within the 12-month warranty period, the free replacement period is 3 months."), []);
    assert.deepEqual(inEn("Within the 2-year warranty period, the free replacement period is 18 months."), []);
  });

  it("reads a part written right before 'of the'", () => {
    assert.deepEqual(inEn("The first 18 months of the 12-month warranty period are free of charge."), ["18 months>12-month"]);
    assert.deepEqual(inEn("The first 6 months of the 12-month warranty period are free of charge."), []);
    assert.deepEqual(inEn("Paid repairs are available for 18 months after the end of the 12-month warranty period."), []);
  });

  it("reads the whole from the same section by its name, a table row, or 'runs for'", () => {
    assert.deepEqual(inEn("The warranty period is 1 year.", "Within the warranty period, the free repair period is 18 months."), ["18 months>1 year"]);
    assert.deepEqual(
      inEn("| Item | Details |\n| --- | --- |\n| Warranty period | 1 year |", "Within the warranty period, the free repair period is 18 months."),
      ["18 months>1 year"],
    );
    assert.deepEqual(inEn("The warranty runs for 12 months.", "Within the warranty period, the free repair period is 18 months."), ["18 months>12 months"]);
    assert.deepEqual(
      inEn("## 1 Cover", "The warranty period is 1 year.", "## 2 Repairs", "Within the warranty period, the free repair period is 18 months."),
      [],
    );
  });

  it("'within it' takes the length of the sentence before", () => {
    assert.deepEqual(inEn("The warranty period is 1 year. Within it, the free repair period is 18 months."), ["18 months>1 year"]);
    assert.deepEqual(inEn("The warranty period is 2 years. Within it, the free repair period is 18 months."), []);
  });

  it("is silent on an approximate length or a range", () => {
    assert.deepEqual(inEn("Within the 12-month warranty period, the free replacement period is about 18 months."), []);
    assert.deepEqual(inEn("Within the 12-month warranty period, the free replacement period is up to 18 months."), []);
    assert.deepEqual(inEn("Within the 12-month warranty period, the free replacement period is 12 to 18 months."), []);
  });

  it("does not read an extended period as a part, nor as the whole", () => {
    assert.deepEqual(inEn("Within the 12-month warranty period, you may buy an extended warranty period of 36 months."), []);
    assert.deepEqual(inEn("The extended warranty period is 3 years.", "Within the warranty period, the free repair period is 18 months."), []);
  });

  it("needs the part to be a named period", () => {
    assert.deepEqual(inEn("Returns must be made within the 30-day return period; refunds take 60 days."), []);
    assert.deepEqual(inEn("If, within the 40-day period, no resolution is made, the code comes into force at the end of the period of 60 days."), []);
    assert.deepEqual(inEn("Claims arising within the 12-month warranty period are subject to a limitation period of 18 months."), []);
    assert.deepEqual(inEn("Within the 12-month warranty period, submit the warranty period claim form within 18 months."), []);
    assert.deepEqual(inEn("Repairs are made within the 12-month warranty period, and the claim period is 18 months."), []);
  });
});

describe("tableRowsOf", () => {
  it("returns body and header rows, without the rule row", () => {
    const source = "text\n| a | b |\n| --- | --- |\n| 1 | 2 |\n";
    assert.deepEqual(
      tableRowsOf(source).map((row) => source.slice(row.start, row.end)),
      ["| a | b |", "| 1 | 2 |"],
    );
    assert.deepEqual(tableRowsOf(""), []);
    assert.deepEqual(tableRowsOf("no | table here"), []);
  });
});
