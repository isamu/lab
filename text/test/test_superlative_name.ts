import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { namesQuantity } from "../packages/chaff/src/detectors/superlative-name.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Lexicon, Token } from "../packages/chaff/src/plugin.ts";

// 最上級の名詞が次の名詞と 1 語になったもの（最大風速）は量の名前。例文は自作か、気象庁 FAQ（PDL1.0）の抜き書き。

const RULE = "unqualified-superlative";

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const gradesOf = (adapter: LanguageAdapter): Lexicon => adapter.lexicons["superlative-grade"] ?? [];

const tokensOf = (adapter: LanguageAdapter, text: string): Token[] => adapter.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

/** 文の中の最上級（語の並び）が量の名前か。最上級は最初に現れたものを見る。 */
const isName = (adapter: LanguageAdapter, text: string, superlative: readonly string[], grades: Lexicon = gradesOf(adapter)): boolean => {
  const tokens = tokensOf(adapter, text);
  const start = tokens.findIndex((_token, at) => superlative.every((word, offset) => tokens[at + offset]?.surface.toLowerCase() === word));
  if (start === -1) throw new Error(`${superlative.join(" ")} が ${text} に無い`);
  return namesQuantity(tokens, { start, end: start + superlative.length }, grades);
};

const reported = (adapter: LanguageAdapter, sentence: string): boolean =>
  runRules(buildDocument("t.md", `# T\n\n${sentence}\n`, adapter), loadRules(adapter.id), { [RULE]: "strict" }, true, "business/report", {
    [RULE]: 1,
  }).findings.some((finding) => finding.rule === RULE);

describe("namesQuantity（ja）", () => {
  it("最上級の名詞に名詞がそのまま付けば量の名前", () => {
    assert.ok(isName(ja, "台風の強さは、最大風速の大きさで分類しています。", ["最大"]));
    assert.ok(isName(ja, "最大瞬間風速を観測した。", ["最大"]));
    assert.ok(isName(ja, "最高気温が上がる。", ["最高"]));
    assert.ok(isName(ja, "最大値を取る。", ["最大"]));
    assert.ok(isName(ja, "最高速度を守る。", ["最高"]));
    assert.ok(isName(ja, "最高裁判所の判決。", ["最高"]));
  });

  it("助詞を挟めば名前ではなく主張", () => {
    assert.ok(!isName(ja, "最大の効果を上げる。", ["最大"]));
    assert.ok(!isName(ja, "最高のパフォーマンス。", ["最高"]));
    assert.ok(!isName(ja, "最高です。", ["最高"]));
  });

  it("等級の名詞が付けば、一番の等級だという主張", () => {
    assert.ok(!isName(ja, "最高品質のサービスです。", ["最高"]));
    assert.ok(!isName(ja, "最大規模の工場です。", ["最大"]));
    assert.ok(!isName(ja, "最高レベルの技術。", ["最高"]));
    assert.ok(!isName(ja, "最大級の台風です。", ["最大"]));
  });

  it("等級の語彙表が空なら、名詞が付いたものはどれも名前", () => {
    assert.ok(isName(ja, "最高品質のサービスです。", ["最高"], []));
  });

  it("副詞の最上級は名詞と 1 語にならない", () => {
    assert.ok(!isName(ja, "最も重要です。", ["最も"]));
  });

  it("2 語の最上級は名前を作らない", () => {
    assert.ok(!isName(ja, "世界初公開です。", ["世界", "初"]));
  });

  it("漢数字が付けば、量の値を言っている", () => {
    assert.ok(isName(ja, "最大三人まで参加できる。", ["最大"]));
  });

  it("記号・空白・括弧は名前の後ろ半分にならない", () => {
    assert.ok(!isName(ja, "最高!", ["最高"]));
    assert.ok(!isName(ja, "最大 風速", ["最大"]));
    assert.ok(!isName(ja, "最大（風速）", ["最大"]));
  });

  it("間を空けた名詞とは 1 語にならない", () => {
    const noun = (surface: string, start: number): Token => ({ surface, pos: "NOUN", span: { start, end: start + surface.length } });
    assert.equal(namesQuantity([noun("maximum", 0), noun("speed", 8)], { start: 0, end: 1 }, []), false);
    assert.equal(namesQuantity([noun("maximum", 0), noun("speed", 7)], { start: 0, end: 1 }, []), true);
  });

  it("文末の最上級・語が無いとき", () => {
    const tokens = tokensOf(ja, "最大");
    assert.equal(namesQuantity(tokens, { start: 0, end: tokens.length }, []), false);
    assert.equal(namesQuantity([], { start: 0, end: 0 }, []), false);
  });
});

describe("namesQuantity（en）", () => {
  it("English writes a space before the noun, so a superlative never joins it", () => {
    assert.ok(!isName(en, "It is the best solution.", ["the", "best"]));
    assert.ok(!isName(en, "Buy the fastest car.", ["the", "fastest"]));
  });

  it("the English grade list is empty", () => {
    assert.deepEqual(gradesOf(en), []);
  });
});

describe("unqualified-superlative は量の名前を指摘しない", () => {
  it("気象庁 FAQ の最大風速", () => {
    assert.ok(!reported(ja, "台風の強さは、最大風速の大きさで分類しています。"));
    assert.ok(
      !reported(
        ja,
        "このように、それぞれの名称を付している最大風速の基準には違いはありますが、台風もハリケーンもサイクロンもそれぞれの地域に存在する熱帯低気圧を強さによって分類している用語の１つということになります。",
      ),
    );
    assert.ok(!reported(ja, "最高気温と最大値を記録する。"));
    assert.ok(!reported(ja, "最大三人まで参加できる。"));
  });

  it("主張の最上級は指摘する", () => {
    assert.ok(reported(ja, "最大の効果を上げる。"));
    assert.ok(reported(ja, "最高品質のサービスです。"));
    assert.ok(reported(ja, "最大規模の工場です。"));
  });

  it("同じ文に名前と主張があれば指摘する", () => {
    assert.ok(reported(ja, "最大風速が強まり、最大の被害が出た。"));
  });

  it("等級の語彙表が無い言語では、rule は動かず理由を言う", () => {
    const bare: LanguageAdapter = { ...ja, lexicons: Object.fromEntries(Object.entries(ja.lexicons).filter(([name]) => name !== "superlative-grade")) };
    const result = runRules(buildDocument("t.md", "# T\n\n最も効果的です。\n", bare), loadRules("ja"), { [RULE]: "strict" }, true, "business/report", {
      [RULE]: 1,
    });
    assert.ok(!result.findings.some((finding) => finding.rule === RULE));
    assert.ok(result.skipped.find((entry) => entry.rule === RULE)?.why.includes("superlative-grade"));
  });
});
