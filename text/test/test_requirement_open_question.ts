import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { asksAfter, questionWordsOf } from "../packages/chaff/src/detectors/open-end-question.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LexiconEntry, Sentence } from "../packages/chaff/src/plugin.ts";

// requirement-smell: an open list right before a question the reader answers (…など、どのような措置を求めるのか) gives
// example answers, and is not reported. Self-written sentences only.

const RULE = "requirement-smell";

const found = (body: string): string[] =>
  runRules(buildDocument("t.md", `# 手続\n\n${body}\n`, ja), loadRules(ja.id), { [RULE]: "normal" }, false, "docs/manual")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => `${finding.variant ?? ""}:${String(finding.values["matched"])}`);

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("requirement-smell (ja): an open list that gives example answers to a question", () => {
  it("valid: the list right before どのような / どの / 何を … か is not reported", () => {
    assert.deepEqual(found("返金又は交換など、どのような対応を望むのかを記載する必要があります。"), []);
    assert.deepEqual(found("住民票、戸籍謄本等、どの書類を出すかを申請書に書くこと。"), []);
    assert.deepEqual(found("修理、点検など、何を頼むのかを書くこと。"), []);
  });

  it("invalid: the same list without a question is reported", () => {
    assert.deepEqual(found("返金又は交換などを記載する必要があります。"), ["open-end:など"]);
  });

  it("invalid: a question about how (どのように) offers no answers to pick", () => {
    assert.deepEqual(found("ログ等、どのように保存したかを報告すること。"), ["open-end:等"]);
  });

  it("invalid: a question later in the sentence, not right after the list, leaves the list open", () => {
    assert.deepEqual(found("ログ等を保存し、何を保存したかを報告すること。"), ["open-end:等"]);
  });

  it('invalid: an interrogative made "any" by も, or with no question particle, is no question (どの部署でも)', () => {
    assert.deepEqual(found("ログ等、どの部署でも同じ形式で保存すること。"), ["open-end:等"]);
    assert.deepEqual(found("ログ等、どの部署でも同じ形式で保存するかどうかを確認すること。"), ["open-end:等"]);
  });
});

describe("asksAfter", () => {
  const entries: LexiconEntry[] = [
    { pattern: "どの", group: "interrogative" },
    { pattern: "どのように", group: "not-interrogative" },
    { pattern: "か", group: "question-end" },
  ];
  const words = questionWordsOf(entries);
  /** 「等、どの書類か」 at document offset 10, with the particle か tagged. */
  const sentence = (text: string, particle: boolean): Sentence => {
    const at = text.lastIndexOf("か");
    const tokens = particle ? [{ span: { start: 10 + at, end: 11 + at }, surface: "か", pos: "PART" }] : [];
    return { text, span: { start: 10, end: 10 + text.length }, tokens } as const satisfies Sentence;
  };

  it("valid: a question starts right after the word and closes with its particle", () => {
    assert.equal(asksAfter(sentence("等、どの書類か", true), 11, words), true);
  });

  it("invalid: no particle, a how-question, or no words at all", () => {
    assert.equal(asksAfter(sentence("等、どの書類か", false), 11, words), false);
    assert.equal(asksAfter(sentence("等、どのように書くか", true), 11, words), false);
    assert.equal(asksAfter(sentence("等、どの書類か", true), 11, questionWordsOf([])), false);
  });
});
