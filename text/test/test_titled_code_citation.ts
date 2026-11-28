import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { titledCodeSpans } from "../packages/chaff/src/detectors/titled-code-citation.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A code cited by its title number and a division (21 CFR subpart J) is a citation, as 44 USC 3502 is. The CFR sentences
// are from Federal Register documents (US federal works, public domain); the others are self-written.

const SERIES = (en.lexicons["citation-series"] ?? []).map((entry) => entry.pattern);

const covered = (text: string): string[] => titledCodeSpans(text, SERIES).map((span) => text.slice(span.start, span.end));

describe("titledCodeSpans", () => {
  const cited: readonly (readonly [string, string, readonly string[]])[] = [
    ["a subpart by letter", "HHS is conducting this request for information under 21 CFR subpart J.", ["CFR"]],
    ["a chapter by Roman numeral", "The rules in 21 CFR chapter I, subchapter H apply.", ["CFR"]],
    ["a capitalised division", "See 42 CFR Subpart B for the procedure.", ["CFR"]],
    ["a part by number", "Records kept under 21 CFR part 11 are electronic.", ["CFR"]],
    ["another series of the lexicon", "as set out in 15 USCA Appendix A", ["USCA"]],
  ];
  cited.forEach(([name, text, expected]) => {
    it(`covered: ${name}`, () => assert.deepEqual(covered(text), expected));
  });

  const notCited: readonly (readonly [string, string])[] = [
    ["no division after the title number", "The 2 CFR export was generated today."],
    ["a word that is not a designator follows", "The 2 CFR export controls apply."],
    ["no title number", "Read the CFR subpart J first."],
    ["a number that is part of a larger one", "Report 1.21 CFR subpart J later."],
    ["a capitalised word, not a letter", "Five EU Member States joined; 5 EU Member States agreed."],
  ];
  notCited.forEach(([name, text]) => {
    it(`not covered: ${name}`, () => assert.deepEqual(covered(text), []));
  });

  it("an empty lexicon covers nothing", () => assert.deepEqual(titledCodeSpans("21 CFR subpart J", []), []));
});

describe("undefined-acronym and a code cited by title", () => {
  it("valid: CFR cited by title and subpart is not reported, the unexplained RIN still is", () => {
    const source = "HHS is conducting this request for information under 21 CFR subpart J.\n\nGive the RIN of each action.";
    assert.deepEqual(reportedAcronyms(en, source), ["HHS", "RIN"]);
  });

  it("invalid: the CFR named as a whole is still reported", () => {
    assert.deepEqual(reportedAcronyms(en, "The 2 CFR export controls apply under the CFR title."), ["CFR"]);
  });
});
