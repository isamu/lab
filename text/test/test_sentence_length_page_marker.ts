import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { pageMarkerPattern, pageMarkerSize } from "../packages/chaff/src/detectors/page-marker.ts";

// max-sentence-length and the page markers a converted print edition leaves inside a sentence ("( printed page 52044)").
// The marker is the page break, not the writer's words, so it is not counted. Every sentence here is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const RULE = "max-sentence-length";
const findingsOf = (source: string, adapter = en): readonly string[] => namedRuleRun(RULE, `${source}\n`, adapter).findings;

const CLAUSE = ["the", "team", "reviewed", "the", "plan"];

/** "We know that … today." in `count` words, the marker after "that" when given. */
const sentenceOf = (count: number, marker = ""): string => {
  const middle = Array.from({ length: count - 4 }, (_unused, at) => CLAUSE[at % CLAUSE.length]).join(" ");
  return ["We know that", marker, `${middle} today.`].filter((part) => part !== "").join(" ");
};

/** A Japanese sentence of 138 characters, `inserted` placed after its opening words. */
const japaneseOf = (inserted: string): string => `計画を${inserted}${"説明します、".repeat(22)}説明。`;

describe("pageMarkerPattern and pageMarkerSize", () => {
  const pattern = pageMarkerPattern(["( printed page #)", "[[Page #]]", "－ # －"]);

  it("reads each marker, with or without spaces, and counts its words or its characters", () => {
    assert.equal(pageMarkerSize("the remediation ( printed page 52044) workflows", pattern, "word"), 4);
    assert.equal(pageMarkerSize("the plan [[Page 12]] and (printed page 3)", pattern, "word"), 5);
    assert.equal(pageMarkerSize("計画は－ 12 －次の通り", pattern, "char"), 4);
    assert.equal(pageMarkerSize("計画は－12－次の通り", pattern, "char"), 4);
    assert.equal(pageMarkerSize("計画は－１２－次の通り", pattern, "char"), 4);
  });

  it("does not read a page reference in prose, a marker touching a number, or an empty lexicon", () => {
    assert.equal(pageMarkerSize("see page 12 and (page 12) and [Page 12]", pattern, "word"), 0);
    assert.equal(pageMarkerSize("千代田区1－2－3にあります", pattern, "char"), 0);
    assert.equal(pageMarkerSize("千代田区１－ 12 －３にあります", pattern, "char"), 0);
    assert.equal(pageMarkerSize("", pattern, "word"), 0);
    assert.equal(pageMarkerPattern([]), undefined);
    assert.equal(pageMarkerSize("( printed page 5)", undefined, "word"), 0);
  });
});

describe("max-sentence-length and page markers", () => {
  it("en: a sentence under the limit is not pushed over it by a page marker", () => {
    assert.deepEqual(findingsOf(sentenceOf(44, "( printed page 52044)")), []);
    assert.deepEqual(findingsOf(sentenceOf(44, "[[Page 52044]]")), []);
  });

  it("en: a sentence over the limit is still reported, its marker not counted", () => {
    assert.deepEqual(findingsOf(sentenceOf(47, "( printed page 52044)")), ["This sentence runs 47 words (limit 45)"]);
    assert.deepEqual(findingsOf(sentenceOf(47)), ["This sentence runs 47 words (limit 45)"]);
  });

  it("ja: the marker's characters are not counted, an address is", () => {
    assert.deepEqual(findingsOf(japaneseOf("－ 12 －"), ja), []);
    assert.deepEqual(findingsOf(japaneseOf("1－2－3"), ja), ["この文は 143 文字あります（140 文字まで）"]);
  });
});
