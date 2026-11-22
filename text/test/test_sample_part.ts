import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inPart, partOf } from "../scripts/sample-part.ts";

describe("見本を CI の部分に分ける", () => {
  it("部分を書かなければ全部を回す", () => {
    assert.equal(partOf(undefined), undefined);
    assert.equal(partOf(""), undefined);
    assert.deepEqual(inPart(["a", "b"], undefined), ["a", "b"]);
  });

  it("k/n を読む", () => {
    assert.deepEqual(partOf("1/3"), { index: 1, count: 3 });
    assert.deepEqual(partOf("3/3"), { index: 3, count: 3 });
    assert.deepEqual(partOf("1/1"), { index: 1, count: 1 });
  });

  it("書き損じた部分は、何も回さずに通ってしまわないよう止める", () => {
    ["0/3", "4/3", "3", "1/0", "a/b", "1/3 ", "-1/3", "1.5/3"].forEach((written) => assert.throws(() => partOf(written), /CHAFF_SAMPLE_PART/u, written));
  });

  it("どの見本もちょうど一つの部分に入る", () => {
    const items = Array.from({ length: 23 }, (_, at) => at);
    [1, 2, 3, 4, 7, 30].forEach((count) => {
      const parts = Array.from({ length: count }, (_, at) => inPart(items, { index: at + 1, count }));
      assert.deepEqual(
        parts.flat().toSorted((left, right) => left - right),
        items,
        `count ${count}`,
      );
      const sizes = parts.map((part) => part.length);
      assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1, `count ${count}: ${sizes.join(",")}`);
    });
    assert.deepEqual(inPart([], { index: 1, count: 3 }), []);
  });
});
