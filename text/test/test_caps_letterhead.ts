import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { letterheadSpans } from "../packages/chaff/src/detectors/caps-caption.ts";

// all-caps-shouting and the letterhead at a document's head. Every example is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun("all-caps-shouting", source, en).findings;
const textsOf = (source: string): string[] => letterheadSpans(source).map((span) => source.slice(span.start, span.end));

const MEMO = [
  "OFFICE OF THE TOWN CLERK",
  "OF THE CITY OF RIVERDALE",
  "SPRINGFIELD, ST. 01234",
  "",
  "PARKS AND OPEN SPACES",
  "",
  "Memo 7-3",
  "",
  "The board of the office will meet on Monday. The office of the clerk is open to the city, and the parks stay open.",
  "",
].join("\n");

describe("letterheadSpans", () => {
  it("the paragraphs in capitals before the first sentence, each whole", () => {
    assert.deepEqual(textsOf(MEMO), ["OFFICE OF THE TOWN CLERK\nOF THE CITY OF RIVERDALE\nSPRINGFIELD, ST. 01234", "PARKS AND OPEN SPACES"]);
  });

  it("a paragraph with a lower-case line, or a capital paragraph after the first sentence, is not one", () => {
    assert.deepEqual(textsOf("Memo 7-3\nOFFICE OF THE CLERK\n\nWe met.\n\nTHE BOARD OF THE OFFICE\nOF THE CITY\n"), []);
  });

  it("a paragraph in capitals that ends a sentence is the first sentence, not a letterhead", () => {
    assert.deepEqual(textsOf("DO NOT OPEN THE BOX\nBEFORE THE BOARD SAYS SO.\n\nThe box is for the board.\n"), []);
    assert.deepEqual(textsOf("WHY IS THE BOX OPEN?\n"), []);
  });

  it("CRLF lines are read like LF lines", () => {
    assert.deepEqual(textsOf("# Notes\r\n\r\nOFFICE OF THE CLERK\r\nTOWN HALL\r\n\r\nWe met.\r\n"), ["OFFICE OF THE CLERK\r\nTOWN HALL"]);
  });

  it("an empty source, or one with no sentence, has no letterhead", () => {
    assert.deepEqual(textsOf(""), []);
    assert.deepEqual(textsOf("keep the gate shut\n\nKEEP THE GATE\nSHUT AT NIGHT\n"), []);
  });
});

describe("all-caps-shouting with a letterhead", () => {
  it("the letterhead and the office's name are not shouting", () => {
    assert.deepEqual(findingsOf(MEMO), []);
  });

  it("shouting in the body under a letterhead is still reported", () => {
    const source = `${MEMO}Keep the gate shut. KEEP THE GATE SHUT AT NIGHT, the board says.\n\nDO NOT OPEN THE GATE\nBEFORE THE BOARD SAYS SO.\n`;
    assert.deepEqual(findingsOf(source), [
      '"KEEP THE GATE SHUT AT NIGHT" is written in capitals',
      '"DO NOT OPEN THE GATE" is written in capitals',
      '"BEFORE THE BOARD SAYS SO" is written in capitals',
    ]);
  });

  it("a wrapped warning in capitals at the head, which is a sentence, is still reported", () => {
    const source = "PLEASE DO NOT OPEN THE BOX\nBEFORE THE BOARD SAYS SO.\n\nPlease keep the box shut before the board says so, and do not open it.\n";
    assert.deepEqual(findingsOf(source), ['"PLEASE DO NOT OPEN THE BOX" is written in capitals', '"BEFORE THE BOARD SAYS SO" is written in capitals']);
  });
});
