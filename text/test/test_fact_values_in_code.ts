import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A value written inside a fenced code block is part of the example, not the document's own value. Examples are self-written.

const summaryFindings = (source: string): readonly string[] => namedRuleRun("summary-fact-mismatch", source, en, "a.md", "technical/readme").findings;

describe("summary-fact-mismatch: values in code blocks", () => {
  it("a compiler directive in one example is not compared with the directive in another", () => {
    const source = [
      "# Narrowing",
      "",
      "The call fails when the padding is a string.",
      "",
      "```ts",
      "// @errors: 2345",
      "const a = pad(1);",
      "```",
      "",
      "## Details",
      "",
      "The second example fails too.",
      "",
      "```ts",
      "// @errors: 2322",
      'const b: number = "x";',
      "```",
      "",
    ].join("\n");
    assert.deepEqual(summaryFindings(source), []);
  });

  it("the same label and values in prose are still compared", () => {
    const source = ["# Notice", "", "Fee: $40", "", "## Details", "", "Fee: $50", ""].join("\n");
    assert.deepEqual(summaryFindings(source), ['The summary gives "Fee" as $40, but the body gives $50']);
  });
});
