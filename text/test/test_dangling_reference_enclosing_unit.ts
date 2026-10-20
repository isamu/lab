import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { StructureNode } from "../packages/chaff/src/plugin.ts";
import { enclosingUnitAfter } from "../packages/lang-en/src/citation.ts";
import { withinAbsentUnit } from "../packages/chaff/src/structure/unit-word.ts";

// "section 552 of this title" in a document that is one section of a code: the title is the code's, and section 552 is
// not in the document. Where the document has the unit it names ("CHAPTER 5", "PART I"), the reference is still looked
// up. Lines from 5 U.S.C. 551 and 553 (public domain, chaff-corpus #54); the others are self-written.

const UNITS: ReadonlySet<string> = new Set((en.lexicons["enclosing-unit"] ?? []).map((entry) => entry.pattern));
const unitAfter = (text: string, reference: string): string | undefined => enclosingUnitAfter(text, text.indexOf(reference) + reference.length, UNITS);

describe("enclosingUnitAfter", () => {
  [
    ["or except as to the requirements of section 552 of this title—", "section 552", "title"],
    ["sections 556 and 557 of this title apply instead of this subsection.", "sections 556", "title"],
    ["as defined in section 601 of this title.", "section 601", "title"],
    ["under section 3553(a) of this subchapter", "section 3553", "subchapter"],
    ["subject to section 9 of this Part", "section 9", "part"],
  ].forEach(([text, reference, unit]) => {
    it(`valid: ${String(text)}`, () => assert.equal(unitAfter(String(text), String(reference)), unit));
  });

  [
    ["a unit the lexicon does not list", "section 3 of this Act", "section 3"],
    ["this section is the document's own", "subsection (a) of section 3 of this section", "section 3"],
    ["a word that only starts with a unit", "section 3 of this titled list", "section 3"],
    ["the, not this", "section 3 of the title", "section 3"],
    ["another document named", "section 552 of title 5", "section 552"],
    ["no of", "section 3 this title", "section 3"],
  ].forEach(([form, text, reference]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(unitAfter(String(text), String(reference)), undefined));
  });

  it("abnormal input: empty text, a reference at the end, an empty unit list", () => {
    assert.equal(enclosingUnitAfter("", 0, UNITS), undefined);
    assert.equal(enclosingUnitAfter("see section 3", "see section 3".length, UNITS), undefined);
    assert.equal(enclosingUnitAfter("see section 3 of this", "see section 3".length, UNITS), undefined);
    assert.equal(enclosingUnitAfter("see section 3 of this title", "see section 3".length, new Set()), undefined);
  });
});

const reference = (attrs: Readonly<Record<string, string | number>>): StructureNode => ({
  kind: "reference",
  address: "",
  span: { start: 0, end: 0 },
  line: 1,
  attrs,
  children: [],
});

describe("withinAbsentUnit", () => {
  it("valid: no numbered unit of the document is counted in the word", () => {
    assert.equal(withinAbsentUnit(reference({ withinUnit: "title" }), ["Part I", "Chapter 5", "Section 551"]), true);
    assert.equal(withinAbsentUnit(reference({ withinUnit: "chapter" }), ["Subchapter II", "(a)"]), true);
    assert.equal(withinAbsentUnit(reference({ withinUnit: "part" }), []), true);
  });

  it("invalid: the document has the unit, in any case", () => {
    assert.equal(withinAbsentUnit(reference({ withinUnit: "chapter" }), ["Chapter 5"]), false);
    assert.equal(withinAbsentUnit(reference({ withinUnit: "part" }), ["PART I"]), false);
  });

  it("abnormal input: no unit, an empty unit, a unit that is not a string", () => {
    assert.equal(withinAbsentUnit(reference({}), []), false);
    assert.equal(withinAbsentUnit(reference({ withinUnit: "" }), []), false);
    assert.equal(withinAbsentUnit(reference({ withinUnit: 3 }), []), false);
  });
});

const dangling = (...lines: string[]): string[] =>
  runRules(buildDocument("s.md", lines.join("\n"), en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

describe("dangling-reference and a unit the document does not have", () => {
  it("valid: a section of this title, in one section of the code, is not looked up", () => {
    assert.deepEqual(
      dangling(
        "### §551. Definitions",
        "",
        "For the purpose of this subchapter—",
        "",
        '(1) "agency" means each authority of the Government of the United States, but does not include—',
        "",
        "(A) the Congress;",
        "",
        "or except as to the requirements of section 552 of this title—",
        "",
        "(B) courts martial and military commissions;",
        "",
        "(2) the procedure of sections 556 and 557 of this title applies.",
      ),
      [],
    );
  });

  it("invalid: a missing section of this chapter is reported where the document has the chapter", () => {
    assert.deepEqual(
      dangling(
        "CHAPTER 5 - ADMINISTRATIVE PROCEDURE",
        "",
        "### §551. Definitions",
        "",
        "(a) This section applies according to the provisions thereof.",
        "",
        "(b) The procedure of section 559 of this chapter applies.",
      ),
      ["section 559"],
    );
  });

  it("invalid: a missing section of this Act is still reported", () => {
    assert.deepEqual(dangling("### §551. Definitions", "", "(a) The procedure of section 559 of this Act applies."), ["section 559"]);
  });
});
