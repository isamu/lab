import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: a contrast after a comma ("more correct, not cleaner or more elegant") and an introduction
// that opens with a sequence word ("First, outside a block, the helper …") are not lists of three. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";
const WITHOUT_COMMA = "We sell posters, cards and calendars.\nWe ship to shops, schools and libraries.";

const firedAfter = (usual: string, sentence: string): boolean => firedRules(en, `${usual}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: contrasts and introductions", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not read X, not Y or Z as a list", () => {
    assert.equal(firedAfter(WITH_COMMA, "The fix made the code more correct, not cleaner or more elegant."), false);
  });

  it("does not read a sequence word and the phrase after it as items", () => {
    assert.equal(firedAfter(WITH_COMMA, "First, outside a block, the helper checks for the error and re-throws it."), false);
    assert.equal(firedAfter(WITH_COMMA, "First, outside a block, `try call()` [checks for the error and re-throws it](https://example.com/a), like the old macro."), false);
  });

  it("still counts a list inside the contrast, after a sequence word, and of sequence words", () => {
    assert.equal(firedAfter(WITHOUT_COMMA, "The fix made the parser correct, not faster, smaller, or simpler."), true);
    assert.equal(firedAfter(WITH_COMMA, "First, the team tested the parser, the renderer and the exporter."), true);
    assert.equal(firedAfter(WITHOUT_COMMA, "The first, second, and third places went to one team."), true);
    assert.equal(firedAfter(WITHOUT_COMMA, "The club sells first, standard, and economy tickets."), true);
  });
});
