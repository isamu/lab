import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// demonstrative-opener-run on English: sentences in a row opening with This, That, These, Those or It. Self-written text.

const RULE = "demonstrative-opener-run";

before(async () => {
  await en.prepare?.({ pos: true });
  await ja.prepare?.({ pos: true });
});

const findingsOf = (source: string, level: "strict" | "normal" = "normal"): readonly string[] =>
  namedRuleRun(RULE, source, en, "a.md", "business/report", level).findings;

describe("demonstrative-opener-run: English", () => {
  it("reports three in a row, not two", () => {
    const three = "We introduced a new procedure. This was meant to cut the work. It reduced overtime. That effect should continue next month.\n";
    assert.deepEqual(findingsOf(three), ['3 sentences in a row open with a word that points back, such as "This" (limit 2)']);
    assert.deepEqual(findingsOf("We introduced a new procedure. This was meant to cut the work. It reduced overtime.\n"), []);
  });

  it("restarts the count at a sentence that opens otherwise, and at a new paragraph", () => {
    assert.deepEqual(findingsOf("This is one. It is two. The third is plain. These are four. Those are five.\n"), []);
    assert.deepEqual(findingsOf("This is one. It is two.\n\nThat is three.\n"), []);
  });

  it("matches the word, not the start of a longer one", () => {
    assert.deepEqual(findingsOf("Thistles grew. Items piled up. Thesis drafts waited.\n", "strict"), []);
  });

  it("does not count an opening that names the document, or an it that stands for what follows", () => {
    const self = "This Agreement starts today. This section sets the fees. It applies to every order.\n";
    assert.deepEqual(findingsOf(self), []);
    const ahead = "The cache was rebuilt. It is worth noting that the build took an hour. It seems the disk was slow. This will be checked.\n";
    assert.deepEqual(findingsOf(ahead), []);
    assert.deepEqual(findingsOf("It is obvious that costs rose. It is reasonable to wait. It is helpful to retry.\n"), []);
  });

  it("does not count a that which opens a clause", () => {
    assert.deepEqual(findingsOf("That the plan failed is clear. It was costly. This should not recur.\n"), []);
  });

  it("still reports the Japanese run, which has no English exclusions", () => {
    const three = "新しい手順を導入しました。これは作業を減らすためです。その結果、残業が減りました。この効果は来月も続く見込みです。\n";
    assert.deepEqual(namedRuleRun(RULE, three, ja, "a.md", "business/report", "normal").findings, [
      "「これ」など、指示語で始まる文が 3 文続いています（2 文まで）",
    ]);
  });
});
