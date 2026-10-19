import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { capitalParagraphSpans, isWithinSorted, rosterNameSpans } from "../packages/chaff/src/detectors/caps-caption.ts";

// all-caps-shouting, the paragraphs in capitals (a letterhead, a transcript's heading) and roster names. Every example is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string): readonly string[] => namedRuleRun("all-caps-shouting", source, en).findings;
const textsOf = (source: string): string[] => capitalParagraphSpans(source).map((span) => source.slice(span.start, span.end));
const rosterOf = (source: string): string[] => rosterNameSpans(source).map((span) => source.slice(span.start, span.end));

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

describe("capitalParagraphSpans", () => {
  it("the paragraphs in capitals before the first sentence, each whole", () => {
    assert.deepEqual(textsOf(MEMO), ["OFFICE OF THE TOWN CLERK\nOF THE CITY OF RIVERDALE\nSPRINGFIELD, ST. 01234", "PARKS AND OPEN SPACES"]);
  });

  it("a paragraph with a lower-case line is not one; a capital paragraph after the first sentence is", () => {
    assert.deepEqual(textsOf("Memo 7-3\nOFFICE OF THE CLERK\n\nWe met.\n\nTHE BOARD OF THE OFFICE\nOF THE CITY\n"), ["THE BOARD OF THE OFFICE\nOF THE CITY"]);
  });

  it("a paragraph in capitals that ends a sentence is the first sentence, not a letterhead", () => {
    assert.deepEqual(textsOf("DO NOT OPEN THE BOX\nBEFORE THE BOARD SAYS SO.\n\nThe box is for the board.\n"), []);
    assert.deepEqual(textsOf("WHY IS THE BOX OPEN?\n"), []);
  });

  it("CRLF lines are read like LF lines", () => {
    assert.deepEqual(textsOf("# Notes\r\n\r\nOFFICE OF THE CLERK\r\nTOWN HALL\r\n\r\nWe met.\r\n"), ["OFFICE OF THE CLERK\r\nTOWN HALL"]);
  });

  it("an empty source, or one with no sentence, has none", () => {
    assert.deepEqual(textsOf(""), []);
    assert.deepEqual(textsOf("keep the gate shut\n\nKEEP THE GATE\nSHUT AT NIGHT\n"), []);
  });
});

describe("rosterNameSpans", () => {
  it("a name in capitals and the member's place in ordinary case, in each column", () => {
    assert.deepEqual(rosterOf("JANE Q. DOE, Ohio                    JOHN ROE, JR., New Mexico\nMARY ANN SMITH, Utah\n"), [
      "JANE Q. DOE",
      "JOHN ROE, JR.",
      "MARY ANN SMITH",
    ]);
  });

  it("a run in capitals followed by a comma and prose, or a lower-case word, is no roster", () => {
    assert.deepEqual(rosterOf("DO NOT DELETE THIS, the file is needed.\nKEEP THE GATE SHUT, Bob.\nKEEP THE GATE SHUT, said the board\n"), []);
  });
});

describe("isWithinSorted", () => {
  it("inside one span whole, or not", () => {
    const spans = [
      { start: 0, end: 5 },
      { start: 10, end: 20 },
      { start: 30, end: 31 },
    ];
    assert.equal(isWithinSorted(spans, { start: 10, end: 20 }), true);
    assert.equal(isWithinSorted(spans, { start: 12, end: 15 }), true);
    assert.equal(isWithinSorted(spans, { start: 4, end: 11 }), false);
    assert.equal(isWithinSorted(spans, { start: 25, end: 26 }), false);
    assert.equal(isWithinSorted(spans, { start: 30, end: 31 }), true);
    assert.equal(isWithinSorted([], { start: 0, end: 0 }), false);
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

  it("a transcript's heading on lines of its own and a committee roster are not shouting", () => {
    const hearing = [
      "COMMITTEE ON PARKS",
      "",
      "JANE Q. DOE, Ohio                    JOHN ROE, JR., New Mexico",
      "",
      "MARY ANN SMITH, Utah                 PETER PAUL GRAY, Iowa",
      "",
      "The Committee met at 10 a.m. in the hall.",
      "",
      "OPENING STATEMENT OF HON. JANE Q. DOE,",
      "",
      "U.S. SENATOR FROM OHIO",
      "",
      "The Chair. Good morning. The board of the park will hear from the senator from Ohio and the state of New Mexico.",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(hearing), []);
  });

  it("a shouted line that is a sentence, or a shouted run inside prose, is still reported in a transcript", () => {
    const hearing = [
      "The Chair. We will open the gate at noon.",
      "",
      "PLEASE KEEP THE GATE OPEN.",
      "",
      "The Chair. I said KEEP THE GATE OPEN until noon.",
      "",
    ].join("\n");
    assert.deepEqual(findingsOf(hearing), ['"PLEASE KEEP THE GATE OPEN" is written in capitals', '"KEEP THE GATE OPEN" is written in capitals']);
  });

  it("a wrapped warning in capitals at the head, which is a sentence, is still reported", () => {
    const source = "PLEASE DO NOT OPEN THE BOX\nBEFORE THE BOARD SAYS SO.\n\nPlease keep the box shut before the board says so, and do not open it.\n";
    assert.deepEqual(findingsOf(source), ['"PLEASE DO NOT OPEN THE BOX" is written in capitals', '"BEFORE THE BOARD SAYS SO" is written in capitals']);
  });
});
