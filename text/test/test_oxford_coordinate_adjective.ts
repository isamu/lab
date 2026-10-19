import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { endsWithModifier, opensWithModifiedNoun } from "../packages/chaff/src/detectors/coordinate-adjective.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// oxford-comma-consistency: coordinate adjectives on one noun ("long-term, strategic collaboration") before a two-item
// "A and B" are not a list of three. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";
const WITHOUT_COMMA = "We sell posters, cards and calendars.\nWe ship to shops, schools and libraries.";

const firedAfter = (usual: string, sentence: string): boolean => firedRules(en, `${usual}\n\n${sentence}\n`).includes(RULE);

const words = (...pairs: readonly (readonly [string, string])[]): Token[] => pairs.map(([surface, pos]) => ({ surface, pos, span: { start: 0, end: 0 } }));

describe("oxford-comma-consistency: coordinate adjectives", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not read two adjectives on one noun as two items", () => {
    assert.equal(firedAfter(WITH_COMMA, "The plan reflects the city's long-term, strategic partnership with schools and libraries."), false);
  });

  it("still counts a list of adjectives, and a list after coordinate adjectives", () => {
    assert.equal(firedAfter(WITH_COMMA, "The club sells first, standard and economy tickets."), true);
    assert.equal(firedAfter(WITHOUT_COMMA, "We sell fresh, organic produce, cheese, and bread."), true);
    assert.equal(firedAfter(WITH_COMMA, "We sell fresh, organic produce, cheese and bread."), true);
    assert.equal(firedAfter(WITHOUT_COMMA, "We hired full-time, part-time, and seasonal staff."), true);
  });

  it("endsWithModifier and opensWithModifiedNoun", () => {
    assert.equal(endsWithModifier(words(["the", "DET"], ["fresh", "ADJ"])), false);
    assert.equal(endsWithModifier(words(["long", "ADJ"], ["-", "X"], ["term", "NOUN"])), true);
    assert.equal(endsWithModifier(words(["vice", "NOUN"], ["-", "X"], ["president", "NOUN"])), false);
    assert.equal(endsWithModifier(words(["posters", "NOUN"])), false);
    assert.equal(endsWithModifier([]), false);
    assert.equal(opensWithModifiedNoun(words(["strategic", "ADJ"], ["partnership", "NOUN"])), true);
    assert.equal(opensWithModifiedNoun(words(["second", "ADJ"])), false);
    assert.equal(opensWithModifiedNoun(words(["short", "ADJ"], ["-", "X"], ["term", "NOUN"])), false);
    assert.equal(opensWithModifiedNoun([]), false);
  });
});
