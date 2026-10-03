import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// Uncomparable adjectives given a degree (uncomparable-graded). Every example is self-written.

const RULE = "uncomparable-graded";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en).findings;

describe("uncomparable-graded: a degree on an adjective that has none", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("reports a grade before an uncomparable adjective", () => {
    assert.deepEqual(findingsOf("The design is very unique."), ['"very unique" grades an adjective that has no degrees']);
    assert.deepEqual(findingsOf("This vote was more unanimous than the last."), ['"more unanimous" grades an adjective that has no degrees']);
    assert.deepEqual(findingsOf("A fix by Friday is Extremely impossible."), ['"extremely impossible" grades an adjective that has no degrees']);
  });

  it("leaves the bare adjective, words of closeness and adjectives that have degrees alone", () => {
    assert.deepEqual(findingsOf("The design is unique."), []);
    assert.deepEqual(findingsOf("The design is almost unique, and a fix is nearly impossible."), []);
    assert.deepEqual(findingsOf("The design is very unusual and more complete."), []);
    assert.deepEqual(findingsOf("Each key is unique. More keys follow."), []);
  });

  it("every lexicon phrase is found in a sentence", () => {
    const lexicon = en.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(`The result is ${entry.pattern}.`).length, 1, entry.pattern));
  });

  it("does not run on literature", () => {
    const source = "The design is very unique.\n";
    assert.ok(firedRules(en, source, "business/report").includes(RULE));
    assert.ok(!firedRules(en, source, "literature/fiction").includes(RULE));
  });
});
