import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { citationLead, isCitationSentence } from "../packages/chaff/src/detectors/citation-sentence.ts";
import { wordsAroundCitation } from "../packages/chaff/src/detectors/citation-string.ts";

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
    [
      PROSE_WITH_YEAR,
      PROSE_WITH_QUOTE,
      PROSE_WITH_YEAR_AND_PLACE,
      "",
      "(2024),",
      'Rivers (2024) said "yes," twice.',
      "The board (2024), after a long review of every district, made a note (Important: keep this) for the council.",
      "The board (2024), after a long review of its findings, pp. 1, went on.",
    ].forEach((text) => assert.equal(isCitationSentence(text), false, text));
  });
});

describe("citationLead", () => {
  const SIGNALS = ["see", "see also", "cf."];

  it("is what comes before the last signal ahead of the year, or the authors before the year", () => {
    assert.equal(citationLead(`For example, ${QUOTED_TITLE}`, SIGNALS), "For example,");
    assert.equal(citationLead(`Our figures differ; see also ${PUBLISHER_ONLY}`, SIGNALS), "Our figures differ;");
    assert.equal(citationLead(QUOTED_TITLE, SIGNALS), "");
    assert.equal(citationLead(PUBLISHER_ONLY, SIGNALS), "Dan Hale and Eve Sato, eds.");
    assert.equal(citationLead(QUOTED_TITLE, []), "See Ann Rivers, Ben Okafor, and Carla Mendes");
  });

  it("takes the year the publication follows, not an earlier year in the writer's words", () => {
    const prose = "According to the board (2024), the review went on through every district before it came to";
    assert.equal(citationLead(`${prose} ${PAGES}`, SIGNALS), prose);
  });

  it("does not read a signal after the year, and is undefined for prose", () => {
    assert.equal(citationLead('Ann Rivers (2024), "How to See the Plains," working paper (Springfield, Ill.: Prairie Press).', SIGNALS), "Ann Rivers");
    assert.equal(citationLead("Seeds (2024), the seedling fund (Springfield: Fund Office), grew.", SIGNALS), "Seeds");
    assert.equal(citationLead(PROSE_WITH_YEAR, SIGNALS), undefined);
    assert.equal(citationLead("", SIGNALS), undefined);
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

  it("measures only the writer's words before the signal of a citation", () => {
    const lead =
      "A recent paper by Rivers and others discusses the cost of land, the wages of builders, the price of timber, and the time a permit takes in each of the towns";
    assert.deepEqual(findingsOf(`1. ${lead}; ${QUOTED_TITLE}`), ["This sentence runs 31 words (limit 25)"]);
    assert.deepEqual(findingsOf(`1. For example, ${QUOTED_TITLE}`), []);
  });
});

// A footnote that opens with a signal and names what it cites: an Act, a quoted title, an agency's declarations, a code
// section. The names are the cited documents', not the writer's; the signal and the writer's words around them are measured.
const NAMED_ACT = "See Rural Lending Fairness and Small Town Housing Improvement Act of 2009 (RLF Act), Pub.";
const QUOTED_LETTER =
  "See also Letter 07-3, “Questions and Answers about the Rules for Small Lenders in Rural Counties and Towns,” for guidance on common questions about the rules.";
const DECLARATIONS =
  "See the State Emergency Housing Office’s (SEHO) relevant storm declarations: Northern Plains Winter Storm Clara (DR 1201), and Coastal Counties Spring Flood Event (DR 1202), Return to text.";
const CODE_PART = 'See "Interagency Guidelines on Small Lender Standards for Rural Housing Loans," 12 CFR part 99, Appendix B-1, sections II.C and D.';
const OWN_WORDS =
  "See the attached form for the steps you must take before the end of the month if you want your claim to be paid in full and on time this year.";
const EMAIL = "business/email";
const emailFindings = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en, "a.md", EMAIL).findings;

describe("a footnote that opens with a signal and names what it cites", () => {
  const SIGNALS = ["see", "see also", "cf."];

  it("keeps the signal and the writer's words, without the cited names, titles and parentheses of codes", () => {
    assert.equal(wordsAroundCitation(NAMED_ACT, SIGNALS)?.split(/\s+/u).filter(Boolean).join(" "), "See , Pub.");
    assert.equal(
      wordsAroundCitation(QUOTED_LETTER, SIGNALS)?.split(/\s+/u).filter(Boolean).join(" "),
      "See also Letter 07-3, for guidance on common questions about the rules.",
    );
    assert.equal(wordsAroundCitation(OWN_WORDS, SIGNALS)?.replace(/\s+/gu, " ").trim(), OWN_WORDS);
  });

  it("is undefined when the text does not open with a signal", () => {
    assert.equal(wordsAroundCitation("The Rural Lending Fairness Act of 2009 applies.", SIGNALS), undefined);
    assert.equal(wordsAroundCitation("Seeing the Rural Lending Fairness Act of 2009 applies.", SIGNALS), undefined);
    assert.equal(wordsAroundCitation(NAMED_ACT, []), undefined);
  });

  it("does not report such a footnote", () => {
    const footnotes = [NAMED_ACT.replace(/, Pub\.$/u, "."), QUOTED_LETTER, DECLARATIONS, CODE_PART].map((text, at) => `${at + 1}. ${text}`).join("\n\n");
    assert.deepEqual(emailFindings(`# Notes\n\n${footnotes}`), []);
  });

  it("still reports a footnote whose own words run long after the signal", () => {
    assert.deepEqual(emailFindings(`# Notes\n\n1. ${OWN_WORDS}`), ["This sentence runs 31 words (limit 18)"]);
    const longAround = `See also Letter 07-3, “Questions and Answers,” which the office sent to every lender last spring and which explains what a lender must do before it closes a loan in a small town.`;
    assert.equal(emailFindings(`# Notes\n\n1. ${longAround}`).length, 1);
  });
});
