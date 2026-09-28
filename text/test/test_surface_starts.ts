import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { surfaceStarts } from "../packages/lang-ja/src/surface-starts.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { tokenize, morphemes } from "../packages/lang-ja/src/pos.ts";

// 形態素の位置は、語の文字を本文と照らして決める。kuromoji の word_position は記号のまとまりや絵文字の後ろでずれる。

describe("surfaceStarts", () => {
  it("語を前から順に本文と照らす。同じ語が何度出ても、前の語の後ろから探す", () => {
    assert.deepEqual(surfaceStarts("のののの", ["の", "の", "の", "の"]), [0, 1, 2, 3]);
    assert.deepEqual(surfaceStarts("A と B と A", ["A", " ", "と", " ", "B", " ", "と", " ", "A"]), [0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("絵文字（UTF-16 で 2 単位）の後ろも、本文の位置のまま", () => {
    assert.deepEqual(surfaceStarts('"🪢"を結ぶ', ['"', "🪢", '"', "を", "結ぶ"]), [0, 1, 3, 4, 5]);
  });

  it("本文に無い語は undefined にし、探す位置を進めない。空の語も undefined", () => {
    assert.deepEqual(surfaceStarts("あいう", ["あ", "x", "い", "", "う"]), [0, undefined, 1, undefined, 2]);
    assert.deepEqual(surfaceStarts("", ["あ"]), [undefined]);
    assert.deepEqual(surfaceStarts("あ", []), []);
  });
});

describe("tokenize / morphemes の位置", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  // Kubernetes の日本語の文書と、手元の記事で位置がずれていた書き方。
  const lines = [
    "ミドルウェア(例:メッセージバス)、データ処理フレームワーク(例:Spark)を組み込んで提供しません。それらは別に動きます。",
    "**強制**、ターンの境目で止める。",
    '"🪢"を結ぶ。',
  ];

  lines.forEach((line) => {
    it(`どの形態素も、その位置の本文と同じ文字: ${line.slice(0, 16)}`, () => {
      const tokens = tokenize(line) ?? [];
      assert.ok(tokens.length > 0);
      assert.deepEqual(
        tokens.filter((token) => line.slice(token.span.start, token.span.end) !== token.surface).map((token) => token.surface),
        [],
      );
      const morphs = morphemes(line) ?? [];
      assert.deepEqual(
        morphs.filter((morph) => line.slice(morph.start, morph.end) !== morph.surface).map((morph) => morph.surface),
        [],
      );
    });
  });

  it("次の文の語が、前の文の形態素に紛れ込まない", () => {
    const sentences = ja.segment(lines[0] ?? "").sentences;
    assert.equal(sentences.length, 2);
    assert.deepEqual(sentences[0]?.tokens?.map((token) => token.surface).slice(-3), ["ませ", "ん", "。"]);
    assert.equal(sentences[1]?.tokens?.[0]?.surface, "それら");
  });
});
