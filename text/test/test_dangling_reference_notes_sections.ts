import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { inDocumentOrder } from "../packages/chaff/src/structure/issues.ts";

// A US Code section's notes set out Acts and Executive orders whole. An order numbers its sections "Sec. 2." in the
// paragraph; an Act quoted in the notes opens each paragraph with a quotation mark ('#### "SEC. 3. REQUIREMENT …').
// "section 3(b) of this order" and "section 3 of this Act" point at those sections. Lines from 5 U.S.C. 552 and its
// notes (public domain, chaff-corpus #54); the others are self-written.

const SOURCE = (...body: string[]): string => ["### §552. Public information", "", "(a) Each agency shall publish rules.", "", ...body].join("\n\n");

const dangling = (...body: string[]): string[] =>
  runRules(buildDocument("s.md", SOURCE(...body), en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

const articles = (...body: string[]): string[] => {
  const tree = buildDocument("s.md", SOURCE(...body), en).structure;
  return tree === undefined ? [] : inDocumentOrder(tree).flatMap((node) => (node.kind === "article" ? [node.address] : []));
};

describe("dangling-reference and the sections of an order or Act set out in the notes", () => {
  it("valid: an Executive order's Sec. N. paragraphs", () => {
    const body = [
      "#### Ex. Ord. No. 13392. Improving Agency Disclosure of Information",
      "Section 1. Policy. Agencies shall respond courteously.",
      "Sec. 2. Agency Chief FOIA Officers. The head of each agency shall designate an officer.",
      "Sec. 3. Review, Plan, and Report.",
      "(b) Each agency shall develop a plan.",
      "Sec. 4. Attorney General. The Attorney General shall report on the plans under section 3(b) of this order.",
    ];
    assert.deepEqual(dangling(...body), []);
    assert.deepEqual(articles(...body), ["552", "1", "2", "3", "4"]);
  });

  it("valid: an Act quoted in the notes, its sections opening with a quotation mark", () => {
    const body = [
      "#### Nazi War Crimes Disclosure",
      '#### "SECTION 1. SHORT TITLE.',
      "\"This Act may be cited as the 'Nazi War Crimes Disclosure Act'.",
      '#### "SEC. 2. ESTABLISHMENT OF THE WORKING GROUP.',
      "\"(1) 'Nazi war criminal records' has the meaning given such term under section 3 of this Act.",
      '#### "SEC. 3. REQUIREMENT OF DISCLOSURE OF RECORDS.',
      '"The records shall be released.',
    ];
    assert.deepEqual(dangling(...body), []);
    assert.deepEqual(articles(...body), ["552", "1", "2", "3"]);
  });

  it("invalid: a section the order does not have is still reported", () => {
    assert.deepEqual(dangling("Sec. 2. Definitions. The plans under section 5 of this order are reviewed."), ["section 5"]);
  });

  it("invalid: a citation header without a full stop after the number is not a section", () => {
    assert.deepEqual(articles("Sec. 553 - Rule making"), ["552"]);
    assert.deepEqual(articles("Sec. 3 applies to the plans."), ["552"]);
  });
});
