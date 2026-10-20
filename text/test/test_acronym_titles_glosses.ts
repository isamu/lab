import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { glossedAcronyms, headingsSpellingOut } from "../packages/chaff/src/detectors/acronym-gloss.ts";

// undefined-acronym and four ways a document leaves an acronym explained or not an acronym at all (chaff-corpus #54):
// a Public Law's title cited in lower case ("Pub. L. 101–73, title IX, §962", 18 U.S.C. 1030, public domain), the S&P
// 500 index, an apposition between dashes ("The VIX—a forward-looking measure …—", FOMC minutes, public domain), and a
// heading that is the name spelled out ("## Federal Open Market Committee" over "FOMC Minutes"). Other text is self-written.

describe("glossedAcronyms", () => {
  [
    ["The VIX—a forward-looking measure of near-term stock market volatility—declined.", "VIX"],
    ["The VIX – an index of expected volatility – fell.", "VIX"],
    ["Our SLA—the service level agreement—applies.", "SLA"],
  ].forEach(([text, acronym]) => {
    it(`valid: ${String(text)}`, () => assert.deepEqual([...glossedAcronyms(String(text))], [acronym]));
  });

  [
    ["a dash that joins two clauses", "The VIX—it fell sharply."],
    ["a dash with no closing dash", "The VIX—a measure of volatility, fell."],
    ["a dash pair without an article", "The VIX—down sharply—ended lower."],
    ["the closing dash on another line", "The VIX—a measure of\nvolatility—fell."],
    ["a lower-case word", "The vix—a measure of volatility—fell."],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual([...glossedAcronyms(String(text))], []));
  });

  it("abnormal input: empty text", () => assert.deepEqual([...glossedAcronyms("")], []));
});

const headingSpellsOut = (heading: string, acronym: string): boolean => headingsSpellingOut([heading])(acronym);

describe("headingsSpellingOut", () => {
  [
    ["Federal Open Market Committee", "FOMC"],
    ["Bureau of Labor Statistics", "BLS"],
    ["Kennedy Space Center", "KSC"],
  ].forEach(([heading, acronym]) => {
    it(`valid: ${String(heading)} → ${String(acronym)}`, () => assert.equal(headingSpellsOut(String(heading), String(acronym)), true));
  });

  [
    ["a heading that holds the name among other words", "Select Open Source Software Licence", "OSS"],
    ["a heading whose capitals only happen to spell it", "Mission One: Transformed public services", "MOT"],
    ["a sentence-case heading", "Federal open market committee", "FOMC"],
    ["two letters", "Data Protection", "DP"],
    ["letters in another order", "Committee Federal Open Market", "FOMC"],
    ["one word too many", "Federal Open Market Committee Minutes", "FOMC"],
  ].forEach(([form, heading, acronym]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(headingSpellsOut(String(heading), String(acronym)), false));
  });

  it("abnormal input: empty heading, empty acronym, no headings", () => {
    assert.equal(headingSpellsOut("", "FOMC"), false);
    assert.equal(headingSpellsOut("Federal Open Market Committee", ""), false);
    assert.equal(headingsSpellingOut([])("FOMC"), false);
  });

  it("any of several headings", () => {
    assert.equal(headingsSpellingOut(["Overview", "Federal Open Market Committee"])("FOMC"), true);
  });
});

const doc = (...body: string[]): string => ["# Notes", "", ...body, "", "The SRE joins the call."].join("\n");

describe("undefined-acronym: titles, indexes, glosses and headings", () => {
  it("valid: a Public Law's title cited in lower case is a number", () => {
    assert.deepEqual(reportedAcronyms(en, doc("Amended Pub. L. 101–73, title IX, §962(a)(5); Pub. L. 104–106, div. E, title LVI, §5605(a).")), ["SRE"]);
  });

  it("valid: the S&P 500 index", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The S&P 500 index increased by nearly 6 percent.")), ["SRE"]);
  });

  it("valid: an acronym glossed between dashes", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The VIX—a forward-looking measure of near-term stock market volatility—declined.")), ["SRE"]);
  });

  it("valid: an acronym under a heading that spells it out", () => {
    assert.deepEqual(reportedAcronyms(en, ["## Federal Open Market Committee", "", "FOMC Minutes", "", "The SRE joins the call."].join("\n")), ["SRE"]);
  });

  it("invalid: a Roman numeral after a lower-case word that is not a division, and an unglossed acronym", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The page IX shows the VIX fell.")), ["IX", "VIX", "SRE"]);
  });

  it("invalid: a heading that holds the words among others leaves the acronym unexplained", () => {
    assert.deepEqual(reportedAcronyms(en, ["## Select Open Source Software Licence", "", "Publish OSS code.", "", "The SRE joins the call."].join("\n")), [
      "OSS",
      "SRE",
    ]);
  });
});
