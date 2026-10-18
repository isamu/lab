import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isNumeral, uncountedParticles, type UncountedWords } from "../packages/chaff/src/uncounted-particles.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// no-doubled-joshi and the の inside a number (第70条の２, 70の２－８の２), which is not a link of a chain. Every example is self-written.

const countFor = (source: string): number => firedRules(ja, source).filter((id) => id === "no-doubled-joshi").length;

const WORDS: UncountedWords = {
  particles: ["の"],
  numeralChars: new Set(["一", "二", "三", "十"]),
  counters: ["条", "項"],
};

const tokensOf = (surfaces: readonly string[]): Token[] =>
  surfaces.map((surface, at) => ({ surface, pos: surface === "の" ? "ADP" : "NOUN", span: { start: at, end: at + 1 } }));

const uncountedAt = (surfaces: readonly string[]): number[] => {
  const tokens = tokensOf(surfaces);
  const uncounted = uncountedParticles(tokens, WORDS);
  return tokens.flatMap((token, at) => (uncounted.has(token) ? [at] : []));
};

describe("uncountedParticles", () => {
  it("valid: a の between two numbers, or between a numbered counter and a number, is part of the number", () => {
    assert.deepEqual(uncountedAt(["第", "70", "条", "の", "２"]), [3]);
    assert.deepEqual(uncountedAt(["70", "の", "２", "－", "８", "の", "２"]), [1, 5]);
    assert.deepEqual(uncountedAt(["第", "三", "条", "の", "二"]), [3]);
    assert.deepEqual(uncountedAt(["第", "２", "の", "２", "の", "改正"]), [2]);
    assert.deepEqual(uncountedAt(["第", "十", "二", "条", "の", "三", "十", "第", "一", "項"]), [4]);
  });

  it("invalid: a の next to only one number, or after a counter with no number, is a particle", () => {
    assert.deepEqual(uncountedAt(["２", "の", "改正"]), []);
    assert.deepEqual(uncountedAt(["本社", "の", "２"]), []);
    assert.deepEqual(uncountedAt(["本", "条", "の", "２"]), []);
  });

  it("invalid: a number followed by a word is a quantity, and the の before it is a particle", () => {
    assert.deepEqual(uncountedAt(["資料", "２", "－", "１", "の", "４", "ページ"]), []);
    assert.deepEqual(uncountedAt(["第", "２", "条", "の", "三", "十", "日"]), []);
  });

  it("invalid: an empty sentence and a lone particle give nothing", () => {
    assert.deepEqual(uncountedAt([]), []);
    assert.deepEqual(uncountedAt(["の"]), []);
    assert.deepEqual(uncountedAt(["の", "２"]), []);
  });

  it("isNumeral reads decimal digits in either width and the listed characters, nothing else", () => {
    ["70", "２", "十二"].forEach((surface) => assert.equal(isNumeral(surface, WORDS.numeralChars), true, surface));
    ["", "70条", "百", "ii", "-"].forEach((surface) => assert.equal(isNumeral(surface, WORDS.numeralChars), false, surface));
  });
});

describe("no-doubled-joshi: branch numbers", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: the の inside article and item numbers is not counted", () => {
    assert.equal(countFor("規則第12条の３の規定を改める。"), 0);
    assert.equal(countFor("通知のうち12の３－４の２の取扱いを改める。"), 0);
    assert.equal(countFor("上記第２の２の改正は来月から適用する。"), 0);
    assert.equal(countFor("附則第十二条の三第二項の規定を改める。"), 0);
  });

  it("invalid: a real chain next to a branch number is still reported", () => {
    assert.equal(countFor("規則第12条の３の規定の適用の範囲を改める。"), 1);
    assert.equal(countFor("本社の営業部の第二課の方針を確認しました。"), 1);
    assert.equal(countFor("資料２－１の４ページ目の後半の部分を確認しました。"), 1);
  });

  it("invalid: のための is three の, and a chain through it is still reported", () => {
    assert.equal(countFor("会員の会費のための口座として登録します。"), 1);
  });
});
