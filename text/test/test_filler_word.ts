import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { fillerUses } from "../packages/chaff/src/detectors/filler-word.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, LexiconEntry } from "../packages/chaff/src/plugin.ts";

// filler-word: hesitation words left in minutes made from a transcript. Every sentence here is self-written.

const RULE = "filler-word";

const findingsOf = (adapter: LanguageAdapter, body: string, genre = "business/meeting-notes"): readonly string[] =>
  namedRuleRun(RULE, `# 議事録\n\n${body}\n`, adapter, "a.md", genre).findings;

const SET_OFF: LexiconEntry[] = [{ pattern: "まあ", group: "set-off" }, { pattern: "えーと" }, { pattern: "えー", group: "set-off" }];

describe("fillerUses", () => {
  it("counts a set-off word at the head or after a comma, with a pause after it", () => {
    assert.deepEqual(
      fillerUses("まあ、それで決まりです。", SET_OFF).map((use) => use.matched),
      ["まあ"],
    );
    assert.deepEqual(
      fillerUses("それは、まあ、難しいです。", SET_OFF).map((use) => use.matched),
      ["まあ"],
    );
  });

  it("does not count a set-off word inside a phrase or without a pause", () => {
    assert.deepEqual(fillerUses("まあまあの出来です。", SET_OFF), []);
    assert.deepEqual(fillerUses("それはまあ、難しいです。", SET_OFF), []);
  });

  it("takes the longer word where two start at the same place", () => {
    assert.deepEqual(
      fillerUses("えーと、来週です。", SET_OFF).map((use) => use.matched),
      ["えーと"],
    );
  });
});

describe("filler-word in Japanese", () => {
  it("reports fillers left in minutes", () => {
    assert.equal(findingsOf(ja, "ええと、次回の定例は火曜日に決まりました。").length, 1);
    assert.equal(findingsOf(ja, "まあ、費用は来月に見直すことになりました。").length, 1);
    assert.equal(findingsOf(ja, "なんか、納期が少し厳しいという意見が出ました。").length, 1);
    assert.equal(findingsOf(ja, "あのー、資料は前日に配ります。").length, 1);
    assert.match(findingsOf(ja, "えっと、資料は前日に配ります。")[0] ?? "", /「えっと」は話すときのつなぎの言葉です/u);
  });

  it("does not report a demonstrative, a set phrase or a noun use", () => {
    assert.deepEqual(findingsOf(ja, "あの件は、来週までに田中さんが確かめます。"), []);
    assert.deepEqual(findingsOf(ja, "試作の出来はまあまあでした。"), []);
    assert.deepEqual(findingsOf(ja, "この案なんか、費用が安く済みます。"), []);
    assert.deepEqual(findingsOf(ja, "「あの、」という書き出しは議事録に残さない決まりにしました。"), []);
  });

  it("does not report a filler quoted as someone's words", () => {
    assert.deepEqual(findingsOf(ja, "部長は「ええと、来月にしよう」と言って会議を終えた。"), []);
    assert.deepEqual(findingsOf(ja, "彼女は「まあ、いいでしょう」と答えた。"), []);
  });

  it("runs in business documents and documentation, not in a transcript or other genres", () => {
    const body = "ええと、次回の定例は火曜日に決まりました。";
    assert.equal(findingsOf(ja, body, "docs/manual").length, 1);
    assert.deepEqual(findingsOf(ja, body, "speech/transcript"), []);
    assert.deepEqual(findingsOf(ja, body, "blog/tech"), []);
    assert.deepEqual(findingsOf(ja, body, "literature"), []);
  });
});

describe("filler-word in English", () => {
  it("reports fillers left in notes", () => {
    assert.equal(findingsOf(en, "Um, the next review is on Tuesday.").length, 1);
    assert.equal(findingsOf(en, "The budget, uh, stays the same.").length, 1);
    assert.equal(findingsOf(en, "You know, the vendor has not replied.").length, 1);
    assert.equal(findingsOf(en, "The date, I mean, moves to Friday.").length, 1);
    assert.match(findingsOf(en, "Er, the room is booked.")[0] ?? "", /"Er" is a spoken filler/u);
  });

  it("does not report the same words in ordinary use", () => {
    assert.deepEqual(findingsOf(en, "As you know, the vendor has not replied."), []);
    assert.deepEqual(findingsOf(en, "I mean to send the draft on Friday."), []);
    assert.deepEqual(findingsOf(en, "Bring an umbrella to the site visit."), []);
    assert.deepEqual(findingsOf(en, "She studied at UM before joining the team."), []);
    assert.deepEqual(findingsOf(en, "Did you know, the office closes early on Friday?"), []);
    assert.deepEqual(findingsOf(en, "We are **S**hort **T**erm **C**ritical about costs."), []);
  });

  it("does not report a filler quoted as someone's words", () => {
    assert.deepEqual(findingsOf(en, 'The chair said, "Um, let us stop here," and closed the meeting.'), []);
  });

  it("does not run in a transcript", () => {
    assert.deepEqual(findingsOf(en, "Um, the next review is on Tuesday.", "speech/transcript"), []);
  });
});
