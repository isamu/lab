import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// dangling-reference and an address the document cites to another document once ("Section 504 of the Rehabilitation
// Act"): written bare elsewhere ("In Section 504, …"), it is still that document's. A bare address the document never
// cites elsewhere is still reported. Every text is self-written.

const RULE = "dangling-reference";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en, "a.md", "docs/manual").findings;

const GUIDE = [
  "Section 1. Scope",
  "",
  "This guide covers requests under Section 504 of the Rehabilitation Act.",
  "",
  "Section 2. Requests",
  "",
  "In Section 504, a request is a change to the job. Section 504/501 complaints go to the office.",
  "",
].join("\n");

describe("dangling-reference: an address cited to another document once", () => {
  it("the bare address is that document's", () => {
    assert.deepEqual(findingsOf(GUIDE), []);
  });

  it("a bare address never cited elsewhere is still reported", () => {
    assert.equal(findingsOf(`${GUIDE}See Section 7 for the forms.\n`).length, 1);
  });

  it("without the named form, the bare address is reported", () => {
    assert.equal(findingsOf(GUIDE.replace(" of the Rehabilitation Act", "")).length > 0, true);
  });
});
