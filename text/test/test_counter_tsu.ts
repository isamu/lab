import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readCounterTsu, type Morpheme } from "../packages/lang-ja/src/counter-tsu.ts";
import { readsAsCounter } from "../packages/lang-ja/src/pos.ts";
import { countedAfter, countedByTable, quantities } from "../packages/lang-ja/src/quantities.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { buildStructure } from "../packages/chaff/src/structure/of.ts";
import type { StructureNode } from "../packages/chaff/src/plugin.ts";

// 物を数える「つ」（3つ、三つ、２つ）を、「3人」と同じ数と助数詞として読む。完了の助動詞の「つ」（行きつ戻りつ）はそのまま。

const morpheme = (surface: string, pos: string, detail1 = "*", detail2 = "*"): Morpheme => ({
  surface_form: surface,
  pos,
  pos_detail_1: detail1,
  pos_detail_2: detail2,
  basic_form: surface,
});

const TSU_AUX = morpheme("つ", "助動詞");

const shape = (morphemes: readonly Morpheme[]): string[] =>
  morphemes.map((item) => `${item.surface_form}/${item.pos},${item.pos_detail_1},${item.pos_detail_2}/${item.basic_form}`);

describe("readCounterTsu", () => {
  it("reads つ right after an Arabic numeral as a counter", () => {
    ["3", "10", "２"].forEach((number) => {
      const read = readCounterTsu([morpheme(number, "名詞", "数"), TSU_AUX, morpheme("の", "助詞", "連体化")]);
      assert.deepEqual(shape(read), [`${number}/名詞,数,*/${number}`, "つ/名詞,接尾,助数詞/つ", "の/助詞,連体化,*/の"], number);
    });
  });

  it("splits a one-word count (三つ, ２つ, 10つ) into a numeral and the counter", () => {
    [
      ["三つ", "三"],
      ["九つ", "九"],
      ["２つ", "２"],
      ["１０つ", "１０"],
    ].forEach(([word = "", number = ""]) => {
      assert.deepEqual(shape(readCounterTsu([morpheme(word, "名詞", "一般")])), [`${number}/名詞,数,*/${number}`, "つ/名詞,接尾,助数詞/つ"], word);
    });
  });

  it("leaves the auxiliary つ after a verb, a space, a kanji numeral or at the start", () => {
    const cases: readonly (readonly Morpheme[])[] = [
      [morpheme("行き", "動詞", "自立"), TSU_AUX, morpheme("戻り", "動詞", "自立"), TSU_AUX],
      [morpheme("3", "名詞", "数"), morpheme(" ", "記号", "空白"), TSU_AUX],
      [morpheme("十", "名詞", "数"), TSU_AUX],
      [morpheme("数", "名詞", "数"), TSU_AUX],
      [TSU_AUX],
      [morpheme("3", "名詞", "一般"), TSU_AUX],
    ];
    cases.forEach((morphemes) => assert.deepEqual(readCounterTsu(morphemes), morphemes, shape(morphemes).join(" ")));
  });

  it("leaves words that only contain or end in つ, and つ that is not the auxiliary", () => {
    const cases: readonly Morpheme[] = [
      morpheme("三つ巴", "名詞", "一般"),
      morpheme("ひとつ", "名詞", "副詞可能"),
      morpheme("ふたつ", "名詞", "一般"),
      morpheme("十つ", "名詞", "一般"),
      morpheme("一つ", "名詞", "固有名詞"),
      morpheme("つめ", "名詞", "一般"),
      morpheme("いくつ", "名詞", "代名詞"),
    ];
    cases.forEach((item) => assert.deepEqual(readCounterTsu([morpheme("3", "名詞", "数"), item]), [morpheme("3", "名詞", "数"), item], item.surface_form));
    assert.deepEqual(readCounterTsu([morpheme("3", "名詞", "数"), morpheme("つ", "動詞", "自立")]), [
      morpheme("3", "名詞", "数"),
      morpheme("つ", "動詞", "自立"),
    ]);
  });

  it("returns nothing for nothing", () => {
    assert.deepEqual(readCounterTsu([]), []);
  });
});

type Attr = string | number | boolean | undefined;

const quantityOf = (text: string): [string, Attr, Attr][] =>
  quantities(text).map((mention) => [text.slice(mention.start, mention.end), mention.attrs["value"], mention.attrs["unit"]]);

const tokensOf = (text: string): string[] =>
  ja
    .segment(text)
    .sentences.flatMap((sentence) => sentence.tokens ?? [])
    .map((token) => `${token.surface}/${token.pos}${token.features === undefined ? "" : JSON.stringify(token.features)}`);

const CARD = JSON.stringify({ NumType: "Card" });
const CLASS = JSON.stringify({ NounType: "Class" });

const RULES = loadRules("ja");

const idsFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, {}, true, "business/report").findings.map((finding) => finding.rule);

describe("数と「つ」を解析器で読む", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("gives 3つ, 三つ, ２つ the numeral and counter features", () => {
    assert.deepEqual(tokensOf("3つの理由"), [`3/NOUN${CARD}`, `つ/NOUN${CLASS}`, "の/ADP", "理由/NOUN"]);
    assert.deepEqual(tokensOf("三つの理由"), [`三/NOUN${CARD}`, `つ/NOUN${CLASS}`, "の/ADP", "理由/NOUN"]);
    assert.deepEqual(tokensOf("２つ目"), [`２/NOUN${CARD}`, `つ/NOUN${CLASS}`, "目/NOUN"]);
    assert.deepEqual(tokensOf("3 つの案"), [`3/NOUN${CARD}`, " /PUNCT", `つ/NOUN${CLASS}`, "の/ADP", "案/NOUN"]);
  });

  it("reads them as quantities", () => {
    assert.deepEqual(quantityOf("理由は3つある。"), [["3つ", 3, "つ"]]);
    assert.deepEqual(quantityOf("三つの理由と一つずつの確認"), [
      ["三つ", 3, "つ"],
      ["一つ", 1, "つ"],
    ]);
    assert.deepEqual(quantityOf("候補を２つ選ぶ。"), [["２つ", 2, "つ"]]);
    assert.deepEqual(quantityOf("5つ星と 3 つの案"), [
      ["5つ", 5, "つ"],
      ["3 つ", 3, "つ"],
    ]);
    assert.equal(readsAsCounter("3", "つ"), true);
  });

  it("does not read the auxiliary つ, idioms or kana counts as counters", () => {
    assert.deepEqual(tokensOf("行きつ戻りつ"), ["行き/VERB", "つ/AUX", "戻り/VERB", "つ/AUX"]);
    assert.deepEqual(tokensOf("三つ巴"), ["三つ巴/NOUN"]);
    assert.deepEqual(tokensOf("ひとつ試す"), ["ひとつ/NOUN", "試す/VERB"]);
    ["行きつ戻りつ", "三つ巴の争い", "ひとつ試す", "いくつかある", "3つめの案"].forEach((text) => assert.deepEqual(quantityOf(text), [], text));
  });

  it("reads a count followed by 目 as an order, not a quantity", () => {
    ["3つ目の案", "二つ目の案", "3 つ目の案", "2回目の会議", "1年目の社員", "5人目の担当"].forEach((text) => assert.deepEqual(quantityOf(text), [], text));
    assert.deepEqual(quantityOf("3つ目標を立てる。"), [["3つ", 3, "つ"]]);
    assert.deepEqual(quantityOf("2回、目を通す。"), [["2回", 2, "回"]]);
  });

  it("reads つ after a number on the table path too", () => {
    assert.deepEqual(
      ["理由は3つある。", "三つの理由", "２つ選ぶ"].map((text) => countedByTable(text).map((item) => [item.value, item.unit])),
      [[[3, "つ"]], [[3, "つ"]], [[2, "つ"]]],
    );
    assert.deepEqual(countedByTable("3つめの案"), []);
    assert.deepEqual(
      countedByTable("10日めどに回答する").map((item) => item.unit),
      ["日"],
    );
  });

  it("reads 目 after a counter as an order on the table path too", () => {
    ["2回目の会議", "3つ目の案", "1 行目に出る"].forEach((text) => assert.deepEqual(countedByTable(text), [], text));
    assert.deepEqual(
      ["2回目標を立てる", "5人目線で見る"].map((text) => countedByTable(text).map((item) => item.unit)),
      [["回"], ["人"]],
    );
    assert.deepEqual(
      countedByTable("2回の会議").map((item) => item.unit),
      ["回"],
    );
  });

  it("does not count a count ending (理由は3つ。) as a plain-style sentence", () => {
    assert.ok(!idsFor("運用を始めます。手順を作ります。研修も予定しています。理由は3つ。").includes("no-mixed-desumasu"));
  });

  it("does not read a heading that opens with a count (## 4 つで足りないとき) as a numbered article", () => {
    assert.equal(countedAfter("4", "つで足りないとき"), true);
    assert.equal(countedAfter("4", "設定"), false);
    const structure = ja.structure;
    if (structure === undefined) throw new Error("lang-ja has no structure");
    const source = ["# 設定", "", "## 1 概要", "", "本文。", "", "## 4 つで足りないとき", "", "本文。"].join("\n");
    const articles = (node: StructureNode): string[] => [...(node.kind === "article" ? [node.address] : []), ...node.children.flatMap(articles)];
    assert.deepEqual(articles(buildStructure({ path: "c.md", source, language: "ja", markdown: true }, structure)), ["1"]);
  });
});
