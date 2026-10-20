import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isTypewritten } from "../packages/chaff/src/detectors/typewritten.ts";

// hyphen-as-dash and a typewritten document: plain text that sets no typographic mark types every dash as a hyphen
// ("Fetch - Living Standard"), the way a plain-text standard does. Markdown, or plain text that sets a dash or a curly
// quote elsewhere, is still read. Every text is self-written.

const RULE = "hyphen-as-dash";
const findingsOf = (source: string, path: string): readonly string[] => namedRuleRun(RULE, source, en, path, "technical/spec").findings;

const SPACED = '   [NOTES]    Example Group, "Notes - Living Standard".\n\n   The list grew late - very late.\n';

describe("isTypewritten", () => {
  it("plain text with no typographic mark", () => {
    assert.equal(isTypewritten(SPACED, false), true);
    assert.equal(isTypewritten("", false), true);
  });

  it("not Markdown, and not plain text that sets a dash, a curly quote or an ellipsis", () => {
    assert.equal(isTypewritten(SPACED, true), false);
    assert.equal(isTypewritten(`${SPACED}Pages 10–12.`, false), false);
    assert.equal(isTypewritten(`${SPACED}The “notes”.`, false), false);
    assert.equal(isTypewritten(`${SPACED}And so…`, false), false);
  });
});

describe("hyphen-as-dash: a typewritten document", () => {
  it("a spaced hyphen in typewritten plain text is its typed dash", () => {
    assert.deepEqual(findingsOf(SPACED, "a.txt"), []);
  });

  it("the same text as Markdown, or with a curly quote, is still read", () => {
    assert.equal(findingsOf(SPACED, "a.md").length, 2);
    assert.equal(findingsOf(`${SPACED}\n   The “notes” stay.\n`, "a.txt").length, 2);
  });
});
