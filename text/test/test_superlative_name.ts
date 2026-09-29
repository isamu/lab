import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { namesQuantity } from "../packages/chaff/src/detectors/superlative-name.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Lexicon, Token } from "../packages/chaff/src/plugin.ts";

// 最上級の名詞が量の名詞と 1 語になったもの（最大風速）は量の名前。例文は自作か、気象庁 FAQ（PDL1.0）の抜き書き。

const RULE = "unqualified-superlative";

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const quantitiesOf = (adapter: LanguageAdapter): Lexicon => adapter.lexicons["quantity-noun"] ?? [];

const tokensOf = (adapter: LanguageAdapter, text: string): Token[] => adapter.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

/** 文の中の最上級（語の並び）が量の名前か。最上級は最初に現れたものを見る。 */
const isName = (adapter: LanguageAdapter, text: string, superlative: readonly string[], quantities: Lexicon = quantitiesOf(adapter)): boolean => {
  const tokens = tokensOf(adapter, text);
  const start = tokens.findIndex((_token, at) => superlative.every((word, offset) => tokens[at + offset]?.surface.toLowerCase() === word));
  if (start === -1) throw new Error(`${superlative.join(" ")} が ${text} に無い`);
  return namesQuantity(tokens, { start, end: start + superlative.length }, quantities);
};

const noun = (surface: string, start: number): Token => ({ surface, pos: "NOUN", span: { start, end: start + surface.length } });

describe("namesQuantity（ja）", () => {
  it("最上級の名詞に量の名詞がそのまま付けば量の名前", () => {
    assert.ok(isName(ja, "台風の強さは、最大風速の大きさで分類しています。", ["最大"]));
    assert.ok(isName(ja, "最高気温が上がる。", ["最高"]));
    assert.ok(isName(ja, "最大値を取る。", ["最大"]));
    assert.ok(isName(ja, "最高速度を守る。", ["最高"]));
  });

  it("名詞が続けば、連なりの最後の語で決める", () => {
    assert.ok(isName(ja, "最大瞬間風速を観測した。", ["最大"]));
    assert.ok(isName(ja, "最大駐車台数は決まっている。", ["最大"]));
    assert.ok(!isName(ja, "最高気温予想を出す。", ["最高"]));
  });

  it("量で終わらない名詞が付けば、一番だという主張", () => {
    assert.ok(!isName(ja, "最高品質のサービスです。", ["最高"]));
    assert.ok(!isName(ja, "最大規模の工場です。", ["最大"]));
    assert.ok(!isName(ja, "最速配送を提供します。", ["最速"]));
    assert.ok(!isName(ja, "最大効果を得ます。", ["最大"]));
    assert.ok(!isName(ja, "最大級の台風です。", ["最大"]));
  });

  it("主張にも付く語（度・率・価値）で終われば主張", () => {
    assert.ok(!isName(ja, "最高精度を実現しました。", ["最高"]));
    assert.ok(!isName(ja, "最高強度を実現しました。", ["最高"]));
    assert.ok(!isName(ja, "最高満足度を獲得しました。", ["最高"]));
    assert.ok(!isName(ja, "最高成功率です。", ["最高"]));
    assert.ok(!isName(ja, "最大価値を提供します。", ["最大"]));
  });

  it("量の名詞の語彙表が空なら、どれも名前ではない", () => {
    assert.ok(!isName(ja, "最大風速が強い。", ["最大"], []));
  });

  it("助詞を挟めば名前ではなく主張", () => {
    assert.ok(!isName(ja, "最大の効果を上げる。", ["最大"]));
    assert.ok(!isName(ja, "最高です。", ["最高"]));
  });

  it("副詞の最上級は名詞と 1 語にならない", () => {
    assert.ok(!isName(ja, "最も速度が出る。", ["最も"]));
  });

  it("2 語の最上級は名前を作らない", () => {
    assert.ok(!isName(ja, "世界初速度を記録した。", ["世界", "初"]));
  });

  it("記号・空白・括弧は名前の後ろ半分にならない", () => {
    assert.ok(!isName(ja, "最大 風速", ["最大"]));
    assert.ok(!isName(ja, "最大（風速）", ["最大"]));
    const values: Lexicon = [{ pattern: "!" }];
    assert.equal(namesQuantity([noun("最高", 0), noun("!", 2)], { start: 0, end: 1 }, values), false);
  });

  it("間を空けた名詞とは 1 語にならない", () => {
    const speed: Lexicon = [{ pattern: "speed" }];
    assert.equal(namesQuantity([noun("maximum", 0), noun("speed", 8)], { start: 0, end: 1 }, speed), false);
    assert.equal(namesQuantity([noun("maximum", 0), noun("speed", 7)], { start: 0, end: 1 }, speed), true);
    assert.equal(namesQuantity([noun("maximum", 0), noun("wind", 7), noun("speed", 12)], { start: 0, end: 1 }, speed), false);
  });

  it("文末の最上級・語が無いとき", () => {
    const tokens = tokensOf(ja, "最大");
    assert.equal(namesQuantity(tokens, { start: 0, end: tokens.length }, quantitiesOf(ja)), false);
    assert.equal(namesQuantity([], { start: 0, end: 0 }, quantitiesOf(ja)), false);
  });
});

describe("namesQuantity（en）", () => {
  it("English writes a space before the noun, so a superlative never joins it", () => {
    assert.ok(!isName(en, "It is the best speed.", ["the", "best"]));
    assert.ok(!isName(en, "Buy the fastest car.", ["the", "fastest"]));
  });

  it("the English list of quantity nouns is empty", () => {
    assert.deepEqual(quantitiesOf(en), []);
  });
});

describe("unqualified-superlative は量の名前を指摘しない", () => {
  it("気象庁 FAQ の最大風速", () => {
    assert.ok(!superlativeReported(ja, "台風の強さは、最大風速の大きさで分類しています。"));
    assert.ok(
      !superlativeReported(
        ja,
        "このように、それぞれの名称を付している最大風速の基準には違いはありますが、台風もハリケーンもサイクロンもそれぞれの地域に存在する熱帯低気圧を強さによって分類している用語の１つということになります。",
      ),
    );
    assert.ok(!superlativeReported(ja, "最高気温と最大値を記録する。"));
  });

  it("主張の最上級は指摘する", () => {
    assert.ok(superlativeReported(ja, "最大の効果を上げる。"));
    assert.ok(superlativeReported(ja, "最高品質のサービスです。"));
    assert.ok(superlativeReported(ja, "最速配送を提供します。"));
  });

  it("同じ文に名前と主張があれば指摘する", () => {
    assert.ok(superlativeReported(ja, "最大風速が強まり、最大の被害が出た。"));
  });

  it("量の名詞の語彙表が無い言語では、rule は動かず理由を言う", () => {
    const bare: LanguageAdapter = { ...ja, lexicons: Object.fromEntries(Object.entries(ja.lexicons).filter(([name]) => name !== "quantity-noun")) };
    const result = runRules(buildDocument("t.md", "# T\n\n最も効果的です。\n", bare), loadRules("ja"), { [RULE]: "strict" }, true, "business/report", {
      [RULE]: 1,
    });
    assert.ok(!result.findings.some((finding) => finding.rule === RULE));
    assert.ok(result.skipped.find((entry) => entry.rule === RULE)?.why.includes("quantity-noun"));
  });
});
