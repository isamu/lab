import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { followsPostcode } from "../packages/chaff/src/detectors/postcode-end.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: a postal address written on one line ("the Orders Desk, Harbour Prints, Upper Street, Leeds
// LS1 4AB, or email the desk") has commas between the address's lines. They are not a list's commas, so the and / or after
// the postcode casts no vote for or against the serial comma. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITHOUT_COMMA = "We sell posters, cards and calendars.\nWe ship to shops, schools and libraries.";

const firedWith = (sentence: string): boolean => firedRules(en, `${WITHOUT_COMMA}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: a postal address before and / or", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not count the commas of an address closed by a UK postcode or a US ZIP", () => {
    assert.equal(firedWith("Write to the Orders Desk, Harbour Prints, Upper Street, Leeds LS1 4AB, or email the desk."), false);
    assert.equal(firedWith("Send it to the Print Office, 12 Main Street, Springfield, IL 62701, and keep a copy."), false);
  });

  it("still counts a list with a serial comma that ends in no postcode", () => {
    assert.equal(firedWith("The team reviewed the plan, the budget, and the schedule."), true);
  });

  it("finds a postcode only right before the and / or, its comma allowed", () => {
    const at = (text: string): boolean => followsPostcode(text, text.length);
    assert.equal(at("Upper Street, Leeds LS1 4AB, "), true);
    assert.equal(at("London TW9 4DU "), true);
    assert.equal(at("London EC1A 1BB, "), true);
    assert.equal(at("Springfield, IL 62701-1234, "), true);
    assert.equal(at("Ottawa, ON K1A 0B1, "), true);
    assert.equal(at("posters, cards, "), false);
    assert.equal(at("model XLS1 4AB, "), false);
    assert.equal(at("in 2024, "), false);
    assert.equal(at(""), false);
  });
});
