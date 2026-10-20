import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isSentenceTail } from "../packages/chaff/src/detectors/opener-tail.ts";
import type { LexiconEntry, Sentence, Token } from "../packages/chaff/src/plugin.ts";

// A line that starts with だから only because a sentence was broken across lines (〜というべき／だからである。) does not open
// with a conjunction. The excerpt is adapted from 最高裁判所 昭和31年7月4日判決 (a judgment, not protected by copyright: 著作権法13条3号).

const colloquial = (source: string): readonly string[] => namedRuleRun("colloquial-opener", source, ja, "a.md", "legal/judgment").findings;

describe("colloquial-opener: the tail of a broken sentence is not an opener", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("だからである。 on its own line, after a sentence cut by a blank line, is not reported", () => {
    assert.deepEqual(colloquial("本件判決の場合とは性質を異にするというべき\n\nだからである。）\n"), []);
    assert.deepEqual(colloquial("前者は異にするというべき\n\nだからです。\n"), []);
  });

  it("だから opening a sentence with content after it is still reported", () => {
    assert.equal(colloquial("在庫が足りません。\n\nだから、出荷は来週になります。\n").length, 1);
    assert.equal(colloquial("在庫が足りません。だから大丈夫だ。\n").length, 1);
  });
});

describe("isSentenceTail", () => {
  const token = (surface: string, pos: string): Token => ({ surface, pos, span: { start: 0, end: surface.length } });
  const sentence = (tokens: readonly Token[] | undefined): Sentence => ({
    text: (tokens ?? []).map((word) => word.surface).join(""),
    span: { start: 0, end: 10 },
    ...(tokens === undefined ? {} : { tokens }),
  });
  const dakara: LexiconEntry = { pattern: "だから", tokens: [token("だから", "CCONJ")] };

  it("only auxiliaries and marks after the opener", () => {
    assert.equal(isSentenceTail(sentence([token("だから", "CCONJ"), token("で", "AUX"), token("ある", "AUX"), token("。", "PUNCT")]), dakara), true);
    assert.equal(isSentenceTail(sentence([token("「", "PUNCT"), token("だから", "CCONJ"), token("です", "AUX")]), dakara), true);
  });

  it("a content word, nothing after the opener, no tokens, or an entry without tokens is not a tail", () => {
    assert.equal(isSentenceTail(sentence([token("だから", "CCONJ"), token("大丈夫", "NOUN"), token("だ", "AUX")]), dakara), false);
    assert.equal(isSentenceTail(sentence([token("だから", "CCONJ"), token("。", "PUNCT")]), dakara), false);
    assert.equal(isSentenceTail(sentence(undefined), dakara), false);
    assert.equal(isSentenceTail(sentence([token("だから", "CCONJ"), token("です", "AUX")]), { pattern: "だから" }), false);
    assert.equal(isSentenceTail(sentence([]), dakara), false);
  });
});
