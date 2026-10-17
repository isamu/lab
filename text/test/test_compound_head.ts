import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isCompoundHead } from "../packages/chaff/src/compound-head.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 複合語の頭の名詞（取扱事業者、卒業（見込）証明書）。例はすべて自作。

/** Tokens written one after another, each [surface, pos]; a "_" surface is a space that keeps its neighbours apart. */
const tokensOf = (...words: readonly (readonly [string, string])[]): Token[] =>
  words.reduce<{ tokens: Token[]; at: number }>(
    ({ tokens, at }, [surface, pos]) => ({
      tokens: surface === "_" ? tokens : [...tokens, { span: { start: at, end: at + surface.length }, surface, pos }],
      at: at + surface.length,
    }),
    { tokens: [], at: 0 },
  ).tokens;

const NONE = new Set<string>();
const headAt = (tokens: readonly Token[], at: number, suffixes: ReadonlySet<string> = NONE): boolean => {
  const token = tokens[at];
  return token !== undefined && isCompoundHead(token, tokens, at, suffixes);
};

describe("isCompoundHead", () => {
  it("名詞に名詞が続けて書かれていれば頭（取扱事業者）", () => {
    assert.equal(headAt(tokensOf(["取扱", "NOUN"], ["事業者", "NOUN"]), 0), true);
  });

  it("括弧で囲んだ名詞が、閉じ括弧の直後の名詞に続けば頭（卒業（見込）証明書）", () => {
    const tokens = tokensOf(["卒業", "NOUN"], ["（", "PUNCT"], ["見込", "NOUN"], ["）", "PUNCT"], ["証明", "NOUN"], ["書", "NOUN"]);
    assert.equal(headAt(tokens, 2), true);
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["見込", "NOUN"], ["）", "PUNCT"], ["額", "NOUN"]), 1), true);
  });

  it("閉じ括弧の後が名詞でない・離れている・語句の接尾語なら頭ではない", () => {
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["見込", "NOUN"], ["）", "PUNCT"], ["まで", "ADP"]), 1), false);
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["見込", "NOUN"], ["）", "PUNCT"], ["_", ""], ["額", "NOUN"]), 1), false);
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["割当て", "NOUN"], ["）", "PUNCT"], ["等", "NOUN"]), 1, new Set(["等"])), false);
  });

  it("括弧の中に語がほかにもあれば、括弧ごとの複合語ではない（（売上の見込）額）", () => {
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["売上", "NOUN"], ["の", "ADP"], ["見込", "NOUN"], ["）", "PUNCT"], ["額", "NOUN"]), 3), false);
  });

  it("名詞でないもの、文の端、続く語のないものは頭ではない", () => {
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["見込む", "VERB"], ["）", "PUNCT"], ["額", "NOUN"]), 1), false);
    assert.equal(headAt(tokensOf(["見込", "NOUN"]), 0), false);
    assert.equal(headAt(tokensOf(["見込", "NOUN"], ["）", "PUNCT"]), 0), false);
    assert.equal(headAt(tokensOf(["（", "PUNCT"], ["見込", "NOUN"]), 1), false);
    assert.equal(headAt([], 0), false);
  });
});
