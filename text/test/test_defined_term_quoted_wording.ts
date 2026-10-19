import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { quotesWording, wordingCuesOf, type WordingCues } from "../packages/chaff/src/detectors/quoted-wording.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// defined-term-form and a quoted term that quotes a provision's or a document's wording (憲法一九条にいう「良心の自由」,
// 「謝罪」の文言), not the defined term used again. Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const CUES: WordingCues = wordingCuesOf([
  { pattern: "にいう", group: "before" },
  { pattern: "号の", group: "before" },
  { pattern: "の文言", group: "after" },
  { pattern: "という文言", group: "after" },
]);

/** quotesWording at the first quote of term in text. */
const wordingAt = (text: string, term: string, cues = CUES): boolean => {
  const opening = text.indexOf(`「${term}」`);
  return quotesWording(text, opening, opening + term.length + 1, cues);
};

describe("quotesWording", () => {
  it("reads a provision before the quote, or wording after it, past other listed quotes", () => {
    assert.equal(wordingAt("憲法一九条にいう「良心の自由」は広い。", "良心の自由"), true);
    assert.equal(wordingAt("同項1号の「居住用宅地」に当たる。", "居住用宅地"), true);
    assert.equal(wordingAt("広告の「謝罪」の文言を見る。", "謝罪"), true);
    assert.equal(wordingAt("広告には「謝罪」、「陳謝します」という文言がある。", "謝罪"), true);
  });

  it("does not read a quote with no cue beside it, or with no cues", () => {
    assert.equal(wordingAt("明文で「良心の自由」を守る。", "良心の自由"), false);
    assert.equal(wordingAt("広告の「謝罪」は重い。文言は短い。", "謝罪"), false);
    assert.equal(wordingAt("憲法一九条にいう「良心の自由」は広い。", "良心の自由", { before: [], after: [] }), false);
    assert.equal(wordingAt("「謝罪」", "謝罪"), false);
  });
});

const findingsOf = (source: string): string[] =>
  runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, false, "legal/judgment")
    .findings.filter((finding) => finding.rule === "defined-term-form")
    .map((finding) => String(finding.variant));

const DEFINED = "「宅地」とは、人の住む建物の敷地をいう。";

describe("defined-term-form and quoted wording", () => {
  it("does not report a term quoted as a provision's or a document's wording", () => {
    assert.deepEqual(findingsOf(`${DEFINED}\n\n本件土地が同項1号の「宅地」に当たるかを審理する。\n`), []);
    assert.deepEqual(findingsOf(`${DEFINED}\n\n広告の「宅地」の文言は誤りである。\n`), []);
  });

  it("still reports a defined term quoted again in the writer's own words", () => {
    assert.deepEqual(findingsOf(`${DEFINED}\n\n本件土地は「宅地」に当たる。\n`), ["quoted"]);
  });
});
