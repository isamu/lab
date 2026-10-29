import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: three places where commas or an and / or are not the writer's list. A prepositional phrase set
// off by commas between a verb and its object; a last item that repeats the preposition of the list ("…, and at the depot");
// and a list of titles written in sentence case, whose own and / or belong to the titles. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";
const WITHOUT_COMMA = "We sell posters, cards and calendars.\nWe ship to shops, schools and libraries.";

const firedWith = (sentence: string): boolean => firedRules(en, `${WITH_COMMA}\n\n${sentence}\n`).includes(RULE);
const firedWithout = (sentence: string): boolean => firedRules(en, `${WITHOUT_COMMA}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: commas and joints that are not a list", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not count a phrase set off by commas between a verb and its object", () => {
    assert.equal(firedWith('A branch may qualify if it received, at its most recent review, a rating of "1" or "2" and it meets the criteria.'), false);
    assert.equal(firedWith("Each office received, in March, a laptop, a phone and a badge."), true);
    assert.equal(firedWithout("Data is collected, in batches, in files, and in tables."), true);
  });

  it("reads a last item that repeats the list's preposition as the same list", () => {
    assert.equal(firedWith("Maps are sold at the visitor center, the north gate, Pine and Oak campgrounds, and at the main office."), false);
    assert.equal(firedWith("We met at the station, the library, the park and the museum, and at night we slept."), true);
  });

  it("does not count an and / or inside sentence-case titles in a list", () => {
    assert.equal(
      firedWith(
        "New titles include: The garden year, The story of salt, The law of trade and finance, Field-tested cooking: a short and simple guide to camp food, and Rivers of the northern plains: floods, dams and bridges.",
      ),
      false,
    );
    assert.equal(firedWith("New books include gardening, trade and finance."), true);
  });
});
