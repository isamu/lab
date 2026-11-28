import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// hyphen-as-dash beside a code span: the code is masked out of the text, so the hyphen has a word on one side only.
// Every example is self-written.

const findingsOf = (source: string): readonly string[] => namedRuleRun("hyphen-as-dash", source, en).findings;

const DASH = '"-" stands in for a dash';

describe("hyphen-as-dash: a spaced hyphen next to a code span", () => {
  it("reports a hyphen between a code span and a word, either way round, in a list item too", () => {
    assert.deepEqual(findingsOf("- There is no `int` or `float` - every number is a `number`\n"), [DASH]);
    assert.deepEqual(findingsOf("The value has two fields - `x` and `y`.\n"), [DASH]);
  });

  it("leaves a hyphen between two code spans, and one with spaces on both sides of the code", () => {
    assert.deepEqual(findingsOf("For `query` - `form`; for `path` - `simple`.\n"), []);
    assert.deepEqual(findingsOf("Run `make` and wait.\n"), []);
  });
});
