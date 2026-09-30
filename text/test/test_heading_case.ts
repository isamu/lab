import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isTitleCase, minorityCase, pageTitleOf } from "../packages/chaff/src/detectors/heading-case.ts";
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

describe("isTitleCase と略語", () => {
  it("大文字だけの語（略語）は Title Case の証拠にしない。ほかに 1 語しか無ければ判定できない", () => {
    assert.equal(isTitleCase("Proposed FCPs"), undefined);
    assert.equal(isTitleCase("Opening a PR"), undefined);
    assert.equal(isTitleCase("Active FCPs"), undefined);
  });

  it("略語を除いた語で判定する", () => {
    assert.equal(isTitleCase("RFCs waiting to be merged"), false);
    assert.equal(isTitleCase("Nominated RFCs, PRs and issues NOT discussed this meeting"), false);
    assert.equal(isTitleCase("Using the API client"), false);
    assert.equal(isTitleCase("Using the API Client"), true);
    assert.equal(isTitleCase("Basic Mechanics"), true);
  });
});

describe("isTitleCase と語の中のアポストロフィ", () => {
  it("字に挟まれた ’ と ʼ は ' と同じく語の中の字。’s は小文字の語にならない（Fed’s）", () => {
    assert.equal(isTitleCase("Monetary Policy and the Fed’s Framework Review"), true);
    assert.equal(isTitleCase("Monetary Policy and the Fedʼs Framework Review"), true);
    assert.equal(isTitleCase("Monetary Policy and the Fed's Framework Review"), true);
    assert.equal(isTitleCase("The Board’s Review"), true);
  });

  it("’ のあとの小文字の語は、語の中の字でなくても小文字として数える", () => {
    assert.equal(isTitleCase("The Fed’s framework review"), false);
    assert.equal(isTitleCase("What the ‘Board’ reviews"), false);
    assert.equal(isTitleCase("Policy Under ‘Review’ now"), false);
  });

  it("閉じる引用符の ’ は語の中の字にしない", () => {
    assert.equal(isTitleCase("The ‘Board’ Reviews Policy"), true);
  });
});

describe("title-case-consistency と語の中のアポストロフィ", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: ’s を含む Title Case の題名と Title Case の節（Fed speech）", () => {
    const source = [
      "## Speech",
      "### Monetary Policy and the Fed’s Framework Review",
      "#### Current Economic Conditions and Near-Term Outlook\n\nText.",
      "#### Evolution of Monetary Policy Framework\n\nText.",
      "#### Elements of the Revised Consensus Statement\n\nText.",
      "#### Conclusion\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("invalid: ’s を含む sentence case の見出しは、Title Case の中で指摘する", () => {
    const source = [
      "## Current Economic Conditions\n\nText.",
      "## Evolution of the Framework\n\nText.",
      "## Elements of the Statement\n\nText.",
      "## The Board’s next review\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), ["The Board’s next review"]);
  });
});

describe("title-case-consistency と略語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: 略語しか大文字の語が無い見出しは、sentence case の中で指摘しない（rust-lang minutes, 18F code review）", () => {
    const source = [
      "# T-lang meeting agenda",
      "## Meeting roles\n\nText.",
      "## Scheduled meetings\n\nText.",
      "## Proposed FCPs\n\nText.",
      "## Active FCPs\n\nText.",
      "## Action item review\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
    const review = ["## Why reviews?\n\nText.", "## For code submitters\n\nText.", "## Who merges\n\nText.", "## Opening a PR\n\nText."].join("\n\n");
    assert.deepEqual(quotesFor(review), []);
  });

  it("invalid: 略語のほかにも大文字の語があれば Title Case（18F one-on-ones）", () => {
    const source = [
      "## Basic Mechanics\n\nText.",
      "## Taking notes\n\nText.",
      "## Alternate strategies\n\nText.",
      "## What to cover during the future part\n\nText.",
      "## Using the API Client\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), ["Basic Mechanics", "Using the API Client"]);
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

describe("isTitleCase と vs・v.・via", () => {
  it("Title Case でも小文字のまま書く語（Chicago・APA・AP・MLA のどれでも小文字）は、大文字化の判定から外す", () => {
    assert.equal(isTitleCase("Development Environment vs MulmoChat"), true);
    assert.equal(isTitleCase("Method A vs. Method B"), true);
    assert.equal(isTitleCase("Storm Surge v. Storm Tide"), true);
    assert.equal(isTitleCase("Configuring Each Service via Config"), true);
  });

  it("大文字で書いた Vs・Via も Title Case の語", () => {
    assert.equal(isTitleCase("Storm Surge Vs. Storm Tide"), true);
    assert.equal(isTitleCase("Switch Via Environment Variable"), true);
  });

  it("ほかの語が小文字なら sentence case のまま", () => {
    assert.equal(isTitleCase("Switch via environment variable"), false);
    assert.equal(isTitleCase("Storm surge vs storm tide"), false);
    assert.equal(isTitleCase("Storm surge v. storm tide"), false);
  });
});

describe("title-case-consistency と vs", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("valid: vs を挟んだ Title Case の見出しは、Title Case の文書の中で指摘しない（MulmoChat の記事）", () => {
    const source = [
      "## Plugin Structure\n\nText.",
      "## Sample Plugin Code\n\nText.",
      "## Development Environment vs MulmoChat\n\nText.",
      "## Publishing the Package\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), []);
  });

  it("invalid: sentence case の文書の中の、vs を挟んだ Title Case の見出しは指摘する", () => {
    const source = [
      "## Plugin structure\n\nText.",
      "## Sample plugin code\n\nText.",
      "## Development Environment vs MulmoChat\n\nText.",
      "## Publishing the package\n\nText.",
    ].join("\n\n");
    assert.deepEqual(quotesFor(source), ["Development Environment vs MulmoChat"]);
  });
});
