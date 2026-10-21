import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: a comma before the last item that does not separate the items of one list. After a numbered
// division of a code it opens the division's name (Title 44, Public Printing and Documents); before a phrase that
// qualifies the item ahead of it, it sets that phrase off (in accordance with law or as directed). The and / or casts no
// vote for or against the serial comma. Examples are from the United States Code (public domain) and self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";

const firedWith = (sentence: string): boolean => firedRules(en, `${WITH_COMMA}\n\n${sentence}\n`).includes(RULE);

describe("oxford-comma-consistency: a comma that names or qualifies the item before it", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not count the and inside the name of a numbered title of the Code (5 U.S.C. 553 notes)", () => {
    assert.equal(firedWith("It is set out in a note under section 3501 of Title 44, Public Printing and Documents."), false);
    assert.equal(
      firedWith(
        "Section 553 of former Title 5, Executive Departments and Government Officers and Employees, was transferred to section 2245 of Title 7, Agriculture.",
      ),
      false,
    );
  });

  it("does not count the and / or inside a phrase that qualifies the item before it (44 U.S.C. 3554)", () => {
    assert.equal(
      firedWith("(C) shall include using automated tools, consistent with standards and guidelines promulgated under section 11331 of title 40;"),
      false,
    );
    assert.equal(firedWith("(IV) any other agency or office, in accordance with law or as directed by the President; and"), false);
    assert.equal(firedWith("The office keeps records, with care and with patience."), false);
  });

  it("still counts a list of numbered divisions, and of names after one", () => {
    assert.equal(firedWith("We closed Chapter 5, Chapter 6 and Chapter 7."), true);
    assert.equal(firedWith("We read Title 5, Title 7 and Title 44."), true);
    assert.equal(firedWith("We visited Building 4, Hall A and Room 3."), true);
    assert.equal(firedWith("The references include policy, Title 44 and Commerce."), true);
  });

  it("still counts a list of phrases when the item before has one of its kind", () => {
    assert.equal(firedWith("We met in Paris, in London and in Rome."), true);
    assert.equal(firedWith("Contact us by phone, by email or in person."), true);
    assert.equal(firedWith("Send it to Alice, to Bob or to Carol."), true);
    assert.equal(firedWith("The house is big, old and cold."), true);
    assert.equal(firedWith("We sell apples, fresh pears and plums."), true);
  });
});
