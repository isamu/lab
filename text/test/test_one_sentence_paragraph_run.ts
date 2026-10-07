import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { oneSentenceRuns } from "../packages/chaff/src/paragraph-runs.ts";

// 一文だけの段落の連続（one-sentence-paragraph-run）。例文はすべて自作。

const RULE = "one-sentence-paragraph-run";

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const runLengths = (source: string): number[] => {
  const doc = buildDocument("a.md", source, ja);
  return oneSentenceRuns(doc.source, doc.paragraphs).map((run) => run.length);
};

const paragraphs = (count: number): string => Array.from({ length: count }, (_unused, at) => `${String(at + 1)}番目の文です。`).join("\n\n");

describe("oneSentenceRuns: 隣り合う一文の段落", () => {
  it("一文の段落が続く長さ", () => {
    assert.deepEqual(runLengths(`${paragraphs(3)}\n`), [3]);
  });

  it("二文の段落で切れる", () => {
    assert.deepEqual(runLengths("一つ目です。\n\n二つ目です。\n\n三つ目です。四つ目です。\n\n五つ目です。\n"), [2, 1]);
  });

  it("見出しや箇条書きを挟めば切れる", () => {
    assert.deepEqual(runLengths("一つ目です。\n\n二つ目です。\n\n## 次\n\n三つ目です。\n\n- 項目\n\n四つ目です。\n"), [2, 1, 1]);
  });

  it("改行一つでつないだ行は、段落の切れ目にしない", () => {
    assert.deepEqual(findingsOf("一つ目です。二つ目です。\n三つ目です。\n四つ目です。\n五つ目です。\n六つ目です。\n七つ目です。\n"), []);
    const lines = "Alpha. Beta.\nGamma. Delta.\nEpsilon. Zeta.\nOne.\nTwo.\nThree.\nFour.\nFive.\n";
    assert.deepEqual(findingsOf(lines, en), []);
  });

  it("文の終わりの印で終わらない段落（札、項目、表の欄）は数えず、そこで切れる", () => {
    assert.deepEqual(runLengths("日時：\n\n令和7年12月8日（月）14時から16時まで\n\n場所：\n\nオンライン\n\n議題\n"), []);
    assert.deepEqual(runLengths("一つ目です。\n\n二つ目です。\n\n備考\n\n三つ目です。\n\n四つ目です。\n"), [2, 2]);
    assert.deepEqual(runLengths("「一つ目」です。\n\n二つ目です（例）。\n\n**三つ目です。**\n\n四つ目です」\n"), [3]);
    const english = ["Authors", "OECD", "Tags", "17 June 2025", "Download PDF", "Share:"].join("\n\n");
    assert.deepEqual(findingsOf(`${english}\n`, en), []);
    const sentences = ["One is here.", "Two is here!", "Is three here?", '"Four is here."', "(Five is here.)"].join("\n\n");
    assert.deepEqual(findingsOf(`${sentences}\n`, en), ["5 one-sentence paragraphs in a row (limit 4)"]);
    assert.deepEqual(runLengths("【一つ目です。】\n\n《二つ目です。》\n\n［三つ目です。］\n"), [3]);
  });

  it("段落が無ければ何も無い", () => {
    assert.deepEqual(runLengths("# 見出し\n"), []);
  });
});

describe("one-sentence-paragraph-run", () => {
  it("五つ続けば指し、四つまでは指さない", () => {
    assert.deepEqual(findingsOf(`${paragraphs(5)}\n`), ["一文だけの段落が 5 個続いています（4 個まで）"]);
    assert.deepEqual(findingsOf(`${paragraphs(4)}\n`), []);
  });

  it("英語の文書は英語で言う", () => {
    const source = ["One.", "Two.", "Three.", "Four.", "Five."].map((word) => `Sentence ${word}`).join("\n\n");
    assert.deepEqual(findingsOf(`${source}\n`, en), ["5 one-sentence paragraphs in a row (limit 4)"]);
  });

  it("途中に見出しがあれば数え直す", () => {
    assert.deepEqual(findingsOf(`${paragraphs(3)}\n\n## 次の話\n\n${paragraphs(3)}\n`), []);
  });
});
