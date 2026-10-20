import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isWrappedReference, unlessWrappedReference } from "../packages/chaff/src/structure/wrapped-reference.ts";

// numbering-gap and a cross-reference that a wrapped paragraph carries to the start of a line ("… the key described in
// / Section 2.3."). It is the end of a sentence, not the heading of Section 2.3, so the sections around it run in order.
// A heading alone on its line after a full stop or a title is still a heading. Every text is self-written.

const RULE = "numbering-gap";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en, "a.txt", "technical/spec").findings;

const SPEC = [
  "2.1.  Fields",
  "",
  "   Each field is one line.",
  "",
  "2.2.  Keys",
  "",
  "   The key must match the signature described in",
  "   Section 2.1.",
  "",
  "2.3.  Expiry",
  "",
  "   The file expires (as given in",
  "   Section 2.2).",
  "",
  "2.4.  Contacts",
  "",
  "   Contacts are listed in order.",
  "",
].join("\n");

describe("wrapped-reference", () => {
  it("a numbered line with no title after a line that ends mid-sentence", () => {
    assert.equal(isWrappedReference("", "   The key must match the signature described in"), true);
    assert.equal(isWrappedReference(").", "   The file expires (as given in"), true);
    assert.equal(isWrappedReference("", "   under the terms of this agreement,"), true);
  });

  it("not after a full stop, a title, a colon or nothing, and not with a title", () => {
    assert.equal(isWrappedReference("", "The parties agree as follows."), false);
    assert.equal(isWrappedReference("", "DEFINITIONS"), false);
    assert.equal(isWrappedReference("", "Definitions"), false);
    assert.equal(isWrappedReference("", "The terms are:"), false);
    assert.equal(isWrappedReference("", undefined), false);
    assert.equal(isWrappedReference("Expiry", "as described in"), false);
    assert.equal(isWrappedReference("the face value of the ticket.", "(b) information about any restriction, and"), false);
    assert.equal(isWrappedReference("................................", "(a) the first act of the year,"), false);
    assert.equal(isWrappedReference(":", "   the key must match the one described in"), false);
    assert.equal(isWrappedReference("", "Scope and application"), false);
  });

  it("unlessWrappedReference keeps a heading line and an undefined line", () => {
    const numbered = { rest: "" };
    assert.equal(unlessWrappedReference(numbered, true, "the key is the one described in"), numbered);
    assert.equal(unlessWrappedReference(numbered, false, "the key is the one described in"), undefined);
    assert.equal(unlessWrappedReference(undefined, false, "the key is the one described in"), undefined);
  });
});

describe("numbering-gap: a cross-reference wrapped to the start of a line", () => {
  it("the sections around it run in order", () => {
    assert.deepEqual(findingsOf(SPEC), []);
  });

  it("a real gap beside it is still reported", () => {
    assert.equal(findingsOf(SPEC.replace("2.4.  Contacts", "2.6.  Contacts")).length, 1);
  });
});
