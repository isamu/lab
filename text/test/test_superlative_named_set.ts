import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { superlativeReported } from "./rule-run.ts";
import { makesWord } from "../packages/chaff/src/detectors/superlative-name.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { Lexicon, Token } from "../packages/chaff/src/plugin.ts";

// unqualified-superlative と、すぐ前で何の中で最もなのかを言う最上級（Ｇ７の中で最も）、
// 接尾辞の付いた別の語（最大化する）。例文は自作。

await ja.prepare?.({ pos: true });

const tokensOf = (text: string): Token[] => ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

const SUFFIXES: Lexicon = [{ pattern: "化" }];

describe("unqualified-superlative: the set named right before the superlative", () => {
  it("does not report a superlative right after の中で", () => {
    [
      "物価の上がり方は、Ｇ７の中で最も低い水準にあります。",
      "賃金の伸びは、先進国の中で最も高い水準です。",
      "参加国のなかで最も早く手続きを終えました。",
      "この町の中では最も古い店です。",
    ].forEach((sentence) => assert.equal(superlativeReported(ja, sentence), false, sentence));
  });

  it("still reports a superlative with no set before it", () => {
    ["最大の課題は、人手不足です。", "当社の製品は最も優れています。", "この方法で最高の結果が出ます。", "会議の中で、最も大事な点を決めました。"].forEach(
      (sentence) => assert.equal(superlativeReported(ja, sentence), true, sentence),
    );
  });
});

describe("unqualified-superlative: a suffix that makes another word", () => {
  it("does not report 最大化, a verb", () => {
    ["売上を最大化します。", "効果を最大化する取組を進めます。"].forEach((sentence) => assert.equal(superlativeReported(ja, sentence), false, sentence));
  });

  it("makesWord reads the suffix only when it is joined to the superlative", () => {
    const tokens = tokensOf("効果を最大化する。");
    const at = tokens.findIndex((token) => token.surface === "最大");
    assert.equal(makesWord(tokens, { start: at, end: at + 1 }, SUFFIXES), true);
    assert.equal(makesWord(tokens, { start: at, end: at + 1 }, []), false);
    assert.equal(makesWord(tokens, { start: tokens.length - 1, end: tokens.length }, SUFFIXES), false);
    const apart = tokensOf("最大 化");
    assert.equal(makesWord(apart, { start: 0, end: 1 }, SUFFIXES), false);
  });
});
