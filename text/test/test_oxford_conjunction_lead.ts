import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: an introductory clause after a sentence-opening "And" or "But" ("And if you have questions
// about any of this, come in and ask") is not the first item of a list. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";
const WITHOUT_COMMA = "We sell posters, cards and calendars.\nWe ship to shops, schools and libraries.";

const firedAfter = (usual: string, sentence: string): boolean => firedRules(en, `${usual}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: an introduction after a sentence-opening conjunction", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not read the clause after And if as an item", () => {
    assert.equal(firedAfter(WITH_COMMA, "And if you have questions about any of this, come in and ask."), false);
    assert.equal(firedAfter(WITH_COMMA, "But when the shop is closed, call us and leave a message."), false);
  });

  it("still counts a list after the introduction", () => {
    assert.equal(firedAfter(WITH_COMMA, "And if you have questions, bring your bike, your helmet and your lights."), true);
    assert.equal(firedAfter(WITHOUT_COMMA, "And we sell bells, locks, and lights."), true);
  });
});
