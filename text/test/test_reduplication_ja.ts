import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { distributiveParticles, markReduplication } from "../packages/lang-ja/src/reduplication.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

const PARTICLES = new Set(["で", "の"]);

/** 語を隙間なく並べた token。 */
const tokensOf = (...words: readonly (readonly [string, string])[]): Token[] =>
  words.reduce<Token[]>((acc, [surface, pos]) => {
    const start = acc.at(-1)?.span.end ?? 0;
    return [...acc, { span: { start, end: start + surface.length }, surface, pos }];
  }, []);

const echoes = (tokens: readonly Token[]): string[] =>
  markReduplication(tokens, PARTICLES).flatMap((token) => (token.features?.["Echo"] === "Rdp" ? [`${token.surface}@${String(token.span.start)}`] : []));

describe("markReduplication", () => {
  it("同じ名詞を重ねて助詞が続けば、二つ目に Echo=Rdp を付ける", () => {
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"], ["で", "ADP"])), ["会社@2"]);
  });

  it("続くのが語彙表に無い助詞や動詞なら付けない", () => {
    assert.deepEqual(echoes(tokensOf(["資料", "NOUN"], ["資料", "NOUN"], ["を", "ADP"])), []);
    assert.deepEqual(echoes(tokensOf(["確認", "NOUN"], ["確認", "NOUN"], ["する", "VERB"])), []);
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"])), []);
  });

  it("名詞でない語、違う名詞、離れた名詞、離れた助詞、助詞でない語には付けない", () => {
    assert.deepEqual(echoes(tokensOf(["見る", "VERB"], ["見る", "VERB"], ["で", "ADP"])), []);
    assert.deepEqual(echoes(tokensOf(["繰り返し", "VERB"], ["繰り返し", "NOUN"], ["の", "ADP"])), []);
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["部署", "NOUN"], ["で", "ADP"])), []);
    const apart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "会社", pos: "NOUN" },
      { span: { start: 3, end: 5 }, surface: "会社", pos: "NOUN" },
      { span: { start: 5, end: 6 }, surface: "で", pos: "ADP" },
    ];
    assert.deepEqual(echoes(apart), []);
    const particleApart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "会社", pos: "NOUN" },
      { span: { start: 2, end: 4 }, surface: "会社", pos: "NOUN" },
      { span: { start: 5, end: 6 }, surface: "で", pos: "ADP" },
    ];
    assert.deepEqual(echoes(particleApart), []);
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"], ["で", "AUX"])), []);
  });

  it("元の features は残す", () => {
    const tokens: Token[] = [
      { span: { start: 0, end: 1 }, surface: "一", pos: "NOUN" },
      { span: { start: 1, end: 2 }, surface: "一", pos: "NOUN", features: { NumType: "Card" } },
      { span: { start: 2, end: 3 }, surface: "の", pos: "ADP" },
    ];
    assert.deepEqual(markReduplication(tokens, PARTICLES)[1]?.features, { NumType: "Card", Echo: "Rdp" });
  });

  it("空の並びと、語彙表の無い言語", () => {
    assert.deepEqual(markReduplication([], PARTICLES), []);
    assert.deepEqual([...distributiveParticles({})], []);
    assert.deepEqual([...distributiveParticles({ "distributive-particle": [{ pattern: "で" }] })], ["で"]);
  });
});
