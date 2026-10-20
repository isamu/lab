import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { definitionScopeUnit, scopedBeyondDocument } from "../packages/chaff/src/detectors/definition-scope-unit.ts";

// unused-definition and a definition made for a unit of a code ("For the purpose of this subchapter—") in a document that
// is one section of that unit: the unit's other sections use it. Where the document has the unit, or the definition is
// for this section, an unused definition is still reported. Lines from 5 U.S.C. 551 and 18 U.S.C. 1030 (public domain,
// chaff-corpus #54); the others are self-written.

const RULE = "unused-definition";
const LEADS = (en.lexicons["definition-scope-lead"] ?? []).map((entry) => entry.pattern);
const UNITS: ReadonlySet<string> = new Set((en.lexicons["enclosing-unit"] ?? []).map((entry) => entry.pattern));

const SUBCHAPTER = [
  "### §551. Definitions",
  "",
  "For the purpose of this subchapter—",
  "",
  '(1) "agency" means each authority of the Government of the United States;',
  "",
  '(2) "ex parte communication" means an oral or written communication not on the public record.',
  "",
  "Each agency shall keep a record.",
  "",
].join("\n");

const SECTION = [
  "### §1030. Fraud and related activity in connection with computers",
  "",
  "(a) Whoever knowingly accesses a protected computer shall be punished.",
  "",
  "(e) As used in this section—",
  "",
  '(1) the term "protected computer" means a computer used by a financial institution;',
  "",
  '(2) the term "department of the United States" means the legislative or judicial branch of the Government;',
  "",
].join("\n");

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, en, "s.md", "legal/statute").findings;
const offsetOf = (source: string, term: string): number => source.indexOf(`"${term}"`);
const treeOf = (source: string) => {
  const tree = buildDocument("s.md", source, en).structure;
  if (tree === undefined) throw new Error("no tree");
  return tree;
};

describe("definitionScopeUnit", () => {
  it("valid: the unit named by the provision that opens the definitions", () => {
    assert.equal(definitionScopeUnit(treeOf(SUBCHAPTER), SUBCHAPTER, offsetOf(SUBCHAPTER, "ex parte communication"), LEADS), "subchapter");
    assert.equal(definitionScopeUnit(treeOf(SECTION), SECTION, offsetOf(SECTION, "department of the United States"), LEADS), "section");
  });

  it("invalid: no opening words, no leads, no definition at the offset", () => {
    const bare = SUBCHAPTER.replace("For the purpose of this subchapter—", "The following terms apply.");
    assert.equal(definitionScopeUnit(treeOf(bare), bare, offsetOf(bare, "agency"), LEADS), undefined);
    assert.equal(definitionScopeUnit(treeOf(SUBCHAPTER), SUBCHAPTER, offsetOf(SUBCHAPTER, "agency"), []), undefined);
    assert.equal(definitionScopeUnit(treeOf(SUBCHAPTER), SUBCHAPTER, 1, LEADS), undefined);
  });

  it("abnormal input: an empty document, an offset past the end", () => {
    assert.equal(definitionScopeUnit(treeOf(""), "", 0, LEADS), undefined);
    assert.equal(definitionScopeUnit(treeOf(SUBCHAPTER), SUBCHAPTER, SUBCHAPTER.length + 10, LEADS), undefined);
  });
});

describe("scopedBeyondDocument", () => {
  it("valid: a subchapter the document does not have", () => {
    assert.equal(scopedBeyondDocument(treeOf(SUBCHAPTER), SUBCHAPTER, offsetOf(SUBCHAPTER, "agency"), LEADS, UNITS), true);
  });

  it("invalid: this section, a unit the document has, no unit words", () => {
    assert.equal(scopedBeyondDocument(treeOf(SECTION), SECTION, offsetOf(SECTION, "protected computer"), LEADS, UNITS), false);
    const chaptered = `CHAPTER 5 - ADMINISTRATIVE PROCEDURE\n\n${SUBCHAPTER.replace("this subchapter", "this chapter")}`;
    assert.equal(scopedBeyondDocument(treeOf(chaptered), chaptered, offsetOf(chaptered, "agency"), LEADS, UNITS), false);
    assert.equal(scopedBeyondDocument(treeOf(SUBCHAPTER), SUBCHAPTER, offsetOf(SUBCHAPTER, "agency"), LEADS, new Set()), false);
  });
});

describe("unused-definition and a definition for a unit of a code", () => {
  it("valid: a definition for this subchapter, in one section of it, is not reported", () => {
    assert.deepEqual(findingsOf(SUBCHAPTER), []);
  });

  it("invalid: a definition for this section is still reported", () => {
    assert.deepEqual(findingsOf(SECTION), ['"department of the United States" is defined but never used']);
  });

  it("invalid: a definition for a chapter the document has is still reported", () => {
    const chaptered = `CHAPTER 5 - ADMINISTRATIVE PROCEDURE\n\n${SUBCHAPTER.replace("this subchapter", "this chapter")}`;
    assert.deepEqual(findingsOf(chaptered), ['"ex parte communication" is defined but never used']);
  });
});
