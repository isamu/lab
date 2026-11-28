import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { namesScreenLabel } from "../packages/chaff/src/detectors/caps-screen-label.ts";

// all-caps-shouting and a capital run named as a label on a screen ("in SUBMIT TO APPROVER status"). Examples are
// self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const NOUNS = new Set(["status", "button"]);
const at = (text: string, run: string): boolean => namesScreenLabel(text, text.indexOf(run), text.indexOf(run) + run.length, NOUNS);
const findingsOf = (source: string): readonly string[] => namedRuleRun("all-caps-shouting", source, en).findings;

describe("namesScreenLabel", () => {
  it("a run inside a sentence followed by a screen noun", () => {
    assert.equal(at("Make sure it is in SUBMIT TO APPROVER status.", "SUBMIT TO APPROVER"), true);
    assert.equal(at("Then press the SAVE AND CLOSE button", "SAVE AND CLOSE"), true);
  });

  it("not a run at the head of a sentence, before another word, or before a noun run on in a longer word", () => {
    assert.equal(at("DO NOT CHANGE THIS status.", "DO NOT CHANGE THIS"), false);
    assert.equal(at("Please DO NOT TOUCH this file.", "DO NOT TOUCH"), false);
    assert.equal(at("Please DO NOT TOUCH buttons.", "DO NOT TOUCH"), false);
    assert.equal(at("Then, SAVE AND CLOSE button", "SAVE AND CLOSE"), false);
  });

  it("abnormal input: no nouns, a run at the very end, empty text", () => {
    assert.equal(namesScreenLabel("is in SUBMIT TO APPROVER status", 6, 24, new Set()), false);
    assert.equal(at("it is in SUBMIT TO APPROVER", "SUBMIT TO APPROVER"), false);
    assert.equal(namesScreenLabel("", 0, 0, NOUNS), false);
  });
});

describe("all-caps-shouting: a label named as on a screen", () => {
  it("does not report the label, and reports shouting in the same text", () => {
    const text = "Submit the form and approve the travel. Make sure the form is in SUBMIT TO APPROVER status. Please DO NOT SUBMIT THE FORM twice.\n";
    assert.deepEqual(findingsOf(text), ['"DO NOT SUBMIT THE FORM" is written in capitals']);
  });
});
