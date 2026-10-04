import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { tightCommasIn } from "../packages/chaff/src/detectors/missing-space-after-comma.ts";

// No space after a comma between words (missing-space-after-comma). Every example is self-written.

const RULE = "missing-space-after-comma";
const LONG_LINE_BUDGET_MS = 2000;

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en).findings;
const writtenIn = (text: string): readonly string[] => tightCommasIn(text).map((comma) => comma.written);

describe("missing-space-after-comma: no space after a comma between words", () => {
  it("reports a comma joining two words with no space after it", () => {
    assert.deepEqual(findingsOf("Send the form to the office address,and keep a copy."), ['No space after the comma in "address,and"']);
    assert.deepEqual(writtenIn("If the box is damaged,call us first."), ["damaged,call"]);
    assert.deepEqual(writtenIn("Ask your doctor if pregnant or breast-feeding,ask first."), ["feeding,ask"]);
    assert.deepEqual(writtenIn("We met in Paris,and then we left."), ["Paris,and"]);
    assert.deepEqual(writtenIn("(before,after)"), ["before,after"]);
    assert.deepEqual(writtenIn("Check the company's,and the partner's records."), ["company's,and"]);
  });

  it("does not report values, numbers, addresses, paths, settings or abbreviations", () => {
    assert.deepEqual(writtenIn("Pick one of blue,black,brown for the case."), []);
    assert.deepEqual(writtenIn("It costs 3,000 yen, or abc,123 in the code."), []);
    assert.deepEqual(writtenIn("Set color=blue,black and use path/file,name or user@host,name."), []);
    assert.deepEqual(writtenIn("Use file_name,size and key:value,other here."), []);
    assert.deepEqual(writtenIn("Bring tools, e.g.,hammers and nails."), []);
    assert.deepEqual(writtenIn('Write "true,false" or \'yes,maybe\' as the value. Set it to ("true,false").'), []);
  });

  it("does not report short words, a capital after the comma, or a spaced comma", () => {
    assert.deepEqual(writtenIn("Codes such as en,ja and id,x are fine."), []);
    assert.deepEqual(writtenIn("Smith,John signed it."), []);
    assert.deepEqual(writtenIn("The address, and the rest."), []);
    assert.deepEqual(writtenIn(""), []);
  });

  it("does not read code, URLs, tables or front matter", () => {
    assert.deepEqual(findingsOf("---\ntags: foo,bar\n---\n\n| a | b |\n|---|---|\n| red,green | x |\n\nSee `list,item` and https://example.com/a,b here."), []);
  });

  it("is off for literature", () => {
    const source = "Send the form to the office address,and keep a copy.\n";
    assert.equal(firedRules(en, source, "business/report").includes(RULE), true);
    assert.equal(firedRules(en, source, "literature/poetry").includes(RULE), false);
  });

  it("reads a long line of values in one pass", () => {
    const values = "alpha,bravo,".repeat(50_000);
    const started = performance.now();
    assert.deepEqual(writtenIn(`${values} and ${"word ".repeat(50_000)}`), []);
    assert.ok(performance.now() - started < LONG_LINE_BUDGET_MS);
  });

  it("places the finding at the comma", () => {
    const text = "the address,and more";
    assert.deepEqual(
      tightCommasIn(text).map((comma) => comma.offset),
      [text.indexOf(",")],
    );
  });
});
