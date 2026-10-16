import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { withoutFieldLabel } from "../packages/chaff/src/detectors/field-label.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A report template sets a field under a heading with the same words (## Project Status → Current project status: Ongoing).
// The label is the form; the value is what the writer said, and only the value is measured against the heading. Self-written.

const echoes = (source: string, adapter: LanguageAdapter): number => {
  const doc = buildDocument("a.md", source, adapter);
  return runRules(doc, loadRules(adapter.id), {}, false, "business/press-release").findings.filter((finding) => finding.rule === "heading-echo")
    .length;
};

describe("withoutFieldLabel", () => {
  it("takes out the label of a field on the first line", () => {
    assert.equal(withoutFieldLabel("Current project status: Ongoing."), " Ongoing.");
    assert.equal(withoutFieldLabel("- Current project status:Ongoing (low activity)"), "Ongoing (low activity)");
    assert.equal(withoutFieldLabel("**Current status:** Ongoing"), "** Ongoing");
    assert.equal(withoutFieldLabel("現在の状況：継続中です。"), "継続中です。");
    assert.equal(withoutFieldLabel("Current project status:\nNo new members."), "\nNo new members.");
  });

  it("keeps a sentence, a long clause, a link, and text with no colon", () => {
    assert.equal(withoutFieldLabel("We met twice. Status: fine."), "We met twice. Status: fine.");
    assert.equal(withoutFieldLabel("The status of the project as of this quarter is: ongoing."), "The status of the project as of this quarter is: ongoing.");
    assert.equal(withoutFieldLabel("https://example.com/status"), "https://example.com/status");
    assert.equal(withoutFieldLabel("No colon here."), "No colon here.");
    assert.equal(withoutFieldLabel(""), "");
    assert.equal(withoutFieldLabel(": no label"), ": no label");
    assert.equal(withoutFieldLabel("12: 30"), "12: 30");
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
    assert.equal(echoes("## 事業の現在の状況\n\n事業の現在の状況について説明します。\n", ja), 1);
  });
});
