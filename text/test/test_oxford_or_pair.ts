import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: a final "or" with no comma before it that joins two bare plural nouns after an item of another
// form ("parking, taxis or rideshares") joins two alternatives inside the last item, not the list's last two items.
// Excerpts are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";

const reportedWith = (sentence: string): boolean => firedRules(en, `${WITH_COMMA}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: two alternatives joined by or in the last item", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not read a final pair of plural nouns after an item of another form as the list's close", () => {
    assert.equal(reportedWith("- Travel (airfare, train tickets, mileage for use of a personal car, parking, taxis or rideshares)"), false);
    assert.equal(reportedWith("We cover fuel, parking, taxis or rideshares."), false);
  });

  it("still reads a list of the same form closed by or", () => {
    assert.equal(reportedWith("We sell apples, pears or plums."), true);
    assert.equal(reportedWith("You may pay by card, cheque or cash."), true);
    assert.equal(reportedWith("We cover fuel, parking, taxis and rideshares."), true);
  });
});
