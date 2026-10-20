import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { citedDocumentAfter } from "../packages/lang-en/src/citation.ts";

// "section 552(b)(1) of title 5, United States Code": a section cited with a code's title number is that code's, even
// inside 5 U.S.C. 552 itself, whose notes quote Acts that cite the Code this way. Lines from 5 U.S.C. 551 and 552 (public
// domain, chaff-corpus #54); the others are self-written.

const after = (text: string, reference: string): string | undefined => citedDocumentAfter(text, text.indexOf(reference) + reference.length);

describe("citedDocumentAfter and a code's title", () => {
  [
    ["records withheld under section 552(b)(1) of title 5, United States Code", "section 552(b)(1)", "title 5"],
    ["'agency' has the meaning given such term under section 551 of title 5, United States Code;", "section 551", "title 5"],
    ["a 'rule' as defined in section 804(3) of title 5", "section 804(3)", "title 5"],
    ["as defined in section 1029 of Title 18", "section 1029", "title 18"],
    ["under section 552(a)(6)(E) of title 5, United States Code", "section 552(a)(6)", "title 5"],
    ["as set out in Section 4(B) of the Master Agreement", "Section 4", "Master Agreement"],
    ["see section 101 of title 5.", "section 101", "title 5"],
  ].forEach(([text, reference, title]) => {
    it(`valid: ${String(text)}`, () => assert.equal(after(String(text), String(reference)), title));
  });

  [
    ["an Act's own title", "section 101 of title 2 of this Act", "section 101"],
    ["a title in Roman numerals", "section 101 of title IV", "section 101"],
    ["a title with a dotted number", "section 3 of title 2.1", "section 3"],
    ["a title number too long", "section 3 of title 1234", "section 3"],
    ["a title number with a letter", "section 3 of title 5A", "section 3"],
    ["the word title without a number", "section 3 of title insurance", "section 3"],
  ].forEach(([form, text, reference]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(after(String(text), String(reference)), undefined));
  });

  it("abnormal input: empty text, a reference at the end", () => {
    assert.equal(citedDocumentAfter("", 0), undefined);
    assert.equal(citedDocumentAfter("see section 3", "see section 3".length), undefined);
    assert.equal(citedDocumentAfter("see section 3 of title", "see section 3".length), undefined);
  });
});

const dangling = (...body: string[]): string[] =>
  runRules(buildDocument("s.md", ["### §552. Public information", "", ...body].join("\n"), en), loadRules("en"), {}, true, "legal/statute")
    .findings.filter((finding) => finding.rule === "dangling-reference")
    .map((finding) => String(finding.values["label"]));

describe("dangling-reference and a section of a code's title", () => {
  it("valid: a section cited with the title of the code is not looked up", () => {
    assert.deepEqual(
      dangling(
        "(a) Each agency shall make available to the public information as follows.",
        "",
        '"For purposes of expedited processing under section 552(a)(6)(E) of title 5, United States Code, any person may apply.',
      ),
      [],
    );
  });

  it("invalid: a section of this document's own title is still looked up", () => {
    assert.deepEqual(dangling("(a) The agency shall act under section 9 of title 2 of this Act."), ["section 9"]);
  });
});
