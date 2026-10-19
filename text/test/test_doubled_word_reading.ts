import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// doubled-word and a reading in parentheses after a word (凛々（りり）しい): the reading repeats kana because the word is
// read that way, not because a word was written twice. Every sentence here is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (sentence: string): readonly string[] => namedRuleRun("doubled-word", `${sentence}\n`, ja).findings;

describe("doubled-word and a reading in parentheses", () => {
  it("does not report kana repeated inside a word's reading", () => {
    assert.deepEqual(findingsOf("凛々（りり）しい若者が並んでいます。"), []);
    assert.deepEqual(findingsOf("ここは代々（よよ）受け継いだ店です。"), []);
  });

  it("still reports a word written twice outside the reading, and an aside that is not a reading", () => {
    assert.equal(findingsOf("資料（しりょう）をを送ります。").length, 1);
    assert.equal(findingsOf("これは（ややや）資料をを送ります。").length, 1);
  });
});
