import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { minorityOf, minorityStyle, minorityWithin } from "../packages/chaff/src/orthography.ts";

// 二通りの書き方の少数派（minorityOf）。latin-spacing・kutoten-consistency・fullwidth-alnum-consistency・spelling-consistency が使う。

const MAX_LENGTH = 8;

/** 長さ MAX_LENGTH までの、true と false のすべての並び。 */
const everyArray = (): boolean[][] =>
  Array.from({ length: MAX_LENGTH + 1 }, (_unused, length) =>
    Array.from({ length: 2 ** length }, (_bits, bits) => Array.from({ length }, (_flag, at) => ((bits >> at) & 1) === 1)),
  ).flat();

/** 書き方の決まり: 片方しか無ければ無し。数が違えば少ないほう。同数なら、先に使った書き方でないほう。 */
const expectedMinority = (written: readonly boolean[]): boolean | undefined => {
  const yes = written.filter(Boolean).length;
  const no = written.length - yes;
  if (yes === 0 || no === 0) return undefined;
  return yes === no ? !written[0] : yes < no;
};

describe("minorityOf: 二通りの書き方の少数派", () => {
  it("すべての並びで、決まりどおりの少数派を返す", () => {
    const wrong = everyArray().filter((written) => minorityOf(written) !== expectedMinority(written));
    assert.deepEqual(wrong, []);
  });

  it("minorityStyle は空けたかどうかの少数派で、minorityOf と同じ", () => {
    const wrong = everyArray().filter((written) => minorityStyle(written.map((spaced) => ({ spaced }))) !== minorityOf(written));
    assert.deepEqual(wrong, []);
  });

  it("同数なら先に使った書き方がその文書の書き方", () => {
    assert.equal(minorityOf([true, false]), false);
    assert.equal(minorityOf([false, true]), true);
  });

  it("空と、片方だけの並びには少数派が無い", () => {
    assert.equal(minorityOf([]), undefined);
    assert.equal(minorityOf([true, true]), undefined);
  });
});

describe("minorityWithin: 少数派のうち、使い分けと見ないもの", () => {
  const items = ["a", "a", "a", "b"];
  const isB = (item: string): boolean => item === "b";

  it("少ないほうが limit パーセント以下なら、少ないほうのもの", () => {
    assert.deepEqual(minorityWithin(items, isB, 25), ["b"]);
  });

  it("limit パーセントを超えるなら、使い分けと見て空", () => {
    assert.deepEqual(minorityWithin(items, isB, 24), []);
    assert.deepEqual(minorityWithin(["a", "b"], isB, 49), []);
  });

  it("片方しか無ければ空", () => {
    assert.deepEqual(minorityWithin(["a", "a"], isB, 100), []);
    assert.deepEqual(minorityWithin([], isB, 100), []);
  });
});
