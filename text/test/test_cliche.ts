import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// Worn phrases (cliche). Every example is self-written.

const RULE = "cliche";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en).findings;

describe("cliche: a worn phrase", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("reports a cliché, whatever its case", () => {
    assert.deepEqual(findingsOf("At the end of the day, the new cache is faster."), ['"at the end of the day" is a cliché']);
    assert.deepEqual(findingsOf("Fixing the login page is low-hanging fruit."), ['"low-hanging fruit" is a cliché']);
    assert.deepEqual(findingsOf("We will touch base next week."), ['"touch base" is a cliché']);
  });

  it("leaves literal uses of the same words alone", () => {
    assert.deepEqual(findingsOf("The meeting ends at the end of the month."), []);
    assert.deepEqual(findingsOf("The fruit on the low branches ripens first."), []);
    assert.deepEqual(findingsOf("Each base station reports its load."), []);
  });

  it("every lexicon phrase is found in a sentence", () => {
    const lexicon = en.lexicons[RULE] ?? [];
    assert.ok(lexicon.length > 0);
    lexicon.forEach((entry) => assert.equal(findingsOf(`They said ${entry.pattern} again.`).length, 1, entry.pattern));
  });

  it("does not run on literature", () => {
    const source = "At the end of the day, the new cache is faster.\n";
    assert.ok(firedRules(en, source, "business/report").includes(RULE));
    assert.ok(!firedRules(en, source, "literature/fiction").includes(RULE));
  });
});
