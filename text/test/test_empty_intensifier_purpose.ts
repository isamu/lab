import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { namesPurpose } from "../packages/chaff/src/detectors/empty-intensifier.ts";
import type { LexiconEntry } from "../packages/chaff/src/plugin.ts";

// empty-intensifier and a statement of necessity that names its purpose in the same sentence (「〜のためには、Ｘが
// 不可欠です」). It states a condition, not empty emphasis. Every sentence here is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const RULE = "empty-intensifier";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja).findings;

const PURPOSES: readonly LexiconEntry[] = [{ pattern: "ためには" }, { pattern: "上で" }, { pattern: "に", position: "before" }];

describe("namesPurpose", () => {
  it("reads a purpose word before the phrase, or one right before it", () => {
    assert.equal(namesPurpose("店を続けるためには、人手が不可欠です。", "不可欠です", PURPOSES), true);
    assert.equal(namesPurpose("計画を立てる上で、数字が欠かせません。", "欠かせません", PURPOSES), true);
    assert.equal(namesPurpose("この部品は、配送に欠かせません。", "欠かせません", PURPOSES), true);
  });

  it("does not read a purpose word after the phrase, one not right before it, or a missing phrase", () => {
    assert.equal(namesPurpose("人手が不可欠です。続けるためには。", "不可欠です", PURPOSES), false);
    assert.equal(namesPurpose("配送に、人手が欠かせません。", "欠かせません", PURPOSES), false);
    assert.equal(namesPurpose("人手が不可欠です。", "不可欠です", PURPOSES), false);
    assert.equal(namesPurpose("不可欠です。", "不可欠です", PURPOSES), false);
    assert.equal(namesPurpose("店を続けるためには人手が要ります。", "不可欠です", PURPOSES), false);
    assert.equal(namesPurpose("店を続けるためには、人手が不可欠です。", "不可欠です", []), false);
  });
});

describe("empty-intensifier and a stated purpose", () => {
  it("does not report a necessity whose purpose the sentence names", () => {
    assert.deepEqual(findingsOf("店を長く続けるためには、地元の人手が不可欠です。"), []);
    assert.deepEqual(findingsOf("この部品は、毎日の配送に欠かせません。"), []);
  });

  it("still reports a bare necessity and the other phrases", () => {
    assert.equal(findingsOf("地元の人手が不可欠です。").length, 1);
    assert.equal(findingsOf("店を長く続けるためには、品ぞろえが非常に重要です。").length, 1);
    assert.equal(findingsOf("言うまでもなく、店を続けるためには人手が要ります。").length, 1);
  });
});
