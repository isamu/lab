import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 比較を言う語は言語パッケージの語彙表 comparison-marker が持つ。例文はすべて自作。

const RULE = "unqualified-superlative";

// 語として照らすのは品詞を読んだときだけ。rule は pos を使う。
await ja.prepare?.({ pos: true });
await en.prepare?.({ pos: true });

const patternsOf = (adapter: LanguageAdapter, list: string): string[] => (adapter.lexicons[list] ?? []).map((entry) => entry.pattern);

/** 最上級の語と比較の語を、どれも一文に入れる。比較の語は、動詞なら文の中の形で書く。 */
const SENTENCES: Readonly<
  Record<
    string,
    {
      readonly bare: (superlative: string) => string;
      readonly measured: (superlative: string) => string;
      readonly marked: (superlative: string, marker: string) => string;
    }
  >
> = {
  en: {
    bare: (superlative) => `Our tool is ${superlative} useful option.`,
    measured: (superlative) => `Our tool is ${superlative} useful option with 3 tools.`,
    marked: (superlative, marker) => `Our tool is ${superlative} useful option ${marker} the others.`,
  },
  ja: {
    bare: (superlative) => `本製品は${superlative}の性能です。`,
    measured: (superlative) => `本製品は${superlative}の性能で、処理は 3 倍です。`,
    marked: (superlative, marker) => `本製品は他社の製品${marker === "に比べる" ? "に比べて" : marker}${superlative}の性能です。`,
  },
};

[en, ja].forEach((adapter) => {
  const sentences = SENTENCES[adapter.id];
  if (sentences === undefined) throw new Error(adapter.id);
  const superlatives = patternsOf(adapter, "superlative");
  const markers = patternsOf(adapter, "comparison-marker");
  const pairs = superlatives.flatMap((superlative) => markers.map((marker): readonly [string, string] => [superlative, marker]));

  describe(`comparison-marker（${adapter.id}）`, () => {
    it("語彙表がある", () => {
      assert.ok(markers.length > 0);
    });

    it("どの最上級も、比較の語が無ければ指摘する", () => {
      superlatives.forEach((superlative) => {
        assert.ok(superlativeReported(adapter, sentences.bare(superlative)), superlative);
      });
    });

    it("どの最上級も、どの比較の語があっても指摘しない", () => {
      pairs.forEach(([superlative, marker]) => {
        assert.ok(!superlativeReported(adapter, sentences.marked(superlative, marker)), `${superlative} + ${marker}`);
      });
    });

    it("数字があれば測った結果を言っているので指摘しない", () => {
      superlatives.forEach((superlative) => {
        assert.ok(!superlativeReported(adapter, sentences.measured(superlative)), superlative);
      });
    });
  });
});

describe("比較の語は語として照らす", () => {
  it("語の一部には当たらない（thanks・accordingly・amongst・そのうち）", () => {
    assert.ok(superlativeReported(en, "Thanks, it is the fastest."));
    assert.ok(superlativeReported(en, "It is the best, accordingly."));
    assert.ok(superlativeReported(en, "Amongst friends it is the best."));
    assert.ok(superlativeReported(ja, "そのうち最も速くなります。"));
  });

  it("活用した動詞にも当たる（に比べると・に比べ、）", () => {
    assert.ok(!superlativeReported(ja, "他社に比べると最も速いです。"));
    assert.ok(!superlativeReported(ja, "他社に比べ、最も速いです。"));
  });
});

describe("comparison-marker の無い言語", () => {
  it("rule は動かず、語彙表が無いと理由を言う（比較のある文まで指摘しない）", () => {
    const bare: LanguageAdapter = { ...en, lexicons: Object.fromEntries(Object.entries(en.lexicons).filter(([name]) => name !== "comparison-marker")) };
    const result = runRules(
      buildDocument("t.md", "# T\n\nIt is the fastest tool than the old one.\n", bare),
      loadRules("en"),
      { [RULE]: "strict" },
      true,
      "business/report",
      {
        [RULE]: 1,
      },
    );
    assert.ok(!result.findings.some((finding) => finding.rule === RULE));
    assert.ok(result.skipped.find((entry) => entry.rule === RULE)?.why.includes("comparison-marker"));
  });
});
