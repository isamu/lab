import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { opensWithPhrase } from "../packages/chaff/src/detectors/opener-phrase.ts";

// "So far" opens with the word So but is an adverbial phrase, not the conjunction. The excerpt is from a Federal Reserve
// speech (a work of the U.S. Government, in the public domain).

const run = (source: string): readonly string[] => namedRuleRun("sentence-initial-conjunction-run", source, en, "a.md", "speech/address").findings;

const AFTER = "But LMI families face even greater challenges. And while supply should help everyone somewhat, we need to focus on these households.\n";

describe("sentence-initial-conjunction-run: an adverbial phrase that opens with So or Yet is not a conjunction", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("So far does not start a run", () => {
    assert.deepEqual(run(`So far, I've been discussing shelter costs in aggregate terms. ${AFTER}`), []);
    assert.deepEqual(run(`Yet another rule applies here. ${AFTER}`), []);
    assert.deepEqual(run(`“So far, so good,” she said. ${AFTER}`), []);
  });

  it("the conjunction So still counts", () => {
    assert.equal(run(`So I've been discussing shelter costs in aggregate terms. ${AFTER}`).length, 1);
    assert.equal(run(`So farmers have been hit hard. ${AFTER}`).length, 1);
  });
});

describe("opensWithPhrase", () => {
  it("matches a listed phrase at the start, in any case, up to a word boundary", () => {
    assert.equal(opensWithPhrase("So far, so good.", ["so far"]), true);
    assert.equal(opensWithPhrase("  SO FAR we know.", ["so far"]), true);
    assert.equal(opensWithPhrase("So far.", ["so far"]), true);
    assert.equal(opensWithPhrase("“So far, so good,” she said.", ["so far"]), true);
    assert.equal(opensWithPhrase("**So far** we know.", ["so far"]), true);
  });

  it("does not match a longer word, a later position, an empty phrase or no phrases", () => {
    assert.equal(opensWithPhrase("So farmers lost.", ["so far"]), false);
    assert.equal(opensWithPhrase("We are so far behind.", ["so far"]), false);
    assert.equal(opensWithPhrase("So we went.", [""]), false);
    assert.equal(opensWithPhrase("So far.", []), false);
    assert.equal(opensWithPhrase("", ["so far"]), false);
  });
});
