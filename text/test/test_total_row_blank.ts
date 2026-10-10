import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { amountColumnOf, isTotalRowGap, type BodyRow } from "../packages/chaff/src/structure/total-row-blank.ts";

// 合計の行が金額のほかを空けてよいかの判定。例はすべて自作。

const item = (...cells: (string | undefined)[]): BodyRow => ({ total: false, cells });
const total = (...cells: (string | undefined)[]): BodyRow => ({ total: true, cells });

const priced: BodyRow[] = [
  item("Room", "2 nights", "$210.00", "$420.00"),
  item("Tax", "2 nights", "$14.70", "$29.40"),
  total("Total", undefined, undefined, "$449.40"),
];

describe("amountColumnOf: 金額の列", () => {
  it("合計でない行がどれも数字を書いている、いちばん右の列", () => {
    assert.equal(amountColumnOf(priced, 4), 3);
    assert.equal(amountColumnOf([item("A", "1", "100円", "備考"), item("B", "2", "200円", "なし"), total("合計", undefined, "300円", undefined)], 4), 2);
  });

  it("空いたセルは数えず、合計の行の中身も見ない", () => {
    assert.equal(amountColumnOf([item("A", "1", "100"), item("B", "2", undefined), total("計", undefined, "メモ")], 3), 2);
  });

  it("数字の列が無ければ、一番左の列しか無ければ、行が無ければ決めない", () => {
    assert.equal(amountColumnOf([item("A", "伊藤", "修正"), item("B", "鈴木", "配布"), total("合計", undefined, "3件")], 3), undefined);
    assert.equal(amountColumnOf([item("1"), item("2")], 1), undefined);
    assert.equal(amountColumnOf([], 4), undefined);
    assert.equal(amountColumnOf([total("合計", "1", "2")], 3), undefined);
  });
});

describe("isTotalRowGap: 合計の行の空欄", () => {
  it("合計の行の、金額でない列の空欄はよい", () => {
    assert.equal(isTotalRowGap(total("Total", undefined, undefined, "$449.40"), 1, 3), true);
    assert.equal(isTotalRowGap(total("Total", undefined, undefined, "$449.40"), 2, 3), true);
  });

  it("合計の行の金額の空欄、合計でない行の空欄、金額の列が決まらない表の空欄はよくない", () => {
    assert.equal(isTotalRowGap(total("Total", undefined, undefined, undefined), 3, 3), false);
    assert.equal(isTotalRowGap(item("Room", "2 nights", undefined, "$420.00"), 2, 3), false);
    assert.equal(isTotalRowGap(total("合計", undefined, "3件"), 1, undefined), false);
  });
});
