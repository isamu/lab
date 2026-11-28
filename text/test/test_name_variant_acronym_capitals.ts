import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { spellsAcronym } from "../packages/chaff/src/detectors/acronym-capitals.ts";

// name-variant and a word whose inner capitals spell out an acronym ("axle (Axis-guided eXperience ELicitation)"). Examples
// are self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const at = (text: string, word: string): boolean => spellsAcronym(text, text.indexOf(word), word);

describe("spellsAcronym", () => {
  it("a word with inner capitals in a bracket whose capitals are the letters of the word before it", () => {
    const text = "We add a stage, axle (Axis-guided eXperience ELicitation). Elicitation comes first.";
    assert.equal(at(text, "ELicitation"), true);
    assert.equal(at(text, "eXperience"), true);
    assert.equal(at("the tool, CoDA (COntext Diff Analysis), runs", "COntext"), true);
  });

  it("not a word without inner capitals, outside a bracket, or in a bracket whose capitals spell something else", () => {
    const text = "We add a stage, axle (Axis-guided eXperience ELicitation). Elicitation comes first.";
    assert.equal(at(text, "Elicitation"), false);
    assert.equal(at("We use ELicitation here.", "ELicitation"), false);
    assert.equal(at("a stage, axle (Axis eXperience ELicitation Test)", "ELicitation"), false);
    assert.equal(at("a stage (eXperience ELicitation)", "ELicitation"), false);
  });

  it("abnormal input: an unclosed bracket, a bracket on another line, empty text", () => {
    assert.equal(at("axle (Axis eXperience ELicitation", "ELicitation"), false);
    assert.equal(at("axle (Axis\neXperience ELicitation)", "ELicitation"), false);
    assert.equal(spellsAcronym("", 0, ""), false);
  });
});

describe("name-variant: capitals that spell an acronym", () => {
  it("does not report the word whose capitals spell the acronym", () => {
    const text = "We add a stage, axle (Axis-guided eXperience ELicitation). Elicitation comes first, and Elicitation is short.\n";
    assert.deepEqual(namedRuleRun("name-variant", text, en).findings, []);
  });
});
