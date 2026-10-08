import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { scoped, scopeMarkersOf, type ScopeMarkers } from "../packages/chaff/src/detectors/superlative-scope.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Token } from "../packages/chaff/src/plugin.ts";

// 範囲を言う最上級（日本で最も、the best in the world）は限定がある。例文はすべて自作。

const RULE = "unqualified-superlative";

await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const markersOf = (adapter: LanguageAdapter): ScopeMarkers => scopeMarkersOf(adapter.lexicons["superlative-scope"] ?? []);

const tokensOf = (adapter: LanguageAdapter, text: string): Token[] => adapter.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

/** 文の中の最上級（語の並び）が範囲を持つか。最上級は最初に現れたものを見る。 */
const isScoped = (adapter: LanguageAdapter, text: string, superlative: readonly string[]): boolean => {
  const tokens = tokensOf(adapter, text);
  const start = tokens.findIndex((_token, at) => superlative.every((word, offset) => tokens[at + offset]?.surface.toLowerCase() === word));
  if (start === -1) throw new Error(`${superlative.join(" ")} が ${text} に無い`);
  return scoped(tokens, { start, end: start + superlative.length }, markersOf(adapter));
};

describe("superlative-scope（ja）", () => {
  it("名前 + で + 最上級は範囲を持つ（地名・組織名・地名の単位）", () => {
    assert.ok(isScoped(ja, "日本で最も有名な寺です。", ["最も"]));
    assert.ok(isScoped(ja, "トヨタで最も売れた車です。", ["最も"]));
    assert.ok(isScoped(ja, "東京都で最大の公園です。", ["最大"]));
  });

  it("名詞が空白も助詞も挟まずに付いた最上級は範囲を持つ", () => {
    assert.ok(isScoped(ja, "国内最大の工場です。", ["最大"]));
    assert.ok(isScoped(ja, "業界最速の回線です。", ["最速"]));
    assert.ok(isScoped(ja, "世界唯一の製品です。", ["唯一", "の"]));
  });

  it("範囲の無い最上級は範囲を持たない", () => {
    assert.ok(!isScoped(ja, "最も効果的です。", ["最も"]));
    assert.ok(!isScoped(ja, "この方式が最も速い。", ["最も"]));
  });

  it("名前でない語 + で は手段であって範囲ではない", () => {
    assert.ok(!isScoped(ja, "最少の費用で最大の効果を上げる。", ["最大"]));
  });

  it("最上級の後ろの「で」は範囲ではない（日本語の範囲は前に来る）", () => {
    assert.ok(!isScoped(ja, "最も安い店で買い物をした。", ["最も"]));
  });

  it("空白を挟んだ名詞は複合語ではない", () => {
    assert.ok(!isScoped(ja, "品質 最高です。", ["最高"]));
  });

  it("原形の動詞か助動詞で終わる連体修飾の節は範囲を持つ", () => {
    assert.ok(isScoped(ja, "バグを検出できる唯一のルールです。", ["唯一", "の"]));
    assert.ok(isScoped(ja, "社員が選んだ最高の一品です。", ["最高"]));
    assert.ok(isScoped(ja, "手の汚れを減らす最も有効な方法です。", ["最も"]));
    assert.ok(isScoped(ja, "今年予想される最大の課題です。", ["最大"]));
  });

  it("原形でない語（連用形・形容動詞の「な」）と形容詞は節の終わりではない", () => {
    assert.ok(!isScoped(ja, "首都であり最大の都市です。", ["最大"]));
    assert.ok(!isScoped(ja, "大切な最大の理由です。", ["最大"]));
    assert.ok(!isScoped(ja, "新しい最大の課題です。", ["最大"]));
  });

  it("主語の「が」の後ろの最上級は節ではない", () => {
    assert.ok(!isScoped(ja, "この端末が唯一の実機です。", ["唯一", "の"]));
  });
});

describe("superlative-scope（en）", () => {
  it("in / of + a noun phrase after the superlative's noun phrase is a scope", () => {
    assert.ok(isScoped(en, "It is the best in the world.", ["the", "best"]));
    assert.ok(isScoped(en, "Try the best stuffed pizza in Chicago.", ["the", "best"]));
    assert.ok(isScoped(en, "It is the most famous of the sculptures.", ["the", "most"]));
    assert.ok(isScoped(en, "It was the best of the three.", ["the", "best"]));
    assert.ok(isScoped(en, "It is the most widely used tool in Japan.", ["the", "most"]));
    assert.ok(isScoped(en, "It is the fastest of all.", ["the", "fastest"]));
  });

  it("a superlative without a scope has none", () => {
    assert.ok(!isScoped(en, "It is the best solution.", ["the", "best"]));
    assert.ok(!isScoped(en, "The best way to improve is feedback.", ["the", "best"]));
    assert.ok(!isScoped(en, "Make the best decision for the company.", ["the", "best"]));
    // 空白で離れた名詞は複合語ではない。
    assert.ok(!isScoped(en, "Give customers the best experience.", ["the", "best"]));
  });

  it("a predicate or a verb phrase before in is not the superlative's noun phrase", () => {
    assert.ok(!isScoped(en, "The best is in the box.", ["the", "best"]));
    assert.ok(!isScoped(en, "The fastest teams ship features in weeks.", ["the", "fastest"]));
    assert.ok(!isScoped(en, "The best teams adapt quickly in a crisis.", ["the", "best"]));
  });

  it("in or of with no noun phrase after it is not a scope", () => {
    assert.ok(!isScoped(en, "It is the best of.", ["the", "best"]));
    assert.ok(!isScoped(en, "It is the best in helping teams.", ["the", "best"]));
  });

  it("English puts no scope before the superlative", () => {
    assert.ok(!isScoped(en, "Visit Chicago in the best season.", ["the", "best"]));
  });
});

