import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { inDocumentOrder } from "../packages/chaff/src/structure/issues.ts";

// An Executive order set out in a statute's notes runs a section's title into its first item: "Sec. 4. General
// Provisions. (a) Nothing in this order…". The (a) was not read, so the clauses (i), (ii) under it and the next (b) made
// one list and "(b)" was reported after "(i)". Lines from Ex. Ord. No. 13992 and No. 13642 as set out under 5 U.S.C. 551
// and 552 (public domain, chaff-corpus); the others are self-written.

const SOURCE = (...body: string[]): string => ["### §551. Definitions", "", ...body].join("\n\n");

const gaps = (...body: string[]): string[] =>
  runRules(buildDocument("s.md", SOURCE(...body), en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => String(finding.values["label"] ?? ""));

const addresses = (...body: string[]): string[] => {
  const tree = buildDocument("s.md", SOURCE(...body), en).structure;
  return tree === undefined ? [] : inDocumentOrder(tree).flatMap((node) => (node.kind === "item" ? [node.address] : []));
};

const ORDER = [
  "Sec. 3. Implementation. The Director of the Office of Management and Budget shall promptly take steps to rescind any orders.",
  "Sec. 4. General Provisions. (a) Nothing in this order shall be construed to impair or otherwise affect:",
  "(i) the authority granted by law to an executive department or agency, or the head thereof; or",
  "(ii) the functions of the Director of the Office of Management and Budget relating to budgetary proposals.",
  "(b) This order shall be implemented in a manner consistent with applicable law and subject to the availability of appropriations.",
  "(c) This order is not intended to, and does not, create any right or benefit.",
];

describe("numbering-gap: a section title run into its first item", () => {
  it("valid: the run-in (a) opens the list its clauses and (b) belong to", () => {
    assert.deepEqual(gaps(...ORDER), []);
    assert.deepEqual(addresses(...ORDER), ["4.a", "4.a.i", "4.a.ii", "4.b", "4.c"]);
  });

  it("valid: a run-in (1) after an article's title opens a numbered list", () => {
    const body = ["Article 3. Term. (1) This Agreement starts on the Effective Date.", "(2) It ends after two years."];
    assert.deepEqual(gaps(...body), []);
    assert.deepEqual(addresses(...body), ["3.1", "3.2"]);
  });

  it("valid: the other heading forms, a colon and a title with abbreviations", () => {
    assert.deepEqual(addresses("Section 2. Definitions: (a) In this order the term applies.", "(b) The second item."), ["2.a", "2.b"]);
    assert.deepEqual(addresses("§2. Amendments to 5 U.S.C. 552. (a) In General.—The section is amended.", "(b) Effective Date."), ["2.a", "2.b"]);
  });

  it("invalid: a gap after the run-in item is still reported", () => {
    assert.deepEqual(gaps("Sec. 4. General Provisions. (a) Nothing in this order shall impair any authority.", "(c) This order creates no right."), ["(c)"]);
  });

  it("invalid: a later label run in after a title is not read as the list's start", () => {
    assert.deepEqual(addresses("Sec. 4. General Provisions. (b) Nothing in this order shall impair any authority."), []);
  });

  it("valid: a title that only mentions a label in its text opens nothing", () => {
    assert.deepEqual(addresses("Sec. 5. Scope of subsection (a) of section 3."), []);
    assert.deepEqual(addresses("Sec. 4. Applicability to section 5. (a) of this section applies only to new records."), []);
  });

  it("valid: a page flattened into one line keeps its run-in labels as text", () => {
    assert.deepEqual(addresses("ARTICLE II   EFFECT ON THE CAPITAL STOCK   Section 2.1   Effect on Capital Stock.   (a)   At the Effective Time."), []);
  });
});
