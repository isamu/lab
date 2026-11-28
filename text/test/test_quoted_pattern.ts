import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { quotedPattern } from "../packages/chaff/src/detectors/quoted-pattern.ts";

describe("quotedPattern", () => {
  it("drops a comma or question mark at either edge", () => {
    assert.equal(quotedPattern("、正直"), "正直");
    assert.equal(quotedPattern("正直、"), "正直");
    assert.equal(quotedPattern("，正直"), "正直");
    assert.equal(quotedPattern("honestly,"), "honestly");
    assert.equal(quotedPattern("honestly?"), "honestly");
    assert.equal(quotedPattern("本当？"), "本当");
    assert.equal(quotedPattern(", and"), "and");
  });

  it("keeps a pattern without edge marks, and marks inside it", () => {
    assert.equal(quotedPattern("正直に言うと"), "正直に言うと");
    assert.equal(quotedPattern("if I'm honest"), "if I'm honest");
    assert.equal(quotedPattern("a, b"), "a, b");
  });

  it("keeps a period, which may end an abbreviation", () => {
    assert.equal(quotedPattern("and etc."), "and etc.");
  });

  it("keeps a pattern that is only marks, and the empty pattern", () => {
    assert.equal(quotedPattern("、"), "、");
    assert.equal(quotedPattern(","), ",");
    assert.equal(quotedPattern("?"), "?");
    assert.equal(quotedPattern(""), "");
  });
});
