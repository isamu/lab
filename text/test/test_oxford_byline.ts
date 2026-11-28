import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// oxford-comma-consistency: a byline ("By Jane Moss, Head of Arts, Crafts, Music and Drama, Culture Office") names the
// writer's office. Its commas belong to the name, so the and inside it casts no vote. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\n\nWe ship to shops, schools, and libraries.";

const firedWith = (line: string): boolean => firedRules(en, `${line}\n\n${WITH_COMMA}\n`).includes(RULE);

describe("oxford-comma-consistency: a title of office in a byline", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not count the and inside a byline's title of office", () => {
    assert.equal(firedWith("By Jane Moss, Head of Arts, Crafts, Music and Drama, Culture Office"), false);
  });

  it("still counts a list in a sentence that opens with By", () => {
    assert.equal(firedWith("By Monday, Leeds, York and Hull joined."), true);
    assert.equal(firedWith("By Jane Moss, Leeds, York and Hull were visited."), true);
  });

  it("still counts a lower-case list in a byline", () => {
    assert.equal(firedWith("By Jane Moss, writer of posters, cards and calendars"), true);
  });
});
