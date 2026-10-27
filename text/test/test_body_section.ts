import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { bodySectionOf } from "../packages/chaff/src/body-section.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Section } from "../packages/chaff/src/plugin.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// The notice excerpts are from Federal Register documents (US federal works, public domain); the others are self-written.

const RULES = loadRules("en");

const preambleFindings = (source: string): number =>
  runRules(buildDocument("t.md", source, en), RULES, {}, true, "business/proposal").findings.filter((finding) => finding.rule === "preamble-length").length;

const notRunPreamble = (source: string): boolean =>
  runRules(buildDocument("t.md", source, en), RULES, {}, true, "business/proposal").skipped.some((entry) => entry.rule === "preamble-length");

const section = (depth: number, heading: string): Section => ({
  depth,
  heading,
  span: { start: 0, end: 0 },
  sentences: [],
  strongCount: 0,
  firstSentence: undefined,
});

const NOTICE = [
  "# AGENCY:",
  "U.S. Department of Health and Human Services (HHS or the Department).",
  "# ACTION:",
  "Notice of Request for Information (RFI) on electromagnetic field (EMF) exposure and human health.",
  "# DATES:",
  "Comments on this notice must be received no later than October 21, 2026.",
  "# FOR FURTHER INFORMATION CONTACT:",
  "Victoria Marshall, Office of the Assistant Secretary for Health.",
  "# SUPPLEMENTARY INFORMATION:",
  "Electromagnetic fields (EMFs) are energy fields produced by moving electrically charged particles and electrical currents.",
  "Public concern about potential health effects from RF/EMF exposure has increased.",
  "## Request for Information",
  "For this RFI, HHS is seeking input from the public.",
].join("\n\n");

describe("bodySectionOf", () => {
  it("the first heading below the title starts the body", () => {
    assert.equal(bodySectionOf([section(0, ""), section(1, "Title"), section(2, "Decision")])?.heading, "Decision");
  });

  it("a second top-level heading starts the body when it comes before any deeper one", () => {
    assert.equal(bodySectionOf([section(1, "AGENCY:"), section(1, "ACTION:"), section(2, "Request")])?.heading, "ACTION:");
    assert.equal(bodySectionOf([section(0, ""), section(1, "A"), section(1, "B")])?.heading, "B");
  });

  it("a top-level heading of several lines (a paragraph above a rule line) does not start the body", () => {
    assert.equal(bodySectionOf([section(0, ""), section(1, "Title"), section(1, "=====\nSubscribe here")]), undefined);
    assert.equal(bodySectionOf([section(1, "Title"), section(1, "=====\nSubscribe here"), section(2, "Decision")])?.heading, "Decision");
  });

  it("a title alone, or no heading at all, leaves no body", () => {
    assert.equal(bodySectionOf([section(0, ""), section(1, "Title")]), undefined);
    assert.equal(bodySectionOf([section(0, "")]), undefined);
    assert.equal(bodySectionOf([]), undefined);
  });

  it("without a top-level heading, the first heading of any depth starts the body", () => {
    assert.equal(bodySectionOf([section(0, ""), section(2, "Background"), section(3, "Detail")])?.heading, "Background");
  });
});

describe("preamble-length with top-level sections", () => {
  it("valid: a notice whose sections are all # headings has no preamble beyond its first section", () => {
    assert.equal(preambleFindings(NOTICE), 0);
  });

  it("invalid: paragraphs piled under the first of the top-level headings are still a preamble", () => {
    const source = [
      "# Notice of Request for Information",
      "Electromagnetic fields are energy fields produced by moving electrically charged particles.",
      "EMFs occur across a broad range of frequencies.",
      "Public concern about potential health effects has increased.",
      "# Request for Information",
      "HHS is seeking input from the public.",
    ].join("\n\n");
    assert.equal(preambleFindings(source), 1);
  });

  it("invalid: a title followed by paragraphs before the first ## heading is still flagged", () => {
    const source = [
      "# Store plan",
      "We opened stores near stations.",
      "The number of stores doubled.",
      "Suburban stores struggled.",
      "## Decision",
      "We will close two stores.",
    ].join("\n\n");
    assert.equal(preambleFindings(source), 1);
  });

  it("a rule line under a closing block is not a second heading: the page stays unmeasured", () => {
    const source = ["# Notice", "One.", "Two.", "Three.", "Four.", "=====\nSubscribe to the mailing list here\n=====\n"].join("\n\n");
    assert.equal(preambleFindings(source), 0);
    assert.ok(notRunPreamble(source));
  });

  it("a title alone, with no heading below it, is still not measured and says so", () => {
    assert.ok(notRunPreamble("# Store plan\n\nOne.\n\nTwo.\n\nThree.\n\nFour."));
  });
});
