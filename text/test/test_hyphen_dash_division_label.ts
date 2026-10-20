import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { divisionLabelPattern, isDivisionSeparator } from "../packages/chaff/src/detectors/division-label-separator.ts";

// hyphen-as-dash and a heading that sets a numbered division's label apart from its title with a spaced hyphen
// ("PART I - THE AGENCIES GENERALLY", the govinfo header of a US Code section). A spaced hyphen in a sentence is still
// reported, also on a line that starts with a division word. Header lines from 5 U.S.C. 551 (public domain,
// chaff-corpus #54); the others are self-written.

const RULE = "hyphen-as-dash";
const PATTERN = divisionLabelPattern((en.lexicons["numbered-division"] ?? []).map((entry) => entry.pattern));
const at = (line: string): boolean => isDivisionSeparator(line, line.indexOf(" - "), PATTERN);
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en, "s.md", "legal/statute").findings;

describe("isDivisionSeparator", () => {
  ["PART I - THE AGENCIES GENERALLY", "SUBCHAPTER II - ADMINISTRATIVE PROCEDURE", "Chapter 12A - Notices", "## Part iv - Fees"].forEach((line) => {
    it(`valid: ${line}`, () => assert.equal(at(line), true));
  });

  [
    ["a sentence before the hyphen", "Part of the plan is late - very late"],
    ["a word that is not a division", "Group II - members"],
    ["no number", "PART - THE AGENCIES"],
    ["text after the number", "Part II of the Act - see below"],
    ["a sentence after the hyphen", "Table 3 - shows the totals"],
    ["a lower-case word after the hyphen", "Part I - and then the rest"],
    ["a title that ends a sentence", "Figure 2 - Totals are shown below."],
  ].forEach(([form, line]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(at(String(line)), false));
  });

  it("abnormal input: no divisions, an offset out of the text, empty text", () => {
    assert.equal(isDivisionSeparator("PART I - THE AGENCIES", 6, divisionLabelPattern([])), false);
    assert.equal(isDivisionSeparator("PART I - THE AGENCIES", -1, PATTERN), false);
    assert.equal(isDivisionSeparator("PART I", 99, PATTERN), false);
    assert.equal(isDivisionSeparator("", 0, PATTERN), false);
  });
});

describe("hyphen-as-dash and a division's heading", () => {
  const HEADER = ["5 U.S.C.", "United States Code, 2023 Edition", "PART I - THE AGENCIES GENERALLY", "SUBCHAPTER II - ADMINISTRATIVE PROCEDURE", ""];

  it("valid: the separator of a division's heading is not reported", () => {
    assert.deepEqual(findingsOf([...HEADER, "Each agency shall publish its rules."].join("\n")), []);
  });

  it("invalid: a spaced hyphen in a sentence beside the heading is still reported", () => {
    assert.equal(findingsOf([...HEADER, "Each agency shall publish its rules - all of them."].join("\n")).length, 1);
  });
});
