import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { inlineCountMismatches, memberCount, type MemberWords } from "../packages/chaff/src/inline-count.ts";
import type { CountWords } from "../packages/chaff/src/announced-count.ts";

// 一行に並べた名前の予告（出席者（6名）：田中、鈴木）。名前はすべて自作。

const JA_MEMBERS: MemberWords = { separators: ["、", "，", ","], joiners: ["と", "および", "・"], open: ["ほか", "他", "など", "等"] };
const EN_MEMBERS: MemberWords = { separators: [","], joiners: ["and", "&", "or"], open: ["etc", "and others", "et al"] };
const JA_WORDS: CountWords = {
  anchors: ["次の"],
  numbers: ["一", "二", "三", "四", "五", "六"],
  counters: ["名", "人", "つ"],
  hedgesBefore: [],
  hedgesAfter: [],
  frames: [],
};
const EN_WORDS: CountWords = {
  anchors: ["following"],
  numbers: ["one", "two", "three"],
  counters: ["people", "members", "attendees"],
  hedgesBefore: [],
  hedgesAfter: [],
  frames: [],
};

const ja = (text: string): string[] => inlineCountMismatches(text, JA_WORDS, JA_MEMBERS).map((mismatch) => `${mismatch.phrase}/${String(mismatch.listed)}`);
const en = (text: string): string[] => inlineCountMismatches(text, EN_WORDS, EN_MEMBERS).map((mismatch) => `${mismatch.phrase}/${String(mismatch.listed)}`);

describe("memberCount", () => {
  it("counts names split at the separators, with notes in brackets left out", () => {
    assert.equal(memberCount("田中、鈴木、佐藤", JA_MEMBERS), 3);
    assert.equal(memberCount("田中（議長）、鈴木（書記、記録）、佐藤。", JA_MEMBERS), 3);
    assert.equal(memberCount("Tanaka (chair), Suzuki, Sato", EN_MEMBERS), 3);
    assert.equal(memberCount("Tanaka, Suzuki, and Sato", EN_MEMBERS), 3);
  });

  it("is undefined when the split is unclear or the list is open", () => {
    assert.equal(memberCount("Tanaka, Suzuki and Sato", EN_MEMBERS), undefined);
    assert.equal(memberCount("Tanaka, Smith & Wesson", EN_MEMBERS), undefined);
    assert.equal(memberCount("田中、鈴木と佐藤", JA_MEMBERS), undefined);
    assert.equal(memberCount("田中、鈴木ほか", JA_MEMBERS), undefined);
    assert.equal(memberCount("田中、鈴木 他", JA_MEMBERS), undefined);
    assert.equal(memberCount("Tanaka, Suzuki, etc.", EN_MEMBERS), undefined);
    assert.equal(memberCount("Tanaka, Suzuki and others", EN_MEMBERS), undefined);
  });

  it("is undefined for one name, an empty name, an unclosed bracket, or a sentence", () => {
    assert.equal(memberCount("田中", JA_MEMBERS), undefined);
    assert.equal(memberCount("田中、、鈴木", JA_MEMBERS), undefined);
    assert.equal(memberCount("田中（議長、鈴木", JA_MEMBERS), undefined);
    assert.equal(memberCount("田中、鈴木。欠席：佐藤", JA_MEMBERS), undefined);
    assert.equal(memberCount("Tanaka. Suzuki, Sato", EN_MEMBERS), undefined);
    assert.equal(memberCount("", EN_MEMBERS), undefined);
    assert.equal(memberCount("a, b", { ...EN_MEMBERS, separators: [] }), undefined);
  });

  it("is undefined when a part is too long to be a name", () => {
    assert.equal(memberCount("Tanaka, who chaired the meeting and wrote the minutes for everyone", EN_MEMBERS), undefined);
  });

  it("a mark that leaves the list open counts only after a name, not inside one", () => {
    assert.equal(memberCount("田中、等々力、佐藤", JA_MEMBERS), 3);
    assert.equal(memberCount("田中、鈴木等", JA_MEMBERS), undefined);
  });

  it("a period inside the list (Jr., Dr.) leaves the split unclear", () => {
    assert.equal(memberCount("Tanaka, Martin Luther King, Jr., Sato", EN_MEMBERS), undefined);
    assert.equal(memberCount("Dr. Tanaka, Sato", EN_MEMBERS), undefined);
  });

  it("is not fooled by a joiner inside a word", () => {
    assert.equal(memberCount("Anderson, Orlando, Sandra", EN_MEMBERS), 3);
  });
});

