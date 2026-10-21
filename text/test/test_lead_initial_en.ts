import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { leadInitials, unmarkLeadInitials } from "../packages/lang-en/src/lead-initial.ts";

// Initials after a word that leads a name (by, and) are a name's: "written by F. W. Evans" is one sentence. Every
// sentence is self-written.

const wordsOf = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);
const LEAD = leadInitials(wordsOf("initial-lead-word"), wordsOf("sentence-start-word"));
const sentencesOf = (text: string): string[] => en.segment(text).sentences.map((sentence) => sentence.text);

describe("en sentences: initials after by and and", () => {
  it("initials after by or and, before a surname, do not end the sentence", () => {
    assert.deepEqual(sentencesOf("It was written by F.W. Evans in 1859. It sold well."), ["It was written by F.W. Evans in 1859.", "It sold well."]);
    assert.deepEqual(sentencesOf("It was written by F. W. Evans in 1859."), ["It was written by F. W. Evans in 1859."]);
    assert.deepEqual(sentencesOf("See Hart and J. Reed, A study of tides, 2001."), ["See Hart and J. Reed, A study of tides, 2001."]);
  });

  it("before a sentence-start word, or as the pronoun I, they still end the sentence", () => {
    assert.deepEqual(sentencesOf("Read items B and D. The rest can wait."), ["Read items B and D.", "The rest can wait."]);
    assert.deepEqual(sentencesOf("It covers A, B, C, and D. Additionally, it covers E."), ["It covers A, B, C, and D.", "Additionally, it covers E."]);
    assert.equal(unmarkLeadInitials("just you and I. Mary left", LEAD), "just you and I. Mary left");
  });

  it("only after a lead word: after another lowercase word the splitter decides", () => {
    assert.equal(unmarkLeadInitials("see section B. Bonds are due", LEAD), "see section B. Bonds are due");
    assert.equal(unmarkLeadInitials("standby J. Hart", LEAD), "standby J. Hart");
  });
});

describe("unmarkLeadInitials", () => {
  it("rewrites every full stop of the initials and keeps the length", () => {
    const text = "by F. W. Evans and C.W. Landsea";
    const unmarked = unmarkLeadInitials(text, LEAD);
    assert.equal(unmarked, "by Fn Wn Evans and CnWn Landsea");
    assert.equal(unmarked.length, text.length);
  });

  it("abnormal input: empty text, no lead words, initials before a lowercase word or a number", () => {
    assert.equal(unmarkLeadInitials("", LEAD), "");
    assert.equal(leadInitials([], ["The"]), undefined);
    assert.equal(unmarkLeadInitials("by J. Hart", undefined), "by J. Hart");
    assert.equal(unmarkLeadInitials("by J. hart and by P.L. 105", LEAD), "by J. hart and by P.L. 105");
    assert.equal(unmarkLeadInitials("by J. Hart", leadInitials(["by"], [])), "by Jn Hart");
  });
});
