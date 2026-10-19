import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { initialStops, unmarkInitialStops } from "../packages/lang-en/src/initial-stop.ts";

// A capital and its full stop before a sentence-start word ends the sentence ("Regulation C. The Guide"); a prepositive
// abbreviation before another capitalised word does not ("the U.S. Census Bureau"). Every sentence is self-written.

const wordsOf = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);
const STOPS = initialStops(wordsOf("sentence-start-word"), wordsOf("prepositive-abbreviation"));
const sentencesOf = (text: string): string[] => en.segment(text).sentences.map((sentence) => sentence.text);

describe("en sentences: initials and prepositive abbreviations", () => {
  it("a capital initial before a sentence-start word ends the sentence", () => {
    assert.deepEqual(sentencesOf("It is set by Regulation C. This guide applies."), ["It is set by Regulation C.", "This guide applies."]);
    assert.deepEqual(sentencesOf("Read Appendix B. Then stop."), ["Read Appendix B.", "Then stop."]);
    assert.deepEqual(sentencesOf("Prices rose in Washington, D.C. In May they fell."), ["Prices rose in Washington, D.C.", "In May they fell."]);
  });

  it("an initial before a surname, and a list label first on its line, do not end a sentence", () => {
    assert.deepEqual(sentencesOf("He met John F. Kennedy there."), ["He met John F. Kennedy there."]);
    assert.deepEqual(sentencesOf("A. The first rule applies."), ["A. The first rule applies."]);
    assert.equal(unmarkInitialStops("- B. The second rule", STOPS), "- B. The second rule");
  });

  it("a prepositive abbreviation before a name does not end the sentence", () => {
    assert.deepEqual(sentencesOf("The figure includes U.S. Census rental data. It is new."), ["The figure includes U.S. Census rental data.", "It is new."]);
    assert.deepEqual(sentencesOf("Ask the U.K. Parliament."), ["Ask the U.K. Parliament."]);
  });

  it("before a sentence-start word, or a word and a comma, it still ends the sentence", () => {
    assert.deepEqual(sentencesOf("It is made in the U.S. The rest is not."), ["It is made in the U.S.", "The rest is not."]);
    assert.equal(unmarkInitialStops("It ended in the U.S. Yesterday, it began.", STOPS), "It ended in the U.S. Yesterday, it began.");
  });
});

describe("unmarkInitialStops", () => {
  it("the length never changes, so the spans fit the original text", () => {
    const text = "Regulation C. The U.S. Census and D.C. In the end.";
    assert.equal(unmarkInitialStops(text, STOPS).length, text.length);
  });

  it("abnormal input: empty text, no lexicons", () => {
    assert.equal(unmarkInitialStops("", STOPS), "");
    const none = initialStops([], []);
    assert.equal(unmarkInitialStops("Regulation C. The U.S. Census", none), "Regulation C. The U.S. Census");
  });

  it("a lowercase letter or a word with a full stop is not an initial", () => {
    assert.equal(unmarkInitialStops("see item c. The end", STOPS), "see item c. The end");
    assert.equal(unmarkInitialStops("the last Fig. The tree", STOPS), "the last Fig. The tree");
  });
});
