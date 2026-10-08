import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { isSpacedLocationPart, type FloorWords } from "../packages/chaff/src/location-part.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";

// 建物の名前の後ろに空白で区切った階・部屋の番号（本社 5階）の前の空白は、所在の組の区切りで、数の前の空け方の好みではない。

const patternsOf = (id: string): ReadonlySet<string> => new Set((loadLexicons()[id] ?? []).map((entry) => entry.pattern));
const FLOORS: FloorWords = { units: patternsOf("floor-unit"), levels: patternsOf("floor-level") };

const token = (start: number, surface: string, pos: string): Token => ({ span: { start, end: start + surface.length }, surface, pos });

/** text の中の最初の digits の並び。 */
const runOf = (text: string, digits: string): { start: number; end: number } => {
  const start = text.indexOf(digits);
  return { start, end: start + digits.length };
};

describe("isSpacedLocationPart", () => {
  const check = (text: string, digits: string, left: Token | undefined, words = FLOORS): boolean =>
    isSpacedLocationPart(text, runOf(text, digits), left === undefined ? [] : [left], 0, words);

  it("reads a floor or room number after a name and a space as a part of a location", () => {
    assert.equal(check("本社 5階 第2会議室", "5", token(0, "本社", "NOUN")), true);
    assert.equal(check("紀尾井町 19階、20階", "19", token(0, "紀尾井町", "PROPN")), true);
    assert.equal(check("研究所 3階", "3", token(0, "研究所", "NOUN")), true);
    assert.equal(check("ハイツ 201号室", "201", token(0, "ハイツ", "NOUN")), true);
    assert.equal(check("テラス　19階Northフロア", "19", token(0, "テラス", "NOUN")), true);
  });

  it("does not read a floor after a particle, a floor that goes on as a word, or a number with no floor unit", () => {
    assert.equal(check("会場は 5階", "5", token(2, "は", "ADP")), false);
    assert.equal(check("地上 5階建て", "5", token(0, "地上", "NOUN")), false);
    assert.equal(check("本社 5階です", "5", token(0, "本社", "NOUN")), false);
    assert.equal(check("合計 3件", "3", token(0, "合計", "NOUN")), false);
    assert.equal(check("本社 5 階", "5", token(0, "本社", "NOUN")), false);
    assert.equal(check("地下 1階、", "1", token(0, "地下", "NOUN")), false);
    assert.equal(check("地上 5階", "5", token(0, "地上", "NOUN")), false);
  });

  it("does not read a number with no space before it, a range, or a sentence with no parts of speech", () => {
    assert.equal(check("本社5階", "5", token(0, "本社", "NOUN")), false);
    assert.equal(check("本社 3-5階", "3-5", token(0, "本社", "NOUN")), false);
    assert.equal(isSpacedLocationPart("本社 5階", runOf("本社 5階", "5"), undefined, 0, FLOORS), false);
    assert.equal(check("本社 5階", "5", undefined), false);
    assert.equal(check("本社 5階", "5", token(0, "本社", "NOUN"), { units: new Set(), levels: new Set() }), false);
    assert.equal(isSpacedLocationPart("5階", { start: 0, end: 1 }, [], 0, FLOORS), false);
  });
});

describe("latin-spacing and floors", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const spacing = (source: string): string[] => latinSpacing(ja, source, "business/report");

  it("does not count the space between a building and its floor", () => {
    assert.deepEqual(spacing("# 会議\n\n月会費は2,800円とし、2,500円と3,000円の案を比べた。\n\n場所：本社 5階 第2会議室\n"), []);
    assert.deepEqual(spacing("# 会場\n\n参加は120名、定員は150名です。\n\n現地会場：統計数理研究所 3階 セミナー室\n"), []);
  });

  it("still counts a floor after a particle, and a building with floors as a count", () => {
    assert.deepEqual(spacing("# 会場\n\n参加は120名、定員は150名です。\n\n会場は 5階です。\n"), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing("# 会場\n\n参加は120名、定員は150名です。\n\n建物は地上 5階建てです。\n"), ["後ろの数字:空けています"]);
    assert.deepEqual(spacing("# 会場\n\n参加は120名、定員は150名です。\n\n建物は地下 1階、地上 5階。\n"), [
      "後ろの数字:空けています",
      "後ろの数字:空けています",
    ]);
  });
});
