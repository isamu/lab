import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { countsIn, phrasesIn, sentenceAround, type PeriodMultipleWords } from "../packages/chaff/src/structure/period-multiple.ts";

// 月払の何か月分と合わない額（period-multiple-mismatch）。

const RULE = "period-multiple-mismatch";

const found = (source: string, adapter: LanguageAdapter): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { [RULE]: "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${String(finding.values["multiple"])} ${String(finding.values["amount"])} / ${String(finding.values["base"])}`);

const table = (...rows: string[]): string => ["| 払込方法 | 保険料 |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(" ", " | ")} |`)].join("\n");
const enTable = (...rows: string[]): string =>
  ["| How you pay | Premium |", "| --- | --- |", ...rows.map((row) => `| ${row.replace(": ", " | ")} |`)].join("\n");

const jaDoc = (...blocks: string[]): string[] => found(["# 保険料のご案内", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), ja);
const enDoc = (...blocks: string[]): string[] => found(["# Your premium", "", ...blocks.flatMap((block) => [block, ""])].join("\n"), en);

const words: PeriodMultipleWords = {
  bases: ["月払", "月払保険料", "monthly payments", "monthly premium"],
  times: ["か月分", "倍", "times"],
  links: ["の", "the"],
  skips: ["割引"],
  connectors: ["〜"],
  numberWords: [
    { word: "twelve", value: 12 },
    { word: "二", value: 2 },
  ],
};

describe("period-multiple pieces", () => {
  it("countsIn reads digits and number words, marks a following word of a multiple, and skips a tail of a larger number", () => {
    assert.deepEqual(
      countsIn("月払の12か月分", words).map((count) => [count.count, count.timed]),
      [[12, true]],
    );
    assert.deepEqual(
      countsIn("twelve times, 2,400円", words).map((count) => [count.count, count.timed]),
      [[12, true]],
    );
    assert.deepEqual(
      countsIn("十二か月分", words).map((count) => count.count),
      [],
    );
    assert.deepEqual(countsIn("", words), []);
  });

  it("phrasesIn joins a base word to a count with a word of a multiple, either way round, or to a bare count before it", () => {
    const spans = (text: string): string[] => phrasesIn(text, words).map((phrase) => `${text.slice(phrase.start, phrase.end)}=${String(phrase.count)}`);
    assert.deepEqual(spans("年払（月払の12か月分）"), ["月払の12か月分=12"]);
    assert.deepEqual(spans("12 times the monthly premium"), ["12 times the monthly premium=12"]);
    assert.deepEqual(spans("Annually (12 monthly payments)"), ["12 monthly payments=12"]);
    assert.deepEqual(spans("月払 12"), []);
    assert.deepEqual(spans("月払 | 12か月分"), []);
    assert.deepEqual(spans("月払\nの12か月分"), []);
    assert.deepEqual(spans("月払の11〜12か月分"), []);
    assert.deepEqual(spans("12か月"), []);
    assert.deepEqual(spans("12 the monthly payments"), []);
  });

  it("sentenceAround keeps to the sentence and the line", () => {
    const text = "前の文。月払の12か月分 28,800円。後の文\n次の行";
    const at = text.indexOf("月払");
    const sentence = sentenceAround(text, { start: at, end: at + 2 });
    assert.equal(text.slice(sentence.start, sentence.end), "月払の12か月分 28,800円");
  });
});

describe("period-multiple-mismatch (ja)", () => {
  it("reports an annual premium that is not twelve of the monthly one", () => {
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の12か月分） 29,800円")), ["月払の12か月分 29,800円 / 2,400円"]);
  });

  it("reports N倍 and a count before its base", () => {
    assert.deepEqual(jaDoc("月額 1,000円です。", "年額は 25,000円（月額の2倍）です。"), ["月額の2倍 25,000円 / 1,000円"]);
    assert.deepEqual(jaDoc(table("月払保険料 2,400円", "年払 12か月分の月払保険料 29,800円")), ["12か月分の月払保険料 29,800円 / 2,400円"]);
  });

  it("takes the nearest base before, and before any base only the document's one base", () => {
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の12か月分） 28,800円"), table("月払 3,000円", "年払（月払の12か月分） 28,800円")), [
      "月払の12か月分 28,800円 / 3,000円",
    ]);
    assert.deepEqual(jaDoc("年払は 29,800円（月払の12か月分）です。", table("月払 2,400円")), ["月払の12か月分 29,800円 / 2,400円"]);
    assert.deepEqual(jaDoc("年払は 29,800円（月払の12か月分）です。", table("月払 2,400円"), table("月払 3,000円")), []);
  });

  it("allows the rounding of a word of scale", () => {
    assert.deepEqual(jaDoc(table("月払 2.4万円", "年払（月払の12か月分） 28.8万円")), []);
    assert.deepEqual(jaDoc(table("月払 2.4万円", "年払（月払の12か月分） 29.8万円")), ["月払の12か月分 29.8万円 / 2.4万円"]);
  });

  it("does not compare an annual amount that does not say it is months of the monthly one", () => {
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払 28,000円")), []);
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（12か月分） 29,800円")), []);
  });

  it("does not compare a matching amount, a discount, a range, two amounts, an unclear base, no base, or another currency", () => {
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の12か月分） 28,800円")), []);
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の12か月分から5%割引） 27,360円")), []);
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の11〜12か月分） 29,800円")), []);
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の12か月分） 27,360円（割引後）")), []);
    assert.deepEqual(jaDoc("| 月払 | 2,400円 |  |\n| --- | --- | --- |\n| 年払（月払の12か月分） | 29,800円 | 2,500円 |"), []);
    assert.deepEqual(jaDoc(table("月払 2,400円（初回 3,000円）", "年払（月払の12か月分） 29,800円")), []);
    assert.deepEqual(jaDoc(table("年払（月払の12か月分） 29,800円")), []);
    assert.deepEqual(jaDoc(table("月払 $24", "年払（月払の12か月分） 29,800円")), []);
    assert.deepEqual(jaDoc(table("月払 2,400円", "年払（月払の十二か月分） 29,800円")), []);
  });
});

describe("period-multiple-mismatch (en)", () => {
  it("reports an annual premium that is not twelve monthly payments", () => {
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually (12 monthly payments): $298")), ["12 monthly payments $298 / $24"]);
    assert.deepEqual(enDoc("Your monthly premium is $24.", "The annual premium is $298 (twelve monthly payments)."), ["twelve monthly payments $298 / $24"]);
    assert.deepEqual(enDoc("Monthly premium: $24.", "Pay $298 a year, 12 times the monthly premium."), []);
    assert.deepEqual(enDoc("Monthly premium: $24.", "Annual premium: $298 (12 times the monthly premium)."), ["12 times the monthly premium $298 / $24"]);
  });

  it("does not compare a matching amount, an annual amount alone, a payment of each, a saving, or a range", () => {
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually (12 monthly payments): $288")), []);
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually (12 monthly payments): $288", "Two years (24 monthly payments): $576")), []);
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually (12 monthly payments): $288", "Two years (24 monthly payments): $580")), [
      "24 monthly payments $580 / $24",
    ]);
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually: $280")), []);
    assert.deepEqual(enDoc(enTable("Monthly: $24"), "You can pay in 12 monthly payments of $25."), []);
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually (12 monthly payments, save 3%): $279")), []);
    assert.deepEqual(enDoc(enTable("Monthly: $24", "Annually (11 to 12 monthly payments): $298")), []);
  });
});