describe("inlineCountMismatches", () => {
  it("a count in brackets after a label, and names after the colon", () => {
    assert.deepEqual(ja("出席者（6名）：田中、鈴木、佐藤、高橋、伊藤"), ["6名/5"]);
    assert.deepEqual(en("Attendees (6): Tanaka, Suzuki, Sato, Takahashi, Ito"), ["6/5"]);
    assert.deepEqual(en("Attendees (4 people): Tanaka, Suzuki, Sato"), ["4 people/3"]);
    assert.deepEqual(ja("- 出席者（六名）：田中、鈴木"), ["六名/2"]);
  });

  it("a count that matches is silent", () => {
    assert.deepEqual(ja("出席者（5名）：田中、鈴木、佐藤、高橋、伊藤"), []);
    assert.deepEqual(en("Attendees (5): Tanaka, Suzuki, Sato, Takahashi, and Ito"), []);
  });

  it("a hedged or open count is silent", () => {
    assert.deepEqual(ja("出席者（5名ほか）：田中、鈴木"), []);
    assert.deepEqual(ja("出席者（約6名）：田中、鈴木"), []);
    assert.deepEqual(ja("出席者（6名）：田中、鈴木ほか"), []);
    assert.deepEqual(en("Attendees (6): Tanaka, Suzuki, and others"), []);
  });

  it("a list that goes on to the next line after a separator is counted whole", () => {
    assert.deepEqual(ja("出席者（6名）：田中、鈴木、佐藤、\n高橋、伊藤、渡辺\n\n記録：渡辺"), []);
    assert.deepEqual(ja("出席者（6名）：田中、鈴木、佐藤、\n高橋、伊藤\n\n記録：伊藤"), ["6名/5"]);
    assert.deepEqual(en("Attendees (6): Tanaka, Suzuki,\nSato, Takahashi, Ito"), ["6/5"]);
  });

  it("a line that does not end with a separator does not take the next line", () => {
    assert.deepEqual(ja("出席者（2名）：田中、鈴木\n欠席者（1名）：佐藤"), []);
  });

  it("a list cut off by a blank line or a bullet is not counted", () => {
    assert.deepEqual(ja("出席者（6名）：田中、鈴木、\n\n佐藤"), []);
    assert.deepEqual(ja("出席者（6名）：田中、鈴木、\n- 佐藤"), []);
  });

  it("a year, a numbered label or a citation is not a count of names", () => {
    assert.deepEqual(en("Holland (1993): Tropics, Storms, Winds"), []);
    assert.deepEqual(en("Dunn, Miller (3): Tropics, Storms"), []);
    assert.deepEqual(en("Step 2 (3): mix, stir"), []);
    assert.deepEqual(en("Step (1): mix, stir"), []);
    assert.deepEqual(en("Appendix (3): Sources, Methods"), []);
    assert.deepEqual(ja("出席者（6）：田中、鈴木"), []);
  });

  it("a heading, a quotation or a table row is not read", () => {
    assert.deepEqual(en("# Attendees (6): Tanaka, Suzuki"), []);
    assert.deepEqual(en("> Attendees (6): Tanaka, Suzuki"), []);
    assert.deepEqual(en("| Attendees (6): Tanaka, Suzuki |"), []);
  });

  it("the offset points at the count", () => {
    const text = "Notes\nAttendees (6): Tanaka, Suzuki";
    assert.equal(inlineCountMismatches(text, EN_WORDS, EN_MEMBERS)[0]?.offset, text.indexOf("6"));
  });
});
