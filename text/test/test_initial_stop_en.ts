import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { initialStops, unmarkInitialStops } from "../packages/lang-en/src/initial-stop.ts";

// A capital and its full stop before a sentence-start word ends the sentence ("Regulation C. The Guide"); a prepositive
// abbreviation before another capitalised word does not ("the U.S. Census Bureau"). Every sentence is self-written.

const wordsOf = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);
const STOPS = initialStops(wordsOf("sentence-start-word"), wordsOf("prepositive-abbreviation"), wordsOf("name-abbreviation"));
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

describe("en sentences: name abbreviations", () => {
  it("a name abbreviation before a name never ends the sentence, even before a comma", () => {
    assert.deepEqual(sentencesOf("Lives of Ann Lee, Jas. Whittaker, J. Hocknell, and others. Printed in 1888."), [
      "Lives of Ann Lee, Jas. Whittaker, J. Hocknell, and others.",
      "Printed in 1888.",
    ]);
    assert.deepEqual(sentencesOf("It was signed by Wm. Smith and Chas. Brown. Thos. Hart came."), [
      "It was signed by Wm. Smith and Chas. Brown.",
      "Thos. Hart came.",
    ]);
    assert.deepEqual(sentencesOf("The paper is by Joel Wm. Parker."), ["The paper is by Joel Wm. Parker."]);
  });

  it("a whole name, a name abbreviation last, or one before a sentence-start word ends the sentence", () => {
    assert.deepEqual(sentencesOf("I met Fred. Alex came later."), ["I met Fred.", "Alex came later."]);
    assert.deepEqual(sentencesOf("The letter was signed Jas. He sent it in May."), ["The letter was signed Jas.", "He sent it in May."]);
    assert.deepEqual(sentencesOf("The letter was signed Wm. I sent it on."), ["The letter was signed Wm.", "I sent it on."]);
    assert.deepEqual(sentencesOf("It names Wm. I. Hart."), ["It names Wm. I. Hart."]);
    assert.deepEqual(sentencesOf("Signed, Jas."), ["Signed, Jas."]);
    assert.deepEqual(sentencesOf("He wrote to Jas. the next day."), ["He wrote to Jas. the next day."]);
  });

  it("only the written form joins: a longer word or another case is not one", () => {
    const names = initialStops([], [], ["Jas.", "Wm."]);
    assert.equal(unmarkInitialStops("Jas. Hart and Wm. Lee", names), "Jasn Hart and Wmn Lee");
    assert.equal(unmarkInitialStops("BJas. Hart, jas. Hart, Wm.. Lee", names), "BJas. Hart, jas. Hart, Wm.. Lee");
    assert.equal(unmarkInitialStops("Jas. Hart", initialStops([], [], [])), "Jas. Hart");
    assert.equal(unmarkInitialStops("Jas. 12", names), "Jas. 12");
  });
});

describe("en sentences: initials before a word in lower case", () => {
  it("an initial before a word in lower case does not end the sentence", () => {
    assert.deepEqual(sentencesOf("Lives of Ann Lee, J. Hocknell, J. meacham, and Lucy Wright."), [
      "Lives of Ann Lee, J. Hocknell, J. meacham, and Lucy Wright.",
    ]);
    assert.deepEqual(sentencesOf("See Hart, K. and J. Reed. They wrote it."), ["See Hart, K. and J. Reed.", "They wrote it."]);
    assert.deepEqual(sentencesOf("Ask the U.K. parliament first."), ["Ask the U.K. parliament first."]);
    assert.deepEqual(sentencesOf("Hart, K.\nand J. Reed wrote it."), ["Hart, K.\nand J. Reed wrote it."]);
  });

  it("before a capital, a name in lower case at its head only, or as a list's label, it is left as before", () => {
    assert.deepEqual(sentencesOf("It is set by Regulation C. This guide applies."), ["It is set by Regulation C.", "This guide applies."]);
    assert.deepEqual(sentencesOf("The plan was called Plan B. iPhone sales rose."), ["The plan was called Plan B.", "iPhone sales rose."]);
    const none = initialStops([], []);
    assert.equal(unmarkInitialStops("A. the first rule", none), "A. the first rule");
    assert.equal(unmarkInitialStops("- B. the second rule", none), "- B. the second rule");
    assert.equal(unmarkInitialStops("by J. smith and U.K. firms", none), "by Jn smith and U.Kn firms");
  });

  it("a lower-case letter, a word ending in a capital, or a point inside an abbreviation is no initial", () => {
    const none = initialStops([], []);
    assert.equal(unmarkInitialStops("see item c. then stop", none), "see item c. then stop");
    assert.equal(unmarkInitialStops("an MIT. then stop", none), "an MIT. then stop");
    assert.equal(unmarkInitialStops("a Ph.D. student", none), "a Ph.D. student");
    assert.equal(unmarkInitialStops("J. 12 and J.", none), "J. 12 and J.");
  });
});

describe("unmarkInitialStops", () => {
  it("the length never changes, so the spans fit the original text", () => {
    const text = "Regulation C. The U.S. Census and D.C. In the end, Wm. Hart.";
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
