import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isCitationSentence } from "../packages/chaff/src/detectors/citation-sentence.ts";

// max-sentence-length and a footnote that is a bibliographic citation (authors, year, title, publisher). The citation is a
// reference, not the writer's sentence, so its length is not measured. Every citation here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

const RULE = "max-sentence-length";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en, "a.md", "speech/address").findings;

const QUOTED_TITLE =
  'See Ann Rivers, Ben Okafor, and Carla Mendes (2024), "Rental Supply and the Cost of Building in Small Towns across the Northern Plains," working paper (Springfield, Ill.: Prairie Housing Institute, March).';
const PUBLISHER_ONLY =
  "Dan Hale and Eve Sato, eds. (2021), Investing in Small Towns: Lessons from Two Decades of Lending Programs across the Region (Springfield, Ill.: Prairie Housing Institute and the State Lending Board).";
const PAGES =
  "See Fay Lund and Gil Moreno (2023), Housing Markets after the Storm, in Hal Ito, ed., Essays on the Regional Economy of the Coastal Counties in the Years after the Flood, pp. 130-66.";
const NO_DATE =
  'See State Lending Board (n.d.), "Small Business Lending in Rural Counties across the State and the Programs That Support Them," webpage, accessed through the board\'s online data portal.';

const PROSE_WITH_YEAR =
  "As Rivers (2024) showed in her careful study of the northern towns, the cost of building a small house rose faster than wages in every county she visited during the decade.";
const PROSE_WITH_QUOTE =
  'The mayor told us that "the town needs more houses, more teachers, and more nurses," and every member of the council agreed with her when the plan came to a vote that spring.';
const PROSE_WITH_YEAR_AND_PLACE =
  "In the survey (2024), the board asked owners in three counties how many people they employed and whether they planned to hire again before the end of the following year.";

describe("isCitationSentence", () => {
  it("reads a citation: authors and year, then a quoted title, a place and publisher, or pages", () => {
    [QUOTED_TITLE, PUBLISHER_ONLY, PAGES, NO_DATE].forEach((text) => assert.equal(isCitationSentence(text), true, text));
  });

  it("does not read prose that names a year, quotes someone, or has a parenthesis", () => {
    [PROSE_WITH_YEAR, PROSE_WITH_QUOTE, PROSE_WITH_YEAR_AND_PLACE, "", "(2024),", 'Rivers (2024) said "yes," twice.'].forEach((text) =>
      assert.equal(isCitationSentence(text), false, text),
    );
  });
});

describe("max-sentence-length and citations in footnotes", () => {
  it("does not measure a footnote that is a citation", () => {
    const footnotes = [QUOTED_TITLE, PUBLISHER_ONLY, PAGES, NO_DATE].map((text, at) => `${at + 1}. ${text} Return to text`).join("\n\n");
    assert.deepEqual(findingsOf(`# Notes\n\n${footnotes}`), []);
  });

  it("still measures a long prose sentence, in the body or in a footnote beside a citation", () => {
    const findings = findingsOf([PROSE_WITH_YEAR, "", `1. ${PROSE_WITH_QUOTE} ${QUOTED_TITLE}`].join("\n"));
    assert.equal(findings.length, 2);
  });
});
