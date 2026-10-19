import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { dashBreaks } from "../packages/chaff/src/detectors/dash-break.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";

// oxford-comma-consistency: a dateline ("Washington, DC – The Cybersecurity and Infrastructure Security Agency …") has a
// comma that a spaced dash closes off. It is not a list's comma, so the and / or after the dash casts no vote for or
// against the serial comma. Examples are self-written.

const RULE = "oxford-comma-consistency";
const WITH_COMMA = "We sell posters, cards, and calendars.\nWe ship to shops, schools, and libraries.";

const firedWith = (sentence: string): boolean => firedRules(en, `${WITH_COMMA}\n\n${sentence}\n`).includes(RULE);

const dashBreakAt = (sentence: string, conjunction: string): boolean => {
  const tokens = buildDocument("a.md", `${sentence}\n`, en).sentences[0]?.tokens ?? [];
  return dashBreaks(tokens, `${sentence}\n`)[tokens.findIndex((token) => token.surface === conjunction)] === true;
};

describe("oxford-comma-consistency: a dash after the last comma", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not count the comma of a dateline before an en dash, an em dash or a spaced hyphen", () => {
    assert.equal(firedWith("Washington, DC – The Cybersecurity and Infrastructure Security Agency hosted the exercise."), false);
    assert.equal(firedWith("Leeds, UK — The council and the board met on Monday."), false);
    assert.equal(firedWith("Austin, Texas - Sales and marketing grew this year."), false);
  });

  it("still counts a list written after the dash", () => {
    assert.equal(firedWith("Washington, DC – The agency, the bureau and the board met."), true);
  });

  it("still counts a list with no dash, and a hyphen inside a word", () => {
    assert.equal(firedWith("The team reviewed the plan, the budget and the schedule."), true);
    assert.equal(firedWith("We use well-known tools, old scripts and new parsers."), true);
  });

  it("reads where the dash stands", () => {
    assert.equal(dashBreakAt("Washington, DC – The office and the agency met.", "and"), true);
    assert.equal(dashBreakAt("The plan, the budget and the schedule.", "and"), false);
    assert.equal(dashBreakAt("The plan – the budget, the scope and the schedule.", "and"), false);
    assert.equal(dashBreakAt("The office and the agency met.", "and"), false);
    assert.equal(dashBreakAt("A well-known, home-made and tested tool.", "and"), false);
    assert.equal(dashBreakAt("The plan, the budget – and the schedule.", "and"), false);
    assert.equal(dashBreakAt("The plan, the budget (labor – cost and time).", "and"), false);
    assert.equal(dashBreakAt("Paris (France, EU) – The office and the agency met.", "and"), false);
  });
});
