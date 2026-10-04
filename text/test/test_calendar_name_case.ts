import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { lowercaseNamesIn } from "../packages/chaff/src/detectors/lowercase-name.ts";

// Weekday or month in lower case (calendar-name-case). Every example is self-written.

const RULE = "calendar-name-case";
const NAMES = ["Monday", "Friday", "Sunday", "June", "December"];

const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;
const writtenOf = (text: string): readonly string[] => lowercaseNamesIn(text, NAMES).map((name) => name.written);

describe("calendar-name-case: weekday or month in lower case", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
    await ja.prepare?.({ pos: true });
  });

  it("reports a weekday or month written in lower case", () => {
    assert.deepEqual(findingsOf("The review is on monday, and the release follows in june."), ['Write "monday" as "Monday"', 'Write "june" as "June"']);
    assert.deepEqual(writtenOf("(friday) and “december”. We meet sunday: noon."), ["friday", "december", "sunday"]);
  });

  it("leaves capitals, other words, paths, tags, addresses and code alone", () => {
    assert.deepEqual(findingsOf("The review is on Monday. We may march in August."), []);
    assert.deepEqual(writtenOf("See monday.md, june:2, /june/, #friday, @sunday, key=monday and sunday_2."), []);
    assert.deepEqual(writtenOf("MONDAY Mondays mondays"), []);
    assert.deepEqual(writtenOf('Set day: monday, day = friday, {"day": "sunday"}, \'june\' and 0 0 * * monday.'), []);
    assert.deepEqual(findingsOf("Set `day: monday` in the file."), []);
    assert.deepEqual(writtenOf(""), []);
  });

  it("does not run on Japanese documents", () => {
    assert.deepEqual(findingsOf("会議は monday です。", ja), []);
  });

  it("gives the offset of the word", () => {
    assert.deepEqual(
      lowercaseNamesIn("on monday", NAMES).map((name) => [name.offset, name.usual]),
      [[3, "Monday"]],
    );
  });
});
