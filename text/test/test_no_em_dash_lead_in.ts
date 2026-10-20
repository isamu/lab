import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { introducesList } from "../packages/chaff/src/detectors/lead-in-dash.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A statute introduces each enumeration with an em dash ending its paragraph ("For the purpose of this subchapter—" over
// "(1) "agency" means…"). Those dashes are the form of the list, as a colon would be, and no-em-dash counted them as a
// heavy hand with dashes. Lines from 5 U.S.C. 551 (public domain, chaff-corpus); the rest is self-written.

const BULK = "We shipped the release and reported the numbers to the team. ".repeat(40);
const fires = (source: string): boolean => firedRules(en, source, "legal/statute").includes("no-em-dash");

const ENUMERATION = [
  "For the purpose of this subchapter—",
  '(1) "agency" means each authority of the Government of the United States, but does not include—',
  "(A) the Congress;",
  "(B) the courts of the United States;",
  '(2) "person" includes an individual, partnership, corporation, association, or public or private organization;',
].join("\n\n");

const dashAt = (source: string): number => source.indexOf("—");

describe("introducesList", () => {
  it("a dash ending its paragraph above a list item introduces the list", () => {
    ["(1) agency", '"(1) agency', "1. Agency", "a) Agency", "- Agency", "• Agency", "  (A) the Congress"].forEach((item) => {
      const source = `For the purpose of this subchapter—\n\n${item}`;
      assert.equal(introducesList(source, dashAt(source)), true, item);
    });
    const spaced = "shall include— \n\n\n(A) the Congress;";
    assert.equal(introducesList(spaced, dashAt(spaced)), true);
  });

  it("a dash inside its line, above prose, or at the end of the text does not", () => {
    ["The plan—as agreed—ships today.\n\n(1) Next.", "The plan ships today—\n\nThen we rest.", "The plan ships today—", "The plan—\n\nThe. end"].forEach(
      (source) => assert.equal(introducesList(source, dashAt(source)), false, source),
    );
  });
});

describe("no-em-dash: a dash that introduces a list", () => {
  it("valid: enumerations introduced with a dash are not counted", () => {
    assert.equal(fires(`### §551. Definitions\n\n${Array.from({ length: 12 }, () => ENUMERATION).join("\n\n")}\n\n${BULK}`), false);
  });

  it("invalid: as many dashes inside sentences are still counted", () => {
    const prose = "The agency—as the Congress intended—reviews each rule.\n\n".repeat(12);
    assert.equal(fires(`### §551. Definitions\n\n${prose}${BULK}`), true);
  });
});
