import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter } from "../packages/lang-ja/src/index.ts";
import { cutRunInHeadings, headingOpeners } from "../packages/lang-ja/src/run-in-heading.ts";

// 改行を落として一行になった報告書では、項目の番号と見出しが本文の文へ句点なしに続く。見出しと本文の境が字で分かる所で文を改める。
// 例文はすべて自作。

const OPENERS = headingOpeners(["当連結会計年度", "当期", "当社グループ", "当社"]);

const piecesOf = (source: string): string[] =>
  cutRunInHeadings(source, { start: 0, end: source.length }, OPENERS).map((span) => source.slice(span.start, span.end));

const textsOf = (source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);

const rulesOf = (source: string, rules: readonly string[]): string[] => firedRules(adapter, source).filter((rule) => rules.includes(rule));

describe("cutRunInHeadings: 項目の番号の見出しを本文から切る", () => {
  it("本文を始める語の前で切る", () => {
    const source = "以上であります。(3）売上の実績当期の売上は次のとおりであります。";
    const span = { start: "以上であります。".length, end: source.length };
    assert.deepEqual(
      cutRunInHeadings(source, span, OPENERS).map((part) => source.slice(part.start, part.end)),
      ["(3）売上の実績", "当期の売上は次のとおりであります。"],
    );
  });

  it("囲み数字・括弧の番号（幅の違う閉じも）の後ろ、行の途中だけ", () => {
    assert.deepEqual(piecesOf("x①財政状態当連結会計年度末の資産は増えました。").slice(0, 1), ["x①財政状態当連結会計年度末の資産は増えました。"]);
    const source = "増えました。①財政状態当連結会計年度末の資産は増えました。";
    const start = "増えました。".length;
    assert.deepEqual(
      cutRunInHeadings(source, { start, end: source.length }, OPENERS).map((part) => source.slice(part.start, part.end)),
      ["①財政状態", "当連結会計年度末の資産は増えました。"],
    );
  });

  it("見出しの頭の語を本文がもう一度書き出す所で切る", () => {
    const source = "です。④設備の更新設備の更新は来期に行います。";
    const start = "です。".length;
    assert.deepEqual(
      cutRunInHeadings(source, { start, end: source.length }, OPENERS).map((part) => source.slice(part.start, part.end)),
      ["④設備の更新", "設備の更新は来期に行います。"],
    );
  });

  it("節の番号と墨付き括弧の題（と括弧の副題）の後ろで切る。行の頭でも", () => {
    assert.deepEqual(piecesOf("５【重要な契約】（倉庫の賃貸借契約）当社は倉庫を借りております。"), [
      "５【重要な契約】（倉庫の賃貸借契約）",
      "当社は倉庫を借りております。",
    ]);
    assert.deepEqual(piecesOf("４【業績の分析】(1）業績の状況当期の売上は増えました。"), ["４【業績の分析】", "(1）業績の状況", "当期の売上は増えました。"]);
  });

  it("印のすぐ後ろが本文なら、印だけを切る。見出しの後ろに本文の語があれば、そちらを取る", () => {
    const after = (source: string, before: string): string[] =>
      cutRunInHeadings(source, { start: before.length, end: source.length }, OPENERS).map((part) => source.slice(part.start, part.end));
    assert.deepEqual(after("ました。(2）当社は工場を売却しました。", "ました。"), ["(2）", "当社は工場を売却しました。"]);
    assert.deepEqual(after("ました。⑥当社の知名度の向上当社は広告を増やします。", "ました。"), ["⑥当社の知名度の向上", "当社は広告を増やします。"]);
    assert.deepEqual(after("ました。② 当社の弱み　当社は規模が小さい。", "ました。"), ["② 当社の弱み　", "当社は規模が小さい。"]);
  });

  it("見出しの中の次の項目の印の前で切る", () => {
    const source = "です。(1)業績の概要①売上の状況当期の売上は増えました。";
    assert.deepEqual(
      cutRunInHeadings(source, { start: "です。".length, end: source.length }, OPENERS).map((part) => source.slice(part.start, part.end)),
      ["(1)業績の概要", "①売上の状況", "当期の売上は増えました。"],
    );
  });

  it("境の分からない見出し、本文の中の語、括弧の中、助詞の後ろでは切らない", () => {
    const keep = (source: string, before: string): void => {
      const span = { start: before.length, end: source.length };
      assert.deepEqual(cutRunInHeadings(source, span, OPENERS), [span], source);
    };
    keep("です。③費用の最適化設備の維持は大切です。", "です。");
    keep("です。(2）売上高は当期に増えました。", "です。");
    keep("です。①の規定により当社は届け出ます。", "です。");
    keep("です。(1)業績（業績に関する分析の詳細）を示します。", "です。");
    keep("です。②売上、当期の売上は増えました。", "です。");
    keep("５【重要な契約】に記載のとおりです。", "");
  });

  it("本文を始める語は、後ろが助詞か「末」のときだけ（当期純利益の「当期」は語の頭）", () => {
    const source = "です。①当期純利益の推移当期純利益は増えました。";
    assert.deepEqual(
      cutRunInHeadings(source, { start: "です。".length, end: source.length }, OPENERS).map((part) => source.slice(part.start, part.end)),
      ["①当期純利益の推移", "当期純利益は増えました。"],
    );
  });
});

describe("一行の報告書: 見出しは本文の文に入らない", () => {
  before(async () => {
    await adapter.prepare?.({ pos: true });
  });

  const REPORT =
    "当社は倉庫を持っております。当社は工場を持っております。(3）売上の実績当期の売上の状況は次のとおりであります。②財産の状況当連結会計年度末の財産は増えました。";

  it("番号の見出しは本文と別の文", () => {
    assert.deepEqual(textsOf(REPORT), [
      "当社は倉庫を持っております。",
      "当社は工場を持っております。",
      "(3）売上の実績",
      "当期の売上の状況は次のとおりであります。",
      "②財産の状況",
      "当連結会計年度末の財産は増えました。",
    ]);
  });

  it("見出しの漢字が本文の漢字に続かず、見出しの「の」が本文の「の」に数えられない", () => {
    assert.deepEqual(rulesOf("増えました。①財政状態当連結会計年度末の資産は増えました。", ["max-kanji-continuous"]), []);
    assert.deepEqual(rulesOf("進めます。②技術力の強化当社の強みの源は技術であります。", ["no-doubled-joshi"]), []);
  });

  it("文末の並びは見出しで切れる", () => {
    const source = "当社は倉庫を持っております。当社は工場を持っております。(2)今後の方針当社は店舗を増やしております。";
    assert.deepEqual(rulesOf(source, ["repeated-sentence-ending"]), []);
    assert.deepEqual(rulesOf(source.replace("(2)今後の方針", ""), ["repeated-sentence-ending"]), ["repeated-sentence-ending"]);
  });
});
