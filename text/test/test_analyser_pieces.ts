import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { analyserPieces } from "../packages/lang-ja/src/analyser-pieces.ts";
import { prepare, tokenize } from "../packages/lang-ja/src/pos.ts";

/** 句読点（、。）の無いまま続く最も長い文字数。 */
const longestStretch = (text: string): number => Math.max(0, ...text.split(/[、。]/u).map((part) => part.length));

const isLow = (code: number): boolean => code >= 0xdc00 && code <= 0xdfff;

/** 再現できる乱数（mulberry32）。落ちたら seed を出す。 */
const random = (seed: number): (() => number) => {
  const state = { value: seed };
  return () => {
    state.value = (state.value + 0x6d2b79f5) | 0;
    const mixed = Math.imul(state.value ^ (state.value >>> 15), 1 | state.value);
    const next = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
};

const ALPHABET = ["あ", "漢", "a", "1", " ", "\n", "、", "。", "😀", "𠮷", "　", "\t"];

const generated = (next: () => number, length: number): string => Array.from({ length }, () => ALPHABET[Math.floor(next() * ALPHABET.length)] ?? "").join("");

describe("analyserPieces: 解析器に渡すかたまり", () => {
  it("空の本文", () => assert.deepEqual(analyserPieces("", 10), [""]));

  it("句読点の間が limit 以下なら、本文を 1 つのまま渡す", () => {
    const text = "第一条　この法律は、会社の設立について定める。\n第二条　定義は次のとおり。";
    assert.deepEqual(analyserPieces(text, 20), [text]);
  });

  it("句読点の無い長い並びは limit 文字ごとに切る", () => {
    assert.deepEqual(analyserPieces("あ".repeat(7), 3), ["あああ", "あああ", "あ"]);
  });

  it("空白があれば、その後ろで切る", () => {
    assert.deepEqual(analyserPieces("ああ いいい", 4), ["ああ ", "いいい"]);
    assert.deepEqual(analyserPieces("ああ\nいいい", 4), ["ああ\n", "いいい"]);
  });

  it("サロゲートの対を割らない", () => {
    assert.deepEqual(analyserPieces("ああ😀い", 3), ["ああ", "😀い"]);
  });

  it("生成した本文で: つなげると元どおり、句読点の無い並びは limit 以下、対を割らない、切らなくてよければ切らない", () => {
    const seed = 170;
    const next = random(seed);
    Array.from({ length: 3000 }).forEach((_, round) => {
      const text = generated(next, Math.floor(next() * 60));
      const limit = 2 + Math.floor(next() * 12);
      const pieces = analyserPieces(text, limit);
      const where = `seed ${seed}, round ${round}, limit ${limit}, ${JSON.stringify(text)}`;
      assert.equal(pieces.join(""), text, where);
      pieces.forEach((piece) => assert.ok(longestStretch(piece) <= limit, where));
      pieces.slice(1).forEach((piece) => assert.ok(!isLow(piece.charCodeAt(0)), where));
      if (longestStretch(text) <= limit) assert.deepEqual(pieces, [text], where);
    });
  });
});

describe("句読点の無い長い本文でも解析する", () => {
  before(async () => prepare());

  it("tokenize は切れ目をまたいでも本文の位置で token を返す", () => {
    const text = `${"あ".repeat(2500)}です。`;
    const tokens = tokenize(text) ?? [];
    assert.ok(tokens.length > 0);
    assert.equal(tokens.at(-1)?.surface, "。");
    assert.equal(tokens.at(-1)?.span.start, 2502);
    tokens.forEach((token) => assert.equal(text.slice(token.span.start, token.span.end), token.surface));
  });

  it("解析器は句読点の無い並びを切って受け取る（カタカナの並びは 1 語にまとめられるので、切った所で語が分かれる）", () => {
    const text = "ア".repeat(2500);
    const tokens = tokenize(text) ?? [];
    assert.ok(tokens.length > 1, JSON.stringify(tokens.map((token) => token.span)));
    assert.equal(tokens.map((token) => token.surface).join(""), text);
  });
});
