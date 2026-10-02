import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { predicateFrameAfter, predicateFrameAt } from "../packages/lang-ja/src/predicate-frame.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 受動のすぐ後ろの述語の型（ことになる・こととなる）を、語の原形をつないで照らす。例文はすべて自作。

const token = (surface: string, lemma?: string, start = 0): Token => ({
  span: { start, end: start + surface.length },
  surface,
  pos: "X",
  ...(lemma === undefined ? {} : { lemma }),
});

const FRAMES = ["ことになる", "こととなる"];

// 検討|さ|れる|こと|と|なっ|た
const TOTONATTA = [
  token("検討"),
  token("さ", "する"),
  token("れる", "れる"),
  token("こと", "こと"),
  token("と", "と"),
  token("なっ", "なる"),
  token("た", "た"),
];

describe("predicateFrameAt", () => {
  it("型の語の数を返す。活用した形も原形で当たる", () => {
    assert.equal(predicateFrameAt(TOTONATTA, 3, FRAMES), 3);
    const nari = [token("こと", "こと"), token("に", "に"), token("なり", "なる"), token("まし", "ます")];
    assert.equal(predicateFrameAt(nari, 0, FRAMES), 3);
  });

  it("原形が無い語は書いた形で照らす", () => {
    assert.equal(predicateFrameAt([token("こと"), token("に"), token("なる")], 0, FRAMES), 3);
  });

  it("型の途中から、型でない語、型の途中で終わる並びには当たらない", () => {
    assert.equal(predicateFrameAt(TOTONATTA, 4, FRAMES), 0);
    assert.equal(predicateFrameAt([token("こと", "こと"), token("が", "が"), token("ある", "ある")], 0, FRAMES), 0);
    assert.equal(predicateFrameAt([token("こと", "こと"), token("に", "に")], 0, FRAMES), 0);
  });

  it("語を飛ばして当てない（こと|に|は|なる）", () => {
    assert.equal(predicateFrameAt([token("こと", "こと"), token("に", "に"), token("は", "は"), token("なる", "なる")], 0, FRAMES), 0);
  });

  it("空の語の並び、範囲の外、空の型の表は 0", () => {
    assert.equal(predicateFrameAt([], 0, FRAMES), 0);
    assert.equal(predicateFrameAt(TOTONATTA, 99, FRAMES), 0);
    assert.equal(predicateFrameAt(TOTONATTA, 3, []), 0);
  });
});

describe("predicateFrameAfter", () => {
  const frame = (...words: [string, string][]): Token[] =>
    words.reduce<Token[]>((made, [surface, lemma]) => [...made, token(surface, lemma, made.at(-1)?.span.end ?? 0)], []);

  it("型の後ろが仮定かどうか", () => {
    assert.deepEqual(predicateFrameAfter(frame(["こと", "こと"], ["と", "と"], ["なっ", "なる"], ["た", "た"]), 0, FRAMES), { conditional: false });
    assert.deepEqual(predicateFrameAfter(frame(["こと", "こと"], ["と", "と"], ["なれ", "なる"], ["ば", "ば"]), 0, FRAMES), { conditional: true });
    assert.deepEqual(predicateFrameAfter(frame(["こと", "こと"], ["に", "に"], ["なる", "なる"], ["と", "と"]), 0, FRAMES), { conditional: true });
  });

  it("型が無ければ undefined", () => {
    assert.equal(predicateFrameAfter(frame(["こと", "こと"], ["が", "が"], ["ある", "ある"]), 0, FRAMES), undefined);
    assert.equal(predicateFrameAfter([], 0, FRAMES), undefined);
  });
});
