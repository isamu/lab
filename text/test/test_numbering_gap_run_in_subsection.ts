import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { inDocumentOrder } from "../packages/chaff/src/structure/issues.ts";

// A contract extracted to plain text runs a section's first subsection into the heading's line: "7 Indemnification.
// 7.1 Each Party shall…". The 7.1 was not read, so "7.2" was reported after "6.4" and "Section 7.1" as not in the
// document. Self-written lines.

const findings = (rule: string, ...lines: string[]): string[] =>
  runRules(buildDocument("c.txt", lines.join("\n\n"), en), loadRules("en"), {}, true, "legal/contract")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => String(finding.values["label"] ?? ""));

const addresses = (...lines: string[]): string[] => {
  const tree = buildDocument("c.txt", lines.join("\n\n"), en).structure;
  return tree === undefined ? [] : inDocumentOrder(tree).flatMap((node) => (node.kind === "article" ? [node.address] : []));
};

const CONTRACT = [
  "6 Term.",
  "6.1 This Agreement starts on the Effective Date.",
  "6.2 Either Party may end this Agreement on notice.",
  "7 Indemnification and Insurance. 7.1 Each Party shall defend the other Party against third-party claims.",
  "7.2 Neither Party is liable for indirect damages.",
  "8 Liability.",
  "8.1 The indemnity under Section 7.1 is not capped.",
];

describe("numbering-gap: a subsection run into its section heading's line", () => {
  it("valid: the run-in N.1 is an address, so N.2 follows it and a reference to it resolves", () => {
    assert.deepEqual(addresses(...CONTRACT), ["6.1", "6.2", "7.1", "7.2", "8.1"]);
    assert.deepEqual(findings("numbering-gap", ...CONTRACT), []);
    assert.deepEqual(findings("dangling-reference", ...CONTRACT), []);
  });

  it("valid: a heading closed by a colon", () => {
    assert.deepEqual(addresses("3 Payment: 3.1 The Customer pays each invoice in full.", "3.2 Late amounts bear interest."), ["3.1", "3.2"]);
  });

  it("invalid: a gap after the run-in subsection is still reported", () => {
    assert.deepEqual(findings("numbering-gap", "7 Indemnification. 7.1 Each Party shall defend the other.", "7.3 Neither Party is liable."), ["7.3"]);
  });

  it("valid: a number that does not continue the heading's own number, or is not its first, opens nothing", () => {
    assert.deepEqual(addresses("7 Indemnification. 8.1 Each Party shall defend the other."), []);
    assert.deepEqual(addresses("7 Indemnification. 7.2 Each Party shall defend the other."), []);
  });

  it("valid: a decimal number in running text is not an address", () => {
    assert.deepEqual(addresses("7 days after delivery the Buyer pays 7.1 percent of the price."), []);
    assert.deepEqual(addresses("The rate is 7. 7.1 Each Party shall pay it."), []);
  });
});
