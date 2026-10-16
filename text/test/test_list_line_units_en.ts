import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { listLineBreaks, startsWithListMarker } from "../packages/lang-en/src/list-line.ts";

const textsOf = (source: string): string[] => en.segment(source).sentences.map((sentence) => sentence.text);
const itemFlagsOf = (source: string): boolean[] => en.segment(source).sentences.map((sentence) => sentence.listItem === true);

const rulesOf = (file: string, source: string, genre: string, rules: readonly string[]): string[] =>
  runRules(buildDocument(file, source, en), loadRules("en"), {}, true, genre)
    .findings.filter((finding) => rules.includes(finding.rule))
    .map((finding) => `${finding.rule}:${String(finding.line)}`);

describe("startsWithListMarker (en): a list marker at the start of a line", () => {
  it("reads bracketed, numbered, lettered and bulleted items", () => {
    [
      "(a) the goods",
      "(1) In this section",
      "(1A) The duty",
      "(iv) a notice",
      "(B) the tenant",
      "1. Purpose",
      "  2) Scope",
      "3.2. Header",
      "a. first",
      "b) second",
      "- apples",
      "• pears",
      "* Ann Lee",
    ].forEach((line) => assert.equal(startsWithListMarker(line), true, line));
  });

  it("does not read initials, abbreviations, years or words as markers", () => {
    [
      "J. Smith signed it.",
      "U.S. law applies.",
      "e.g. a notice",
      "2026. The year ended.",
      "Section 2",
      "-- signature",
      "*emphasis* here",
      "A. Jones",
      "(this one) too",
    ].forEach((line) => assert.equal(startsWithListMarker(line), false, line));
  });
});

describe("listLineBreaks (en): where a line break before an item ends a sentence", () => {
  it("cuts after a lead-in ending in a dash, a colon or a semicolon", () => {
    assert.equal(listLineBreaks("The tenant must—\n(a) pay the rent, and\n(b) keep the flat clean.").length, 2);
    assert.equal(listLineBreaks("The notice must state:\n(a) the date;\n(b) the amount; and\n(c) the reason.").length, 3);
  });

  it("cuts between items with the same bullet or the next number, and before a bracketed item opening with a capital", () => {
    assert.equal(listLineBreaks("- apples\n- pears").length, 1);
    assert.equal(listLineBreaks("1. apples\n2. pears\n3. plums").length, 2);
    assert.equal(listLineBreaks("(a) one\n(b) two").length, 1);
    assert.equal(listLineBreaks("Section 4 Notices\n(1) A notice must be in writing.").length, 1);
  });

  it("keeps a hard-wrapped sentence whole where the next line starts like a marker", () => {
    assert.deepEqual(listLineBreaks("The fee is payable as set forth in Section 2\n(a) of this Agreement."), []);
    assert.deepEqual(listLineBreaks("This replaces the specification in RFC\n793.  It does not repeat it."), []);
    assert.deepEqual(listLineBreaks("The fee is payable under clauses\n(a) and (b) above."), []);
    assert.deepEqual(listLineBreaks("(a) the fee set forth in Section 2\n(a) of this Agreement"), []);
    assert.deepEqual(listLineBreaks("- the fee\n* the deposit"), []);
  });

  it("does not cut before initials or an abbreviation at the start of a line", () => {
    assert.deepEqual(listLineBreaks("The agreement was signed by\nJ. Smith for the seller."), []);
    assert.deepEqual(listLineBreaks("It was approved by the\nU.S. Department of Labor."), []);
  });

  it("does not cut after an item into a line with no marker", () => {
    assert.deepEqual(listLineBreaks("- The model known as\nCLIPER is used as a baseline."), []);
  });
});

describe("English sentence split: one item per line", () => {
  it("splits a lead-in and its items into one sentence each", () => {
    assert.deepEqual(textsOf("The tenant must—\n(a) pay the rent on time,\n(b) keep the flat clean, and\n(c) return the keys."), [
      "The tenant must—",
      "(a) pay the rent on time,",
      "(b) keep the flat clean, and",
      "(c) return the keys.",
    ]);
  });

  it("splits plain-text bullets with no full stop", () => {
    assert.deepEqual(textsOf("Bring the following:\n- a passport\n- two photographs\n- the fee"), [
      "Bring the following:",
      "- a passport",
      "- two photographs",
      "- the fee",
    ]);
  });

  it("keeps a wrapped sentence whole", () => {
    assert.deepEqual(textsOf("The fee is payable as set forth in Section 2\n(a) of this Agreement."), [
      "The fee is payable as set forth in Section 2\n(a) of this Agreement.",
    ]);
  });

  it("marks the sentences that start an item", () => {
    assert.deepEqual(itemFlagsOf("Bring the following:\n- a passport\n- the fee"), [false, true, true]);
    assert.deepEqual(itemFlagsOf("The fee is due.\nIt is paid in full."), [false, false]);
  });
});

/** A section of a self-written statute: numbered subsections and lettered items, no blank line between them. */
const SECTION = [
  "Section 4 Notices to tenants",
  "(1) A landlord who intends to increase the rent of a dwelling let under this Part must give the tenant a notice in writing which states—",
  "(a) the amount of the rent payable before the increase and the amount payable after it, together with the date on which the increase takes effect,",
  "(b) the reasons for the increase, including any works carried out to the dwelling during the period of twelve months before the notice is given, and",
  "(c) the address at which the tenant may send an objection to the increase, together with the period within which an objection must be sent.",
  "(2) A notice under subsection (1) must be given not less than two months before the date on which the increase takes effect.",
  "(3) A notice which does not comply with this section has no effect.",
  "(4) The tenant may object to the increase by sending an objection to the address stated in the notice.",
  "(5) An objection must be in writing.",
  "(6) The landlord must reply to an objection within one month.",
  "",
].join("\n");

/** One long sentence hard-wrapped over two lines, with no marker. */
const WRAPPED = [
  "The landlord who intends to increase the rent of a dwelling let under this Part must give the tenant a notice in writing which",
  "states the amount of the rent before and after the increase, the reasons for it and the address to which an objection may be sent.",
  "",
].join("\n");

describe("sentence and paragraph length (en): items written one per line are counted one by one", () => {
  it("does not report a lead-in and its items as one long sentence or a section as one long paragraph", () => {
    assert.deepEqual(rulesOf("t.txt", SECTION, "blog/tech", ["max-sentence-length", "max-paragraph-length"]), []);
  });

  it("still reports a long sentence wrapped over lines with no marker", () => {
    assert.deepEqual(rulesOf("t.txt", WRAPPED, "blog/tech", ["max-sentence-length"]), ["max-sentence-length:1"]);
  });
});
