import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { nameHeadAcronyms } from "../packages/chaff/src/detectors/acronym-name-head.ts";

// undefined-acronym and an acronym that heads a name spelled out with its own longer acronym (XSL Transformations (XSLT)).
// Examples are self-written.

const doc = (...body: string[]): string => ["# Formats", "", ...body, "", "The SRE joins the call."].join("\n");

describe("nameHeadAcronyms", () => {
  it("valid: the head of a name whose bracketed acronym starts with it, across a line break or a hyphen too", () => {
    assert.deepEqual([...nameHeadAcronyms("using the XSL Transformations (XSLT) code")], ["XSL"]);
    assert.deepEqual([...nameHeadAcronyms("the DNS Security\n   Extensions (DNSSEC) apply")], ["DNS"]);
    assert.deepEqual([...nameHeadAcronyms("a QRZ-Based Scheme (QRZBS) runs")], ["QRZ"]);
  });

  it("invalid: a bracketed acronym that does not start with the head, is no longer, or no name between", () => {
    assert.deepEqual([...nameHeadAcronyms("the DNS-based Authentication of Named Entities (DANE)")], []);
    assert.deepEqual([...nameHeadAcronyms("the XSL Transformations (XSL) code")], []);
    assert.deepEqual([...nameHeadAcronyms("the XSL (XSLT) code")], []);
    assert.deepEqual([...nameHeadAcronyms("the XSL code transforms (XSLT)")], []);
    assert.deepEqual([...nameHeadAcronyms("")], []);
  });
});

describe("undefined-acronym: the head of a name spelled out with a longer acronym", () => {
  it("valid: the head is not reported", () => {
    assert.deepEqual(reportedAcronyms(en, doc("It uses the referenced XSL Transformations (XSLT) code.")), ["SRE"]);
  });

  it("invalid: the same acronym on its own is still reported", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The XSL team meets on Fridays.")), ["XSL", "SRE"]);
  });
});
