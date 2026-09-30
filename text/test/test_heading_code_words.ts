import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isTitleCase } from "../packages/chaff/src/detectors/heading-case.ts";
import { withoutCodeWords } from "../packages/chaff/src/detectors/heading-code-words.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// A code word keeps its own case in either style, so it says nothing about whether a heading is in Title Case.

describe("withoutCodeWords", () => {
  const cases: readonly (readonly [string, string])[] = [
    ["Using useEffect in components", "Using in components"],
    ["The --force flag", "The flag"],
    ["Editing config.yaml", "Editing"],
    ["Reading `Array.from` output", "Reading output"],
    ["Setting `max retries` safely", "Setting safely"],
    ["Using ``max ` retries`` Safely", "Using Safely"],
    ["Two `a` and `b` spans", "Two and spans"],
    ["An unclosed ` tick", "An unclosed ` tick"],
    ["The snake_case names", "The names"],
    ["Calling init() twice", "Calling twice"],
    ["Files under src/lib", "Files under"],
    ["The $HOME variable", "The variable"],
  ];
  cases.forEach(([heading, left]) => {
    it(`${heading} → ${left}`, () => assert.equal(withoutCodeWords(heading), left));
  });

  const prose = ["Getting Started", "What's new in (this) release?", "Step 1: Install", "Built-in rules", "Q&A with the team", "GitHub and JavaScript"];
  prose.forEach((heading) => {
    it(`keeps every word of ${JSON.stringify(heading)}`, () => assert.equal(withoutCodeWords(heading), heading));
  });
});

describe("isTitleCase with code words", () => {
  it("a code word is not a lower-case word", () => {
    assert.equal(isTitleCase("Using useEffect With Care"), true);
    assert.equal(isTitleCase("The --force Option Explained"), true);
    assert.equal(isTitleCase("Editing config.yaml Files"), true);
  });

  it("a code word is not a capitalised word either", () => {
    assert.equal(isTitleCase("Using `Setup` in tests"), false);
    assert.equal(isTitleCase("Reading the Config.Loader output"), false);
  });

  it("a heading left with one word is undecided", () => {
    assert.equal(isTitleCase("Using useEffect"), undefined);
  });
});

describe("title-case-consistency with code words", () => {
  const RULES = loadRules("en");
  const fired = (source: string): number =>
    runRules(buildDocument("t.md", source, en), RULES, {}, true, "business/report").findings.filter((finding) => finding.rule === "title-case-consistency")
      .length;
  const body = "Some text sits here.";

  it("Title Case headings with code words in them are consistent", () => {
    const source = [
      "# Guide",
      "",
      "## Using useEffect With Care",
      "",
      body,
      "",
      "## The --force Option",
      "",
      body,
      "",
      "## Editing config.yaml Files",
      "",
      body,
      "",
      "## Getting Started Quickly",
      "",
      body,
    ].join("\n");
    assert.equal(fired(source), 0);
  });

  it("a sentence-case heading among Title Case ones is still reported", () => {
    const source = [
      "# Guide",
      "",
      "## Using useEffect With Care",
      "",
      body,
      "",
      "## The --force Option",
      "",
      body,
      "",
      "## Getting Started Quickly",
      "",
      body,
      "",
      "## Editing the settings file",
      "",
      body,
    ].join("\n");
    assert.equal(fired(source), 1);
  });
});
