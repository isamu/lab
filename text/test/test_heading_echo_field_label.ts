import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { fieldValueStart } from "../packages/chaff/src/detectors/field-label.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A report template sets a field under a heading with the same words (## Project Status → Current project status: Ongoing).
// The label is the form; the value is what the writer said, and only the value is measured against the heading. Self-written.

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "business/press-release").findings.filter((finding) => finding.rule === "heading-echo").length;
};

describe("fieldValueStart", () => {
  it("where the value of a field on the first line starts", () => {
    assert.equal(fieldValueStart("Current project status: Ongoing."), "Current project status:".length);
    assert.equal(fieldValueStart("- Current project status:Ongoing (low activity)"), "- Current project status:".length);
    assert.equal(fieldValueStart("**Current status:** Ongoing"), "**Current status:".length);
    assert.equal(fieldValueStart("現在の状況：継続中です。"), "現在の状況：".length);
    assert.equal(fieldValueStart("Current project status:\nNo new members."), "Current project status:".length);
  });

  it("none for a sentence, a long clause, a link, text with no colon, or no letter before the colon", () => {
    assert.equal(fieldValueStart("We met twice. Status: fine."), undefined);
    assert.equal(fieldValueStart("The status of the project as of this quarter is: ongoing."), undefined);
    assert.equal(fieldValueStart("https://example.com/status"), undefined);
    assert.equal(fieldValueStart("No colon here."), undefined);
    assert.equal(fieldValueStart(""), undefined);
    assert.equal(fieldValueStart(": no label"), undefined);
    assert.equal(fieldValueStart("12: 30"), undefined);
  });
});

describe("heading-echo and a template field named after its heading", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("valid: a field whose label repeats the heading, value given or left blank", () => {
    assert.equal(echoes("## Project Status:\n- Current project status: Ongoing with steady activity.\n- Issues for the board: None.\n", en), 0);
    assert.equal(echoes("## Project Status:\nCurrent project status: Ongoing\n\nIssues for the board: None\n", en), 0);
    assert.equal(echoes("## Project Status:\nCurrent project status: \nNo new members joined.\n", en), 0);
    assert.equal(echoes("## 事業の現在の状況\n\n事業の現在の状況：継続中。\n", ja), 0);
  });

  it("invalid: a value or a sentence that restates the heading", () => {
    assert.equal(echoes("## Project Status\n\nNote: this is the project status.\n", en), 1);
    assert.equal(echoes("## Project Status\n\nThis section gives the project status.\n", en), 1);
    assert.equal(echoes("## Expenses requiring receipts\n\nThe following expenses require receipts:\n", en), 1);
    assert.equal(echoes("## 事業の現在の状況\n\n事業の現在の状況について説明します。\n", ja), 1);
  });
});
