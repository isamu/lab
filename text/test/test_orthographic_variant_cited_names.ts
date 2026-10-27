import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// orthographic-variant (en): words a document quotes from elsewhere keep their own spelling: a cited work's title, the words an
// acronym stands for, a capitalised name, a roster's surname in capitals and a hashtag. Every example is self-written.

const findingsOf = (source: string, genre = "business/report"): readonly string[] => namedRuleRun("orthographic-variant", source, en, "a.md", genre).findings;

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("orthographic-variant: cited works", () => {
  it("an entry of a reference list keeps its title's spelling", () => {
    const source =
      "# Study\n\nWe surveyed k-12 schools. Many k-12 teachers answered. Most k-12 classes use data.\n\n## References\n\n- Lee, A. (2020) Teaching k12 students to read data. Journal 3 (1), pp. 1–9.\n";
    assert.deepEqual(findingsOf(source, "academic/paper"), []);
  });

  it("a citation written as a sentence keeps its title's spelling", () => {
    const source =
      "# Remarks\n\nWe value decisionmaking. Our decisionmaking is slow. See Ann Lee (2019), Better Decision-Making Today (Boston: Example Press).\n";
    assert.deepEqual(findingsOf(source), []);
  });

  it("a cited title's ordinary word is the title's (factors beside the dataset FACTors)", () => {
    const source =
      "# Study\n\nWe used FACTors here. FACTors lists checks. FACTors grew.\n\n## References\n\n- Lee, A. (2026) The truth game: verification factors behind choices. Journal 27 (8), pp. 1–9.\n";
    assert.deepEqual(findingsOf(source, "academic/paper"), []);
  });

  it("a capital the reference list lost (arxiv beside arXiv) is still reported", () => {
    const source =
      "# Study\n\nWe read arXiv daily. The arXiv mirror helps. Each arXiv paper counts.\n\n## References\n\n- Lee, A. (2026) Notes on data. arxiv preprint, pp. 1–9.\n";
    assert.equal(findingsOf(source, "academic/paper").length, 1);
  });

  it("the same spelling in the writer's own text is still reported", () => {
    assert.equal(findingsOf("# Study\n\nWe surveyed k-12 schools. Many k-12 teachers answered. Most k12 classes use data.\n", "academic/paper").length, 1);
    assert.equal(findingsOf("# Remarks\n\nWe value decisionmaking. Our decisionmaking is slow. Better decision-making helps.\n").length, 1);
  });
});

describe("orthographic-variant: the words an acronym stands for", () => {
  it("the expansion before the acronym in brackets is the name's spelling", () => {
    const source = "# Meetings\n\nAsk for real-time captions. We offer real-time text. Communication Access Realtime Translation (CART) is available.\n";
    assert.deepEqual(findingsOf(source), []);
  });

  it("the expansion in brackets after the acronym, with its letters picked out, is not a spelling", () => {
    const source = "# Method\n\nSentiment matters. We scored sentiment with VADER (Valence Aware Dictionary and sEntiment Reasoner). The sentiment was low.\n";
    assert.deepEqual(findingsOf(source, "academic/paper"), []);
  });

  it("the same word outside an expansion is still reported", () => {
    assert.equal(findingsOf("# Meetings\n\nAsk for real-time captions. We offer real-time text. The realtime service is available.\n").length, 1);
  });
});

describe("orthographic-variant: a capitalised name", () => {
  it("a name's hyphens are the name's own (the Interagency Group beside inter-agency)", () => {
    const source =
      "# Statute\n\nEach inter-agency memo is exempt. The Interagency Group shall meet. The Interagency Group shall report. Members of the Interagency Group serve two years.\n";
    assert.deepEqual(findingsOf(source, "legal/statute"), []);
  });

  it("a name the document writes two ways is still compared (Co-working Space, Coworking Space)", () => {
    const source =
      "# Policy\n\nAsk about co-working costs. Book a co-working desk. Pick co-working days. Share co-working rooms.\n\n- Category: Co-working Space - Monthly\n- Code: 6076 - Coworking Space\n";
    assert.equal(findingsOf(source).length, 1);
  });

  it("outside a name, the hyphen is still compared", () => {
    assert.equal(
      findingsOf("# Statute\n\nEach inter-agency memo is exempt. Interagency work is slow. Interagency groups meet often.\n", "legal/statute").length,
      1,
    );
  });

  it("a name still differs by its capitals (Github Actions beside GitHub)", () => {
    assert.equal(findingsOf("# Tools\n\nWe use GitHub daily. GitHub hosts the code. Our Github Actions run the tests.\n").length, 1);
  });
});

describe("orthographic-variant: a roster's surname in capitals", () => {
  it("a surname set in capitals after a given name in capitals (MICHAEL T. McCAUL) is not a spelling", () => {
    assert.deepEqual(findingsOf("# Hearing\n\nMICHAEL T. McCAUL, Texas\n\nMr. McCaul spoke. Mr. McCaul asked. Thank you, Mr. McCaul.\n"), []);
  });

  it("the capitals form in running text is still reported", () => {
    assert.equal(findingsOf("# Hearing\n\nMr. McCAUL spoke. Mr. McCaul asked. Thank you, Mr. McCaul.\n").length, 1);
  });
});

describe("orthographic-variant: a hashtag", () => {
  it("a hashtag is spelled as the service matches it", () => {
    assert.deepEqual(findingsOf("# News\n\nFollow VimConf news. VimConf is in November. Tag your posts with #vimconf on social media.\n"), []);
  });

  it("the word without the mark is still reported", () => {
    assert.equal(findingsOf("# News\n\nFollow VimConf news. VimConf is in November. Tag your posts about vimconf.\n").length, 1);
  });
});
