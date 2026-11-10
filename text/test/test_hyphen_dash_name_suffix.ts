import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { joinsNameSuffix } from "../packages/chaff/src/detectors/hyphen-name-suffix.ts";

// hyphen-as-dash and a spaced hyphen that joins a capitalised word onto a name ("Iraq and Syria - Khorasan,"). Examples
// are self-written.

const RULE = "hyphen-as-dash";
const at = (line: string): boolean => joinsNameSuffix(line, line.indexOf(" -"));
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en, "s.md").findings;

describe("joinsNameSuffix", () => {
  ["the Islamic State of Iraq and Syria - Khorasan, as before", "ISIS - Khorasan.", "we met in Kabul - Province)", "the branch in Iraq - Khorasan"].forEach(
    (line) => {
      it(`valid: ${line}`, () => assert.equal(at(line), true));
    },
  );

  [
    ["a lower-case word before", "the tactics - Replacing, as before"],
    ["a lower-case word after", "the Senate - replacing the bill"],
    ["more words after the capital", "the Senate - Republicans say so"],
    ["a sentence start after", "We left London - The rest stayed."],
    ["a heading's title in capitals after", "II - JUSTICIABILITY"],
  ].forEach(([form, line]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(at(String(line)), false));
  });

  it("abnormal input: an offset at the start, out of the text, empty text", () => {
    assert.equal(joinsNameSuffix(" - Khorasan,", 0), false);
    assert.equal(joinsNameSuffix("Syria - Khorasan,", 99), false);
    assert.equal(joinsNameSuffix("", 0), false);
  });
});

describe("hyphen-as-dash: a hyphen inside a name", () => {
  it("does not report the hyphen of a name, and reports a dash in the same text", () => {
    const text = "They named the Islamic State of Iraq and Syria - Khorasan, as being the threat. Influence - is a vital part. Tactics - replacing routes.\n";
    assert.deepEqual(findingsOf(text), ['"-" stands in for a dash', '"-" stands in for a dash']);
  });
});
