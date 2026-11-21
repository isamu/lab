import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

// numbering-gap: a rule book or a contract numbers its provisions as Rule N, Clause N or Regulation N, as a statute does
// with Section N (provision-heading-word). Example text is self-written.

const gaps = (source: string): string[] =>
  runRules(buildDocument("c.md", source, en), loadRules(en.id), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "numbering-gap")
    .map((finding) => `${String(finding.values["previous"])} -> ${String(finding.values["label"])}`);

const rules = (word: string, numbers: readonly string[]): string =>
  [
    "# Kitchen rules",
    "",
    ...numbers.flatMap((n, index) => [`## ${word} ${n} (Title ${String(index + 1)})`, "", "The fridge is cleared every Friday.", ""]),
  ].join("\n");

describe("numbering-gap over Rule, Clause and Regulation headings", () => {
  it("a skipped Rule, Clause or Regulation number is reported, as a Section is", () => {
    assert.deepEqual(gaps(rules("Rule", ["1", "2", "4"])), ["Rule 2 -> Rule 4"]);
    assert.deepEqual(gaps(rules("Clause", ["1", "2", "4"])), ["Clause 2 -> Clause 4"]);
    assert.deepEqual(gaps(rules("REGULATION", ["1", "2", "4"])), ["Regulation 2 -> Regulation 4"]);
    assert.deepEqual(gaps(rules("Section", ["1", "2", "4"])), ["Section 2 -> Section 4"]);
  });

  it("numbers in order, and a sentence that cites a rule, are not", () => {
    assert.deepEqual(gaps(rules("Rule", ["1", "2", "3"])), []);
    const cited = ["# Ruling", "", "Rule 17(c) provides that a subpoena may issue.", "", "Rule 19 provides otherwise.", ""].join("\n");
    assert.deepEqual(gaps(cited), []);
  });
});
