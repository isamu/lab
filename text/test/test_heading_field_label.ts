import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isFieldLabel } from "../packages/chaff/src/field-label-heading.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// heading-end-punctuation-mix: a contact block's labels ("Phone:") are not section titles. Examples are self-written.

const RULES = loadRules("en");

const odd = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, measuredOffOn("docs/faq"), true, "docs/faq")
    .findings.filter((finding) => finding.rule === "heading-end-punctuation-mix")
    .map((finding) => String(finding.values?.["heading"]));

const QUESTIONS = [
  "## Visiting",
  "#### When is the park open?",
  "The park is open every day.",
  "#### Do I need a pass?",
  "Yes, buy one at the gate.",
  "#### Can I bring my dog?",
  "Dogs are allowed on roads.",
  "#### Where can I camp?",
  "Camp in the campgrounds.",
  "#### Is there water?",
  "Bring your own.",
  "#### Are there showers?",
  "Not in the park.",
  "#### Can I fly a drone?",
  "No, drones are not allowed.",
  "#### Where can I park?",
  "Park at the trailheads.",
].join("\n\n");

describe("isFieldLabel", () => {
  it("a heading with a colon over a value", () => {
    assert.equal(isFieldLabel("Phone:", "\n\n555 0100\n\n"), true);
    assert.equal(isFieldLabel("Mailing Address:", "\n\n100 Park Road\nPine Town, CA 90000\n"), true);
    assert.equal(isFieldLabel("電話：", "\n\n03-0000-0000\n"), true);
  });

  it("not without a colon, over a sentence, a list, words without a number, many lines, or nothing", () => {
    assert.equal(isFieldLabel("Phone", "\n\n555 0100\n"), false);
    assert.equal(isFieldLabel("Getting there:", "\n\nTake the shuttle from the visitor center.\n"), false);
    assert.equal(isFieldLabel("Questions:", "\n\nWhat should I bring?\n"), false);
    assert.equal(isFieldLabel("Getting there:", "\n\nTake the shuttle from the visitor center\n"), false);
    assert.equal(isFieldLabel("Contact:", "\n\nPlease email **support@example.com.**\n"), false);
    assert.equal(isFieldLabel("Phone:", "\n\n"), false);
    assert.equal(isFieldLabel("Attendees:", "\n\n- Alice 1\n- Bob 2\n"), false);
    assert.equal(isFieldLabel("Notes:", "\n\nSee below\n"), false);
    assert.equal(isFieldLabel("Hours:", "\n\nMon 9\nTue 9\nWed 9\nThu 9\n"), false);
    assert.equal(isFieldLabel("", ""), false);
  });
});

describe("heading-end-punctuation-mix: field labels", () => {
  it("valid: the labels of a contact block under question headings", () => {
    const contact = ["### Contact Info", "#### Mailing Address:", "100 Park Road\nPine Town, CA 90000", "#### Phone:", "555 0100"].join("\n\n");
    assert.deepEqual(odd(`${QUESTIONS}\n\n${contact}\n`), []);
  });

  it("invalid: a heading with a colon over prose is still a section title", () => {
    const section = ["#### Getting there:", "Take the shuttle from the visitor center."].join("\n\n");
    assert.deepEqual(odd(`${QUESTIONS}\n\n${section}\n`), ["Getting there:"]);
  });
});
