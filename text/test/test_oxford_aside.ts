import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: an example phrase set off by commas between a subject and its predicate ("Old files not listed
// above, such as cached copies, are deleted and are not restored") is an aside, not an item. The and after it joins two
// predicates, so it casts no vote for or against the serial comma. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";

const firedWith = (sentence: string): boolean => firedRules(en, `${WITH_COMMA}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: an example phrase between a subject and its predicate", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not count the and after an aside, even when the examples hold a participle", () => {
    assert.equal(firedWith("Old files not listed above, such as any cached copies, are deleted and are not restored."), false);
    assert.equal(firedWith("Some devices, including the shared tablets, are wiped and are returned."), false);
  });

  it("still counts a list without the serial comma, a list of examples, and a list of predicates after an aside", () => {
    assert.equal(firedWith("We print flyers, stickers and banners."), true);
    assert.equal(firedWith("We sell fruit, such as apples, pears and plums."), true);
    assert.equal(firedWith("Some devices, including the shared tablets, are wiped, checked and returned."), true);
  });
});
