import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { labelStops, unmarkLabelStops } from "../packages/lang-en/src/label-stop.ts";

// "FIG. 1 illustrates", "Vol. XLIII (1979)": the full stop of a label before its number does not end a sentence.
// sentence-splitter ended one there, so "FIG." stood alone and its number opened the next sentence. US 4,683,202 and
// US 6,285,999 (public domain); the other sentences are self-written.

const LABELS = labelStops((en.lexicons["number-label"] ?? []).map((entry) => entry.pattern));
const sentencesOf = (text: string): string[] => en.segment(text).sentences.map((sentence) => sentence.text);

describe("unmarkLabelStops", () => {
  [
    ["FIG. 1 illustrates a sequence.", "FIGn 1 illustrates a sequence."],
    ["FIGS. 4-1-4-3 illustrate the steps.", "FIGSn 4-1-4-3 illustrate the steps."],
    ["Biology, Vol. XLIII (1979).", "Biology, Voln XLIII (1979)."],
    ["See Fig. 3 and Ch. II.", "See Fign 3 and Chn II."],
    ["as in FIG.\n2 below", "as in FIGn\n2 below"],
  ].forEach(([text, unmarked]) => {
    it(`valid: ${JSON.stringify(text)}`, () => assert.equal(unmarkLabelStops(String(text), LABELS), unmarked));
  });

  [
    ["a word follows the label", "It was the last Fig. The tree fell."],
    ["a lone I after a label is the pronoun", "He said No. I left."],
    ["the label inside a longer word", "see CONFIG. 3 and Info. 2"],
    ["no space before the number", "FIG.3 shows it."],
    ["a label that is not in the list", "See Ex. 3 now."],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(unmarkLabelStops(String(text), LABELS), text));
  });

  it("the length never changes, so the spans fit the original text", () => {
    const text = "FIG. 1, FIGS. 2A-2C, Vol. XLIII, No. 5 and Pt. IV.";
    assert.equal(unmarkLabelStops(text, LABELS).length, text.length);
  });

  it("abnormal input: empty text, no labels, labels without a full stop", () => {
    assert.equal(unmarkLabelStops("", LABELS), "");
    assert.equal(unmarkLabelStops("FIG. 1 shows it.", labelStops([])), "FIG. 1 shows it.");
    assert.equal(unmarkLabelStops("Part 1 shows it.", labelStops(["Part"])), "Part 1 shows it.");
  });
});

describe("English sentences and a label before its number", () => {
  [
    ["FIG. 1 illustrates a sequence. The SRE joins.", ["FIG. 1 illustrates a sequence.", "The SRE joins."]],
    ["See Symposia on Biology, Vol. XLIII (1979). The SRE joins.", ["See Symposia on Biology, Vol. XLIII (1979).", "The SRE joins."]],
    ["as in FIG. 2 and FIGS. 3A-3C, it works.", ["as in FIG. 2 and FIGS. 3A-3C, it works."]],
    ["He said No. I left.", ["He said No.", "I left."]],
    ["It was the last Fig. The tree fell.", ["It was the last Fig.", "The tree fell."]],
  ].forEach(([text, sentences]) => {
    it(JSON.stringify(text), () => assert.deepEqual(sentencesOf(String(text)), sentences));
  });
});
