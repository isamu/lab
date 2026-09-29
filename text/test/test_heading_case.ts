import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { minorityCase, pageTitleOf } from "../packages/chaff/src/detectors/heading-case.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const RULES = loadRules("en");
const RULE = "title-case-consistency";

const quotesFor = (source: string): string[] =>
  runRules(buildDocument("t.md", source, en), RULES, {}, true, "business/report")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.quote);

const at = (...depths: number[]): { depth: number; index: number }[] => depths.map((depth, index) => ({ depth, index }));

describe("pageTitleOf", () => {
  it("最初の見出しが深さ 1 で、深さ 1 がほかに無ければ題名", () => {
    assert.equal(pageTitleOf(at(1, 2, 2, 3))?.index, 0);
  });

  it("見出しより前の導入部（深さ 0）は数えない", () => {
    assert.equal(pageTitleOf(at(0, 1, 2, 2))?.index, 1);
  });

  it("深さ 1 の見出しだけの文書でも、1 つなら題名", () => {
    assert.equal(pageTitleOf(at(1))?.index, 0);
  });

  it("深さ 1 が 2 つ以上あると、題名か章かを決められない", () => {
    assert.equal(pageTitleOf(at(1, 2, 1, 2)), undefined);
    assert.equal(pageTitleOf(at(1, 1, 1)), undefined);
  });

  it("最初の見出しが深さ 2 なら題名は無い。後ろにある深さ 1 は題名ではない", () => {
    assert.equal(pageTitleOf(at(2, 2, 2)), undefined);
    assert.equal(pageTitleOf(at(2, 1, 2)), undefined);
    assert.equal(pageTitleOf(at(0, 6, 1, 2)), undefined);
  });

  it("見出しが無ければ題名は無い", () => {
    assert.equal(pageTitleOf([]), undefined);
    assert.equal(pageTitleOf(at(0)), undefined);
  });
});

describe("title-case-consistency と題名", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: Title Case の題名と sentence case の節（CDC）", () => {
    const source = [
      "# Carbon Monoxide Poisoning Basics",
      "## What it is\n\nText.",
      "## Risk factors\n\nText.",
      "## Reducing risk\n\nText.",
      "### Portable generators\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("valid: sentence case の題名と Title Case の節", () => {
    const source = ["# How we rebuilt the booking sheet", "## Why It Broke\n\nText.", "## What We Changed\n\nText.", "## Next Steps\n\nText."].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("valid: 題名の前に導入部があっても題名", () => {
    const source = [
      "A photo caption.",
      "# Carbon Monoxide Poisoning Basics",
      "## What it is\n\nText.",
      "## Risk factors\n\nText.",
      "## Reducing risk\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("invalid: 題名の下でも、節の見出しどうしの混在は指摘する", () => {
    const source = ["# Carbon Monoxide Poisoning Basics", "## What it is\n\nText.", "## Risk factors\n\nText.", "## Reducing Household Risk\n\nText."].join(
      "\n\n",
    );
    assert.deepEqual(quotesFor(source), ["Reducing Household Risk"]);
  });

  it("invalid: 深さ 1 が複数あれば、最初のものも節として比べる", () => {
    const source = [
      "# New Online at the Library",
      "## New legal gazettes\n\nText.",
      "# Now online: two new grants\n\nText.",
      "## Silent film scores\n\nText.",
      "## New web archives\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), ["New Online at the Library"]);
  });

  it("invalid: 最初の見出しが深さ 2 なら、それも節として比べる", () => {
    const source = ["## Carbon Monoxide Basics\n\nText.", "## What it is\n\nText.", "## Risk factors\n\nText.", "## Reducing risk\n\nText."].join("\n\n");
    assert.deepEqual(quotesFor(source), ["Carbon Monoxide Basics"]);
  });

  it("invalid: 節が同数に割れたら、題名と違うほうを指摘する", () => {
    const source = ["# Osaka sales trip", "## How the visits run\n\nText.", "## Expected Costs\n\nText."].join("\n\n");
    assert.deepEqual(quotesFor(source), ["Expected Costs"]);
    const titled = ["# Osaka Sales Trip", "## How the visits run\n\nText.", "## Expected Costs\n\nText."].join("\n\n");
    assert.deepEqual(quotesFor(titled), ["How the visits run"]);
  });

  it("valid: 少数派が上限より多ければ、流儀が 2 つあると見て指摘しない", () => {
    const sections = ["Why It Broke", "What We Changed", "Next Steps", "how the visits run", "Expected costs", "Common questions", "Getting started"];
    const source = ["# Osaka sales trip", ...sections.map((heading) => `## ${heading}\n\nText.`)].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("valid: 節が同数に割れて題名が無い・判定できないなら、少数派は無い", () => {
    assert.deepEqual(quotesFor(["## How the visits run\n\nText.", "## Expected Costs\n\nText."].join("\n\n")), []);
    assert.deepEqual(quotesFor(["# Osaka", "## How the visits run\n\nText.", "## Expected Costs\n\nText."].join("\n\n")), []);
  });
});

describe("minorityCase", () => {
  it("少ないほうの流儀。題名の流儀は関係しない", () => {
    assert.equal(minorityCase({ titleCase: 1, sentenceCase: 3 }, undefined), true);
    assert.equal(minorityCase({ titleCase: 1, sentenceCase: 3 }, true), true);
    assert.equal(minorityCase({ titleCase: 5, sentenceCase: 2 }, false), false);
  });

  it("片方しか無ければ少数派は無い", () => {
    assert.equal(minorityCase({ titleCase: 0, sentenceCase: 4 }, true), undefined);
    assert.equal(minorityCase({ titleCase: 4, sentenceCase: 0 }, false), undefined);
    assert.equal(minorityCase({ titleCase: 0, sentenceCase: 0 }, true), undefined);
  });

  it("同数なら題名と違う流儀が少数派。題名が無ければ決めない", () => {
    assert.equal(minorityCase({ titleCase: 2, sentenceCase: 2 }, true), false);
    assert.equal(minorityCase({ titleCase: 2, sentenceCase: 2 }, false), true);
    assert.equal(minorityCase({ titleCase: 1, sentenceCase: 1 }, undefined), undefined);
  });
});
