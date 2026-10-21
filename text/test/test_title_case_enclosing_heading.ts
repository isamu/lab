import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { enclosingHeadingOf, pageTitleOf } from "../packages/chaff/src/detectors/heading-case.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A section of the US Code as govinfo prints it: citation lines, then the section's catchline as the one "###" heading in
// sentence case, then the notes' "####" headings in Title Case. The catchline encloses the notes and names the page, and
// title-case-consistency reported it as the minority. Headings from 18 U.S.C. 1030 (public domain, chaff-corpus); the
// rest is self-written.

const RULES = loadRules("en");

const quotesFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "title-case-consistency")
    .map((finding) => finding.quote);

const at = (...depths: number[]): { depth: number; index: number }[] => depths.map((depth, index) => ({ depth, index }));

const DEPTHS = [0, 1, 2, 3];
const MAX_HEADINGS = 4;

/** Every list of `count` depths from DEPTHS. */
const depthShapes = (count: number): number[][] => (count === 0 ? [[]] : depthShapes(count - 1).flatMap((shape) => DEPTHS.map((depth) => [...shape, depth])));

describe("enclosingHeadingOf", () => {
  it("the first heading with no other as shallow, at any depth and after a preamble", () => {
    assert.equal(enclosingHeadingOf(at(0, 3, 4, 4))?.index, 1);
    assert.equal(enclosingHeadingOf(at(2, 3, 3))?.index, 0);
    assert.equal(enclosingHeadingOf(at(3))?.index, 0);
  });

  it("no title when another heading is as shallow or shallower, or there is no heading", () => {
    assert.equal(enclosingHeadingOf(at(3, 4, 3)), undefined);
    assert.equal(enclosingHeadingOf(at(3, 2, 4)), undefined);
    assert.equal(enclosingHeadingOf(at(0)), undefined);
    assert.equal(enclosingHeadingOf([]), undefined);
  });

  it("pageTitleOf keeps its rule (the one depth-1 heading that comes first) over every shape of up to four", () => {
    const shapes = Array.from({ length: MAX_HEADINGS + 1 }, (_unused, count) => depthShapes(count)).flat();
    shapes.forEach((depths) => {
      const sections = at(...depths);
      const headed = sections.filter((section) => section.depth > 0);
      const atOne = headed.filter((section) => section.depth === 1);
      const expected = headed[0]?.depth === 1 && atOne.length === 1 ? headed[0] : undefined;
      assert.equal(pageTitleOf(sections), expected, depths.join(","));
    });
  });
});

describe("title-case-consistency: the heading that encloses the others is the title", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: a sentence-case catchline over Title Case notes, after citation lines", () => {
    const source = [
      "18 U.S.C.\nUnited States Code, 2023 Edition\nSec. 1030 - Fraud and related activity in connection with computers",
      "### §1030. Fraud and related activity in connection with computers\n\n(a) Whoever—",
      "#### References in Text\n\nText.",
      "#### Effective Date of 2002 Amendment\n\nText.",
      "#### Transfer of Functions\n\nText.",
      "#### Reports to Congress\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("invalid: a note heading in the minority below the catchline is still reported", () => {
    const source = [
      "### §1030. Fraud and related activity in connection with computers\n\nText.",
      "#### References in Text\n\nText.",
      "#### Transfer of Functions\n\nText.",
      "#### Reports to congress\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), ["Reports to congress"]);
  });

  it("invalid: a later heading as shallow as the first makes the first a section heading again", () => {
    const source = [
      "### Fraud and related activity\n\nText.",
      "#### References in Text\n\nText.",
      "### Transfer of Functions\n\nText.",
      "#### Reports to Congress\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), ["Fraud and related activity"]);
  });
});
