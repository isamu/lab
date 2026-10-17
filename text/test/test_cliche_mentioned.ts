import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// cliche: a worn phrase that is mentioned, not used ("when saying raising the bar", the phrase "low-hanging fruit",
// 「徹底解説」という言い方). The writer is talking about the words. Every example is self-written.

const RULE = "cliche";

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

describe("cliche: a phrase named as a term (en)", () => {
  const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en).findings;

  it("does not report a phrase right after a word that names it", () => {
    assert.deepEqual(findingsOf("When saying raising the bar, I mean the review rules for the main repository."), []);
    assert.deepEqual(findingsOf("Avoid the phrase “low-hanging fruit” in a plan."), []);
    assert.deepEqual(findingsOf('The term "touch base" confuses readers abroad.'), []);
  });

  it("still reports the phrase used, and a cue that does not stand right before it", () => {
    assert.deepEqual(findingsOf("We keep raising the bar for reviews."), ['"raise the bar" is a cliché']);
    assert.deepEqual(findingsOf("The phrase we chose is clear, and fixing the login page is low-hanging fruit."), ['"low-hanging fruit" is a cliché']);
    assert.deepEqual(findingsOf("I keep saying that fixing the login page is low-hanging fruit."), ['"low-hanging fruit" is a cliché']);
  });

  it("reports a sentence that mentions the phrase and also uses it", () => {
    assert.equal(findingsOf("Avoid the phrase “touch base”, even if you touch base every week.").length, 1);
  });
});

describe("cliche: a phrase named as a term (ja)", () => {
  const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja).findings;

  it("does not report a phrase followed by という言い方 or という表現", () => {
    assert.deepEqual(findingsOf("「徹底解説」という言い方は、中身を言っていません。"), []);
    assert.deepEqual(findingsOf("今さら聞けないという表現は避けます。"), []);
  });

  it("still reports the phrase used", () => {
    assert.equal(findingsOf("この記事では、Git の基本を徹底解説します。").length, 1);
  });
});
