import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { describeChange, snapshotOf } from "../packages/chaff/src/watch.ts";
import type { Finding } from "../packages/chaff/src/plugin.ts";

const finding = (rule: string): Finding => ({ rule, severity: "warning", line: 1, column: 1, quote: "", values: {} });

describe("差分の作り方", () => {
  it("rule ごとに数える", () => {
    assert.deepEqual(snapshotOf([finding("a"), finding("a"), finding("b")]), { a: 2, b: 1 });
  });

  it("指摘が無ければ空", () => {
    assert.deepEqual(snapshotOf([]), {});
  });
});

describe("差分の見せ方", () => {
  it("減ったときは ✓ を出す", () => {
    const text = describeChange({ "bold-density": 2 }, { "bold-density": 1 });
    assert.match(text ?? "", /✓/u);
    assert.match(text ?? "", /2 → 1 件/u);
    assert.match(text ?? "", /-1 bold-density/u);
  });

  it("増えたときは ✗ を出す", () => {
    const text = describeChange({}, { "closing-cliche": 1 });
    assert.match(text ?? "", /✗/u);
    assert.match(text ?? "", /\+1 closing-cliche/u);
  });

  it("変わらなければ何も返さない", () => {
    // 保存のたびに「変わりません」を出すと、書いている最中の画面が埋まる。
    assert.equal(describeChange({ a: 1 }, { a: 1 }), undefined);
  });

  it("消えた rule も差分に出す", () => {
    assert.match(describeChange({ a: 1 }, {}) ?? "", /-1 a/u);
  });

  it("入れ替わりを両方出す", () => {
    const text = describeChange({ a: 1 }, { b: 1 });
    assert.match(text ?? "", /-1 a/u);
    assert.match(text ?? "", /\+1 b/u);
  });

  it("同数の入れ替わりでも「減った」とは言わない", () => {
    // 合計が同じなら良くなっても悪くなってもいない。✓ を出すと嘘になる。
    assert.match(describeChange({ a: 1 }, { b: 1 }) ?? "", /✗/u);
  });

  it("rule の並びはロケールに依存しない", () => {
    const text = describeChange({}, { zebra: 1, apple: 1 });
    assert.ok((text ?? "").indexOf("apple") < (text ?? "").indexOf("zebra"), text ?? "");
  });
});
