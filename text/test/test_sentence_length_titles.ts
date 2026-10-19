import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isTitleCase, isTitleLine, quotedTitleWords, termSeriesSaving } from "../packages/chaff/src/detectors/sentence-title.ts";

// max-sentence-length and words the writer did not build into a sentence: a title line with no full stop, a quoted title
// in a list item, and quoted terms listed one after another. A long sentence beside them is still reported. Every text is
// self-written.

const RULE = "max-sentence-length";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, en, "a.md", "business/email").findings;

const LONG_TITLE = "Interagency Notice: Agencies Extend the Review Period for Community Lending Programs Affected by the Spring Floods in the Northern River Counties";
const LONG_SENTENCE =
  "The agencies extend the review period for the community lending programs that the spring floods affected in the northern river counties because the banks there could not finish their reports in time.";

describe("sentence-title", () => {
  it("isTitleCase: most longer words start with a capital", () => {
    assert.equal(isTitleCase(LONG_TITLE), true);
    assert.equal(isTitleCase(LONG_SENTENCE), false);
    assert.equal(isTitleCase("NOTICE TO ALL BANKS"), false);
    assert.equal(isTitleCase("Big Day"), false);
    assert.equal(isTitleCase(""), false);
  });

  it("isTitleLine: a title with no stop at its end; a title with a stop is a sentence", () => {
    assert.equal(isTitleLine(LONG_TITLE), true);
    assert.equal(isTitleLine(`${LONG_TITLE}.`), false);
    assert.equal(isTitleLine(LONG_SENTENCE.slice(0, -1)), false);
  });

  it("quotedTitleWords: the words of quoted titles only", () => {
    assert.equal(quotedTitleWords("NL 12-3 “Guidance on Lending to Small Farms in Dry Years” (May 2, 2020)"), 9);
    assert.equal(quotedTitleWords('He said "we will lend to every small farm this year" today.'), 0);
  });

  it("termSeriesSaving: a run of quoted terms reads as one word", () => {
    assert.equal(termSeriesSaving('The words "MUST", "MUST NOT", "SHOULD", and "MAY" are defined below.'), 4);
    assert.equal(termSeriesSaving('The words "MUST" and "MAY" are defined below.'), 0);
    assert.equal(termSeriesSaving('Say "please write to the lending desk each spring", "thanks", and "hello".'), 0);
    assert.equal(termSeriesSaving('Marks "—", "—", and "—" stay.'), 0);
    assert.equal(termSeriesSaving('Words "MUST”, “SHALL” and “MAY" stay three.'), 2);
  });
});

describe("max-sentence-length: titles and quoted term runs", () => {
  it("a title line is not measured; a long sentence is", () => {
    assert.deepEqual(findingsOf(LONG_TITLE), []);
    assert.equal(findingsOf(LONG_SENTENCE).length, 1);
  });

  it("a quoted title in a list item is not counted; a quoted sentence in a list item is", () => {
    const item = "- NL 12-3 “Guidance on Lending to Small Farms and Ranches in the Northern River Counties after the Spring Floods” (May 2, 2020)";
    assert.deepEqual(findingsOf(item), []);
    const quote = "- The desk wrote “we will lend to every small farm and ranch in the northern river counties after the spring floods this year” on May 2.";
    assert.equal(findingsOf(quote).length, 1);
  });

  it("a run of quoted terms counts as one word", () => {
    const keyWords =
      'The key words "MUST", "MUST NOT", "SHALL", "SHALL NOT", "SHOULD", "SHOULD NOT", and "MAY" in this note are read as the lending desk explains them.';
    assert.deepEqual(findingsOf(keyWords), []);
  });
});