describe("superlative-scope の語彙表", () => {
  it("どの語も position を持つ（ja・en）", () => {
    [ja, en].forEach((adapter) => {
      const entries = adapter.lexicons["superlative-scope"] ?? [];
      assert.ok(entries.length > 0, adapter.id);
      assert.ok(
        entries.every((entry) => entry.position !== undefined),
        adapter.id,
      );
    });
  });

  it("position で前と後ろに分け、position の無い語は使わない", () => {
    const markers = scopeMarkersOf([{ pattern: "で", position: "before" }, { pattern: "in", position: "after" }, { pattern: "of" }]);
    assert.deepEqual(
      markers.before.map((entry) => entry.pattern),
      ["で"],
    );
    assert.deepEqual(
      markers.after.map((entry) => entry.pattern),
      ["in"],
    );
    assert.deepEqual(scopeMarkersOf([]), { before: [], after: [] });
  });
});

describe("superlative-scope: 語の並びの端", () => {
  const markers = markersOf(ja);

  it("語が無ければ範囲は無い", () => {
    assert.equal(scoped([], { start: 0, end: 0 }, markers), false);
  });

  it("文頭の最上級・文末の最上級", () => {
    const tokens = tokensOf(ja, "最も");
    assert.equal(scoped(tokens, { start: 0, end: tokens.length }, markers), false);
  });

  it("範囲の語の語彙表が空なら、複合語だけを読む", () => {
    const none: ScopeMarkers = { before: [], after: [] };
    const named = tokensOf(ja, "日本で最も有名な寺です。");
    const at = named.findIndex((token) => token.surface === "最も");
    assert.equal(scoped(named, { start: at, end: at + 1 }, none), false);
    const compound = tokensOf(ja, "国内最大の工場です。");
    const largest = compound.findIndex((token) => token.surface === "最大");
    assert.equal(scoped(compound, { start: largest, end: largest + 1 }, none), true);
  });
});

describe("unqualified-superlative は範囲を持つ最上級を指摘しない", () => {
  it("範囲があれば指摘しない", () => {
    assert.ok(!superlativeReported(ja, "日本で最も有名な巡礼路です。"));
    assert.ok(!superlativeReported(ja, "国内最大の工場です。"));
    assert.ok(!superlativeReported(en, "It is the best pizza in Chicago."));
    assert.ok(!superlativeReported(en, "It was the best of the three options."));
  });

  it("範囲が無ければ指摘する", () => {
    assert.ok(superlativeReported(ja, "最も効果的です。"));
    assert.ok(superlativeReported(ja, "最少の費用で最大の効果を上げる。"));
    assert.ok(superlativeReported(en, "It is the best solution."));
  });

  it("連体修飾の節が範囲を言う最上級は指摘しない（#394）", () => {
    assert.ok(!superlativeReported(ja, "バグを検出できる唯一のルールです。"));
    assert.ok(!superlativeReported(ja, "東京で最大の店です。"));
  });

  it("節も相手も無い最上級は指摘する（#394）", () => {
    assert.ok(superlativeReported(ja, "最大の効果があります。"));
    assert.ok(superlativeReported(ja, "首都であり最大の都市です。"));
    assert.ok(superlativeReported(ja, "この端末が唯一の実機です。"));
  });

  it("英語は空白で語を分けるので、節の読みは英語に及ばない", () => {
    assert.ok(superlativeReported(en, "Teams like the best tools."));
    assert.ok(superlativeReported(en, "We offer the best service."));
  });

  it("品詞が無ければ範囲を読めないので、範囲のありそうな最上級も指摘する", () => {
    const untagged: LanguageAdapter = {
      ...ja,
      segment: (text) => ({ sentences: ja.segment(text).sentences.map((sentence) => ({ span: sentence.span, text: sentence.text })) }),
    };
    assert.ok(superlativeReported(untagged, "国内最大の工場です。"));
  });

  it("同じ文に範囲の無い出現が 1 つでもあれば指摘する", () => {
    assert.ok(superlativeReported(ja, "日本で最も有名で、最も古い寺です。"));
    assert.ok(superlativeReported(en, "It is the best pizza in Chicago and the best pasta."));
  });

  it("範囲の語彙表の無い言語では、rule は動かず理由を言う", () => {
    const bare: LanguageAdapter = { ...ja, lexicons: Object.fromEntries(Object.entries(ja.lexicons).filter(([name]) => name !== "superlative-scope")) };
    const result = runRules(buildDocument("t.md", "# T\n\n最も効果的です。\n", bare), loadRules("ja"), { [RULE]: "strict" }, true, "business/report", {
      [RULE]: 1,
    });
    assert.ok(!result.findings.some((finding) => finding.rule === RULE));
    assert.ok(result.skipped.find((entry) => entry.rule === RULE)?.why.includes("superlative-scope"));
  });
});
