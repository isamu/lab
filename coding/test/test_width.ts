import { test } from "node:test";
import assert from "node:assert/strict";
import { displayWidth, padEndWide, padStartWide } from "../packages/scoria/src/width.ts";

test("counts CJK as two columns and ASCII as one", () => {
  assert.equal(displayWidth("abc"), 3);
  assert.equal(displayWidth("次元"), 4);
  assert.equal(displayWidth("スコア"), 6);
  assert.equal(displayWidth("a次"), 3);
});

/** padEnd counts code points, so a Japanese column would collapse without this. */
test("pads to an equal drawn width regardless of script", () => {
  assert.equal(displayWidth(padEndWide("次元", 10)), 10);
  assert.equal(displayWidth(padEndWide("Dimension", 10)), 10);
  assert.equal(displayWidth(padStartWide("総合", 8)), 8);
});

test("text already wider than the target is left alone", () => {
  assert.equal(padEndWide("aaaa", 2), "aaaa");
});
