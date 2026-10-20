import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A US statute sets recurring deadlines by a day of each calendar year ("on or before March 1 of each calendar year") or of
// a year it names in words ("no later than March 1 of the year in which each such report is issued"). Neither has a
// year to write. Sentences from 5 U.S.C. 552 (public domain, chaff-corpus #54); the others are self-written.

const DATED = "# Reports\n\nThis subsection was amended on October 2, 1996, and again on December 31, 2007.\n\n";

const findings = (sentence: string): readonly string[] => namedRuleRun("date-without-year", `${DATED}${sentence}\n`, en).findings;

describe("date-without-year: a day of each calendar year, or of a year named in words", () => {
  [
    "The Attorney General shall submit a report on or before March 1 of each calendar year.",
    "The Comptroller shall submit an annual report on or before April 1 of each calendar year which shall include figures.",
    "Each agency shall report no later than March 1 of the year in which each such report is issued.",
    "The office shall report by June 30 of every calendar year.",
    "The plan is due by September 30 of each fiscal year.",
    "The audit closes on January 31 of the year following the report.",
  ].forEach((sentence) => {
    it(`valid: ${sentence}`, () => assert.deepEqual(findings(sentence), []));
  });

  [
    ["a yearless date with no year in words", "The Attorney General shall submit a report on or before March 1."],
    ["a calendar year named far after the date", "The report is due on March 1, and covers the figures for each calendar year."],
  ].forEach(([form, sentence]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(findings(String(sentence)).length, 1));
  });
});
