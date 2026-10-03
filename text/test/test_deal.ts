import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deal, undeal } from "../scripts/deal.ts";

const upTo = (count: number): number[] => Array.from({ length: count }, (_, index) => index);

describe("deal と undeal", () => {
  it("項目を順に配り、どの手も一つ違いまでの大きさになる", () => {
    assert.deepEqual(deal(["a", "b", "c", "d", "e"], 2), [
      ["a", "c", "e"],
      ["b", "d"],
    ]);
  });

  it("手の数は 1 以上、項目の数以下。整数でない数や 0 以下は 1 つの手", () => {
    assert.deepEqual(deal([1, 2], 5), [[1], [2]]);
    assert.deepEqual(deal([], 4), [[]]);
    [0, -3, 1.5, Number.NaN, Number.POSITIVE_INFINITY].forEach((hands) => assert.deepEqual(deal([1, 2, 3], hands), [[1, 2, 3]], String(hands)));
  });

  it("配った手の結果を、配る前の順に戻す（項目の数と手の数を動かしても）", () => {
    const roundTrips = (total: number): void => {
      const items = upTo(total).map((index) => `item ${index}`);
      upTo(8).forEach((hands) => assert.deepEqual(undeal(deal(items, hands), total), items, `${total} items, ${hands} hands`));
    };
    upTo(30).forEach(roundTrips);
  });

  it("手の大きさが配った形と合わなければ止まる（結果が一つ欠けた手）", () => {
    assert.throws(() => undeal([["a", "c"], ["b"]], 4), /4 items dealt into hands of 2, 2/u);
    assert.throws(() => undeal([["a"], ["b"]], 1), /undeal/u);
  });
});
