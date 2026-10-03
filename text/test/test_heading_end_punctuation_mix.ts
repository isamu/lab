import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { endMarkOf } from "../packages/chaff/src/detectors/heading-end-mark.ts";

// Headings of one depth that end with a colon or a full stop where the rest do not, or the other way round. Self-written examples.

const run = (source: string, adapter = ja, path = "a.md"): readonly string[] =>
  namedRuleRun("heading-end-punctuation-mix", `${source}\n`, adapter, path).findings;

const doc = (title: string, headings: readonly string[]): string =>
  [`# ${title}`, ...headings.flatMap((heading) => ["", `## ${heading}`, "", "本文です。"])].join("\n");

describe("endMarkOf", () => {
  it("reads a colon or a full stop in either width, and none", () => {
    assert.deepEqual(
      ["準備：", "確認。", "Setup:", "Checks.", "Steps", "Why?"].map((heading) => endMarkOf(heading)),
      ["：", "。", ":", ".", "", ""],
    );
  });

  it("reads the mark before closing emphasis, and leaves a full stop that is part of the words", () => {
    assert.equal(endMarkOf("**Note:**"), ":");
    const words = ["Inc.", "etc.", "U.S."];
    assert.deepEqual(
      ["Acme Inc.", "Tools, etc.", "Made in the U.S.", "And then..."].map((heading) => endMarkOf(heading, words)),
      [undefined, undefined, undefined, undefined],
    );
    assert.deepEqual(
      ["Why.", "Zinc."].map((heading) => endMarkOf(heading, words)),
      [".", "."],
    );
  });
});

describe("heading-end-punctuation-mix", () => {
  it("reports the one heading that ends with a mark among bare ones", () => {
    assert.deepEqual(run(doc("手引き", ["準備", "手順", "確認：", "片付け"])), [
      "見出し「確認：」だけ「：」で終わっています（ほかの見出しは「準備」など 3 個が「：」「。」なしで終わる）",
    ]);
    assert.deepEqual(run(doc("Guide", ["Preparation", "Steps", "Checks:", "Cleanup"]), en), [
      'The heading "Checks:" ends with ":", while 3 other headings end bare ("Preparation")',
    ]);
  });

  it("reports the one bare heading among marked ones", () => {
    assert.deepEqual(run(doc("報告", ["背景。", "方針。", "課題", "日程。"])), [
      "見出し「課題」だけ「：」「。」なしで終わっています（ほかの見出しは「背景。」など 3 個が記号で終わる）",
    ]);
  });

  it("compares headings of one depth only, so a depth of labels is its own way", () => {
    const source = [
      doc("Guide", ["Preparation", "Steps", "Checks", "Cleanup"]),
      "",
      "### Optional:",
      "",
      "### Required:",
      "",
      "### Notes:",
      "",
      "### Extra:",
    ].join("\n");
    assert.deepEqual(run(source, en), []);
  });

  it("does not report too few headings, a common second way, a question, or a plain-text file", () => {
    assert.deepEqual(run(doc("手引き", ["準備", "手順", "確認："])), []);
    assert.deepEqual(run(doc("手引き", ["準備", "手順：", "確認：", "片付け"])), []);
    assert.deepEqual(run(doc("FAQ", ["What is it", "Who is it for", "How much is it?", "Where is it"]), en), []);
    assert.deepEqual(run(doc("Guide", ["Preparation", "Steps", "Checks:", "Cleanup"]), en, "a.txt"), []);
  });

  it("reports a short word ending with a full stop, and leaves out a heading ending with an abbreviation", () => {
    assert.deepEqual(run(doc("Guide", ["Why.", "Setup", "Build", "Run"]), en), ['The heading "Why." ends with ".", while 3 other headings end bare ("Setup")']);
    assert.deepEqual(run(doc("Guide", ["Plan", "Tools, etc.", "Setup", "Run", "Deploy"]), en), []);
  });

  it("leaves the page title out of the comparison", () => {
    assert.deepEqual(run(doc("Guide:", ["Preparation", "Steps", "Checks", "Cleanup"]), en), []);
  });
});
