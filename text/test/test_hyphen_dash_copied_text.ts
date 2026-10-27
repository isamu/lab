import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isInCopiedText } from "../packages/chaff/src/detectors/hyphen-copied-text.ts";

// hyphen-as-dash and text the writer copies: a label quoted as printed, a numbered reference entry, a category name in a
// field, a log or bot line, HTML shown as text. There the hyphen is the source's separator. Every example is self-written.

const RULE = "hyphen-as-dash";
const at = (line: string): boolean => isInCopiedText(line, line.search(/ -{1,2} |--/u));
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en).findings;

describe("isInCopiedText", () => {
  [
    ["a label quoted as printed", "The notes were rated as “Unhelpful - Post needs no note” by readers."],
    ["a sign quoted as printed", "Helpful: “Card with text: Training for teams - Register today.”"],
    ["a numbered reference entry", "- [12] A. Smith (2021) My robot friend - a study of trust. Journal of Studies."],
    ["a category name in a field", "- **Expense Category:** Office Space - Monthly"],
    ["a three-word category name", "- Expense Category: Office Space - Daily Desk Pass"],
    ["a bot line", "<alert-bot> FIRING: HighErrorRate: errors are high - api-cluster - see the runbook"],
    ["a log line with a setting", "- 18:20 The servers are restarted END (FAIL) - Cookbook restart (exit_code=99)"],
    ["a log line with a dotted name", "Ran the job - Cookbook ops.servers.restart-all failed"],
    ["a bare address", "The alert fired - see https://example.org/runbook for steps"],
    ["HTML shown as text", 'See <a class="usa-link usa-link--external" href="x">the data</a> for more.'],
  ].forEach(([form, line]) => {
    it(`copied: ${form}`, () => assert.equal(at(line ?? ""), true));
  });

  [
    ["a dash in quoted prose, in lower case", "The report said “the plan is late - very late” on Monday."],
    ["a dash in a sentence", "The release is late - very late."],
    ["a field whose value is a sentence", "- Holiday pay: Yes - You receive pay for the time you were scheduled."],
    ["a field whose value runs past three words", "- Credit hours: No - Not available with this schedule"],
    ["a heading with a title", "**B. Physical Damage - Collision Damage Waiver**"],
    ["a Markdown link's address", "Follow the rules -- see the [code of conduct](https://example.org/code)."],
    ["an abbreviation with periods", "Some tools - e.g. linters - help."],
    ["a dotted name inside a link's address", "It causes bugs - some call it a [costly mistake](https://www.example.org/watch?v=abc)!"],
  ].forEach(([form, line]) => {
    it(`written: ${form}`, () => assert.equal(at(line ?? ""), false));
  });
});

describe("hyphen-as-dash: copied text", () => {
  it("a hyphen in copied text is not reported", () => {
    const source = [
      "The notes were rated as “Unhelpful - Post needs no note” by readers.",
      "",
      "- [12] A. Smith (2021) My robot friend - a study of trust. Journal of Studies.",
      "- **Expense Category:** Office Space - Monthly",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(source), []);
  });

  it("a dash in the writer's own sentence is still reported", () => {
    assert.deepEqual(findingsOf("- **Expense Category:** Office Space - Monthly\n\nThe release is late - very late.\n"), ['"-" stands in for a dash']);
  });
});
