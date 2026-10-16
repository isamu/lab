import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { literalQuoteSpans, withoutLiteralQuotes, type LiteralCues } from "../packages/chaff/src/literal-quote.ts";

// A quotation of a string to type as it stands (an e-mail subject, a file name) counts as one bracket in bracket-nesting:
// its own brackets cannot be taken out. Self-written examples.

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun("bracket-nesting", source, adapter).findings;

const cues: LiteralCues = { before: ["件名に", "titled"], after: ["と記載", "とファイル名"] };

describe("literalQuoteSpans", () => {
  it("a quotation with a cue before or right after it", () => {
    assert.deepEqual(literalQuoteSpans("件名に「応募（総務課）」と書く", cues), [{ start: 4, end: 11 }]);
    assert.deepEqual(literalQuoteSpans("「様式（氏名）」とファイル名を変える", cues), [{ start: 1, end: 7 }]);
    assert.deepEqual(literalQuoteSpans("a report titled “Rates (2026)”", cues), [{ start: 17, end: 29 }]);
  });

  it("no cue, a cue too far, or nothing quoted", () => {
    assert.deepEqual(literalQuoteSpans("「応募（総務課）」と言った", cues), []);
    assert.deepEqual(literalQuoteSpans("件名について「応募」", cues), []);
    assert.deepEqual(literalQuoteSpans("件名に応募と記載", cues), []);
    assert.deepEqual(literalQuoteSpans("", cues), []);
    assert.deepEqual(literalQuoteSpans("件名に「閉じない", cues), []);
    assert.deepEqual(literalQuoteSpans("an untitled “Rates (2026)”", cues), []);
    assert.deepEqual(literalQuoteSpans("「応募（総務課）」と記載された", { before: [], after: ["と記"] }), [{ start: 1, end: 8 }]);
    assert.deepEqual(literalQuoteSpans(`件名に${" ".repeat(20)}「応募」`, cues), []);
  });

  it("blanks only the inside, so the quotation marks still count", () => {
    assert.equal(withoutLiteralQuotes("（件名に「応募（総務課）」と記載）", cues), "（件名に「       」と記載）");
    assert.equal(withoutLiteralQuotes("（注（a）参照）", cues), "（注（a）参照）");
    assert.equal(withoutLiteralQuotes("件名に「a」と、件名に「b」", { before: ["件名に"], after: [] }), "件名に「 」と、件名に「 」");
  });
});

describe("bracket-nesting and a literal string", () => {
  it("valid: an e-mail subject or a file name with brackets of its own", () => {
    assert.equal(findingsOf("（メールの件名に「参加申込（研修課）」と記載してください。）").length, 0);
    assert.equal(findingsOf("保存の際は「【申込書（第2回）】（氏名）」とファイル名を変更してください。").length, 0);
    assert.equal(findingsOf("(Send it with the subject line “Entry (Training (2026))”.)", en).length, 0);
  });

  it("invalid: deep brackets of the sentence's own, or a quotation that is not a string to type", () => {
    assert.equal(findingsOf("費用は本部が負担します（ただし、出張費（交通費（特急料金を除く）を含む）は各部の負担）。").length, 1);
    assert.equal(findingsOf("（課長は「申込（研修課（本館））」と言った。）").length, 1);
    assert.equal(findingsOf("（件名に「参加申込（研修課）」と記載し、本文（氏名（ふりがな））を書く。）").length, 1);
    assert.equal(findingsOf("The fee is waived (for members (including student members (under 25))) on request.", en).length, 1);
    assert.equal(findingsOf("(The unnamed “Entry (Training (2026))” was rejected.)", en).length, 1);
  });
});
