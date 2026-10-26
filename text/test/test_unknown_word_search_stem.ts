import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isSearchStem } from "../packages/chaff/src/detectors/unknown-word-context.ts";

// unknown-word on a keyword list whose stems end in a wildcard (vaccin*). Every example is self-written.

const unknown = (source: string): readonly string[] => namedRuleRun("unknown-word", `${source}\n`, en).findings;

describe("unknown-word: a search stem with a wildcard", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("does not report a stem that ends in *", () => {
    assert.deepEqual(unknown("Health terms: doctor, vaccine, vaccin*, clinic, pharma*."), []);
    assert.deepEqual(unknown("Trade terms: econom*, market, stock*"), []);
  });

  it("still reports a typo in emphasis, and one with no wildcard", () => {
    assert.deepEqual(unknown("The report is *attched* to this email."), ['"attched" is not in the dictionary; did you mean "attached"?']);
    assert.deepEqual(unknown("The report is **attched** to this email."), ['"attched" is not in the dictionary; did you mean "attached"?']);
    assert.deepEqual(unknown("The report is attched* to this email."), ['"attched" is not in the dictionary; did you mean "attached"?']);
    assert.deepEqual(unknown("Health terms: doctor, vaccine, vaccin, clinic."), ['"vaccin" is not in the dictionary; did you mean "vaccine"?']);
  });

  it("reads a * that a separator or the line's end follows, not one of emphasis or a footnote", () => {
    assert.ok(isSearchStem("vaccin*, x", 0, "vaccin"));
    assert.ok(isSearchStem("econom*", 0, "econom"));
    assert.ok(!isSearchStem("*vaccin*", 1, "vaccin"));
    assert.ok(!isSearchStem("vaccin*e", 0, "vaccin"));
    assert.ok(!isSearchStem("vaccin", 0, "vaccin"));
    assert.ok(isSearchStem("vaccin*; drug", 0, "vaccin"));
    assert.ok(isSearchStem("vaccin*\nnext", 0, "vaccin"));
    assert.ok(!isSearchStem("vaccin* is a footnote", 0, "vaccin"));
    assert.ok(!isSearchStem("vaccin*.", 0, "vaccin"));
    assert.ok(!isSearchStem("vaccin*   then more", 0, "vaccin"));
  });
});
