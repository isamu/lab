import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { MIN_WITH_UNIT, scaledFiguresIn, scaleGaps, type ScaleWords } from "../packages/chaff/src/detectors/scaled-figure-unit.ts";

// number-without-unit の本文の桁の語：「83,494百万円」と何度も書く文書の、一つだけ単位を落とした「83,494百万」。例文はすべて自作。

const RULE = "number-without-unit";

const JA_WORDS: ScaleWords = {
  scales: ["千", "百万", "千万", "億", "十億", "兆"],
  forms: [
    { pattern: "円", position: "after", currency: "JPY" },
    { pattern: "¥", position: "before", currency: "JPY" },
    { pattern: "ドル", position: "after", currency: "USD" },
  ],
  joiners: ["から", "〜", "と", "、"],
};

const EN_WORDS: ScaleWords = {
  scales: ["thousand", "million", "billion"],
  forms: [
    { pattern: "$", position: "before", currency: "USD" },
    { pattern: "US$", position: "before", currency: "USD" },
    { pattern: "yen", position: "after", currency: "JPY" },
  ],
  joiners: ["to", "and", "-"],
};

const gapsOf = (text: string, words: ScaleWords): string[] =>
  scaleGaps(text, scaledFiguresIn(text, words), words.joiners).map(({ figure, unit }) => `${figure.written}/${unit}`);

const yen = (count: number): string =>
  Array.from(
    { length: count },
    (_, index) => `項目${String(index + 1)}は${String(1200 + index * 37)}百万円（前期比${String(index + 1)}％増）となりました。`,
  ).join("");

const dollars = (count: number): string =>
  Array.from({ length: count }, (_, index) => `Line ${String(index + 1)} brought in $${String(12 + index)} million.`).join(" ");

const SLIP_JA = "連結売上高は83,494百万(前期比1.2%増)となりました。";
const SLIP_EN = "Net sales were 83.4 million (up 1.2%).";

describe("number-without-unit: 本文の桁の語", () => {
  it("reads the unit after a word of scale, the mark before it, and a bare one", () => {
    assert.deepEqual(
      scaledFiguresIn("売上高83,494百万円、利益は5,000百万(増)、3千台、¥12億。", JA_WORDS).map((figure) => `${figure.written}:${figure.unit}`),
      ["83,494百万:円", "5,000百万:", "3千:台", "12億:¥"],
    );
    assert.deepEqual(
      scaledFiguresIn("Sales were $83 million, 2 million people came, and 4.5 billion (net).", EN_WORDS).map((figure) => `${figure.written}:${figure.unit}`),
      ["83 million:$", "2 million:people", "4.5 billion:"],
    );
  });

  it("leaves out a number that runs on into another (1億2,000万円) and a word that only starts with the scale (millions)", () => {
    assert.deepEqual(
      scaledFiguresIn("総額1億2,000万円", JA_WORDS).map((figure) => figure.written),
      [],
    );
    assert.deepEqual(
      scaledFiguresIn("in 3 millions of ways", EN_WORDS).map((figure) => figure.written),
      [],
    );
  });

  it("ja: reports the one 百万 without 円 among many 百万円", () => {
    assert.deepEqual(gapsOf(`${yen(MIN_WITH_UNIT)}${SLIP_JA}`, JA_WORDS), ["83,494百万/円"]);
    assert.deepEqual(namedRuleRun(RULE, `${yen(MIN_WITH_UNIT)}${SLIP_JA}\n`, ja).findings, [
      "「83,494百万」に単位がありません（この文書は「百万」の付いたほかの数に「円」を付けています）",
    ]);
  });

  it("en: reports the one million without $ among many $ million", () => {
    assert.deepEqual(namedRuleRun(RULE, `${dollars(MIN_WITH_UNIT)} ${SLIP_EN}\n`, en).findings, [
      '"83.4 million" has no unit (the document gives its other "million" figures "$")',
    ]);
  });

  it("does not report when the unit is written fewer times than the threshold", () => {
    assert.deepEqual(gapsOf(`${yen(MIN_WITH_UNIT - 1)}${SLIP_JA}`, JA_WORDS), []);
    assert.deepEqual(namedRuleRun(RULE, `${dollars(MIN_WITH_UNIT - 1)} ${SLIP_EN}\n`, en).findings, []);
  });

  it("does not report a document that writes 百万 alone under a table caption of 単位：百万円", () => {
    const source = [
      "（単位：百万円）",
      "",
      "売上高は1,200百万、営業利益は84百万、経常利益は80百万、当期純利益は52百万、総資産は3,400百万、純資産は2,100百万となりました。",
      "",
    ].join("\n");
    assert.deepEqual(namedRuleRun(RULE, source, ja).findings, []);
  });

  it("does not report when two numbers lack the unit, or the word carries two units", () => {
    assert.deepEqual(gapsOf(`${yen(MIN_WITH_UNIT)}${SLIP_JA}営業利益は5,000百万(同7.2%増)。`, JA_WORDS), []);
    assert.deepEqual(gapsOf(`${yen(MIN_WITH_UNIT)}発行済株式は120百万株です。${SLIP_JA}`, JA_WORDS), []);
    assert.deepEqual(namedRuleRun(RULE, `${dollars(MIN_WITH_UNIT)} About 9 million people visited. ${SLIP_EN}\n`, en).findings, []);
  });

  it("does not report a number whose unit is written once for two (100百万から200百万円, $1.1 million to 1.3 million)", () => {
    assert.deepEqual(gapsOf(`${yen(MIN_WITH_UNIT)}目標は100百万から200百万円です。`, JA_WORDS), []);
    assert.deepEqual(gapsOf(`${yen(MIN_WITH_UNIT)}目標は100百万〜200百万円です。`, JA_WORDS), []);
    assert.deepEqual(gapsOf(`${dollars(MIN_WITH_UNIT)} Costs rose from $1.1 million to 1.3 million.`, EN_WORDS), []);
    assert.deepEqual(gapsOf(`${dollars(MIN_WITH_UNIT)} Costs ranged from 1 million to $2 million.`, EN_WORDS), []);
  });

  it("compares each word of scale with itself: 千円 does not make a bare 百万 a slip", () => {
    const thousands = Array.from({ length: MIN_WITH_UNIT }, (_, index) => `費用${String(index)}は${String(300 + index)}千円です。`).join("");
    assert.deepEqual(gapsOf(`${thousands}${SLIP_JA}`, JA_WORDS), []);
  });

  it("does not read code", () => {
    assert.deepEqual(namedRuleRun(RULE, `${yen(MIN_WITH_UNIT)}\n\n\`\`\`\n${SLIP_JA}\n\`\`\`\n`, ja).findings, []);
  });
});
