import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { summaryLineNumbers } from "../packages/chaff/src/structure/summary-lines.ts";
import { linesOf } from "../packages/chaff/src/structure/lines.ts";
import type { MarkupHeading } from "../packages/chaff/src/plugin.ts";

// Excerpts adapted from 最高裁判所 平成19年1月23日判決 (a Japanese judgment, not protected by copyright: 著作権法13条3号).

const early = (source: string, adapter = ja): readonly string[] => namedRuleRun("use-before-definition", source, adapter, "a.md").findings;

const DEFINITION = "相続により取得した宅地等で政令で定めるもの（以下「小規模宅地等」という。）については、特例を適用する。\n";

describe("use-before-definition: a summary section and a numbered heading are not uses", () => {
  it("a headnote under a summary heading (裁判要旨) is not a use", () => {
    assert.deepEqual(early(`## 裁判要旨\n小規模宅地等についての特例の適用があるとされた事例\n\n## 理由\n${DEFINITION}`), []);
  });

  it("the same sentence under a heading that is not a summary, or only ends like one, is still reported", () => {
    const expected = ["「小規模宅地等」を、5 行目の定義より前で使っています"];
    assert.deepEqual(early(`## 経緯\n小規模宅地等についての特例を申告した。\n\n## 理由\n${DEFINITION}`), expected);
    assert.deepEqual(early(`## 重要旨\n小規模宅地等についての特例を申告した。\n\n## 理由\n${DEFINITION}`), expected);
  });

  it("an English summary heading must be the whole heading", () => {
    const later = 'This agreement is between Harbour Ltd (the "Seller") and Hill Ltd.\n';
    assert.deepEqual(early(`## Executive Summary\nThe Seller ships in five days.\n\n## Terms\n${later}`, en), []);
    assert.deepEqual(early(`## Syllabus\nThe Seller ships in five days.\n\n## Terms\n${later}`, en), []);
    assert.deepEqual(early(`## Summary of Risks\nThe Seller ships in five days.\n\n## Terms\n${later}`, en), [
      '"Seller" is used here, before it is defined on line 5',
    ]);
  });

  it("a numbered line holding only a heading over the paragraphs that define the term is not a use", () => {
    const source = `## 理由\n\n(1) 当事者\n\nア\u3000上告人らは夫婦である。\n\n(2) 本件仮換地の指定等\n\nア\u3000福岡市は、土地523㎡（以下「本件仮換地」という。）に指定した。\n\n(3) 課税の経過等\n\nア\u3000上告人らは申告した。\n`;
    assert.deepEqual(early(source), []);
  });

  it("a numbered line that is a sentence, or that runs on in a predicate, is still a use", () => {
    const sentence = `## 理由\n\n(1) 当事者\n\nア\u3000上告人らは夫婦である。\n\n(2) 本件仮換地を使用した。\n\nア\u3000福岡市は、土地523㎡（以下「本件仮換地」という。）に指定した。\n`;
    assert.deepEqual(early(sentence), ["「本件仮換地」を、9 行目の定義より前で使っています"]);
    const predicate = `## 理由\n\n(1) 当事者\n\nア\u3000上告人らは夫婦である。\n\n(2) 本件仮換地を使用する\n\nア\u3000福岡市は、土地523㎡（以下「本件仮換地」という。）に指定した。\n`;
    assert.deepEqual(early(predicate), ["「本件仮換地」を、9 行目の定義より前で使っています"]);
  });

  it("the last item, whose range runs into the paragraphs after the list, is not a heading", () => {
    const source = `(1) 当事者\n(2) 本件仮換地の指定等\n\n福岡市は、土地523㎡（以下「本件仮換地」という。）に指定した。\n`;
    assert.deepEqual(early(source), ["「本件仮換地」を、4 行目の定義より前で使っています"]);
  });

  it("a short one-line list item is read as a sentence", () => {
    const source = '- (a) the Seller pays\n- (b) the Buyer ships\n\nThis agreement is between Harbour Ltd (the "Seller") and Hill Ltd (the "Buyer").\n';
    assert.deepEqual(early(source, en), ['"Seller" is used here, before it is defined on line 4', '"Buyer" is used here, before it is defined on line 4']);
  });

  it("a term named with where its meaning is set (69条の3所定の) is not an early use", () => {
    assert.deepEqual(early(`措置法69条の3所定の小規模宅地等について申告した。\n${DEFINITION}`), []);
    assert.deepEqual(early(`同法に規定する小規模宅地等について申告した。\n${DEFINITION}`), []);
    const reported = ["「小規模宅地等」を、2 行目の定義より前で使っています"];
    assert.deepEqual(early(`上告人は小規模宅地等について申告した。\n${DEFINITION}`), reported);
    assert.deepEqual(early(`一般にいう小規模宅地等について申告した。\n${DEFINITION}`), reported);
    assert.deepEqual(early(`上告人が定める小規模宅地等について申告した。\n${DEFINITION}`), reported);
  });
});

describe("summaryLineNumbers", () => {
  const heading = (source: string, text: string): MarkupHeading => {
    const start = source.indexOf(`# ${text}`);
    return { depth: 2, text, start, end: start + text.length + 2 };
  };

  it("takes the lines under a summary heading up to the next heading", () => {
    const source = "# 裁判要旨\n事例\n要約\n# 理由\n本文\n";
    const numbers = summaryLineNumbers(linesOf(source), [heading(source, "裁判要旨"), heading(source, "理由")], ["裁判要旨"]);
    assert.deepEqual([...numbers], [2, 3]);
  });

  it("takes nothing without a summary heading, without names, or from an empty document", () => {
    const source = "# 理由\n本文\n";
    assert.deepEqual([...summaryLineNumbers(linesOf(source), [heading(source, "理由")], ["要旨"])], []);
    const suffix = "# 裁判要旨\n事例\n";
    assert.deepEqual([...summaryLineNumbers(linesOf(suffix), [heading(suffix, "裁判要旨")], ["要旨"])], []);
    assert.deepEqual([...summaryLineNumbers(linesOf(source), [heading(source, "理由")], [])], []);
    assert.deepEqual([...summaryLineNumbers(linesOf(""), [], ["要旨"])], []);
  });

  it("matches case-insensitively and runs to the end when the summary is last", () => {
    const source = "# Body\ntext\n# SUMMARY\nshort\n";
    assert.deepEqual([...summaryLineNumbers(linesOf(source), [heading(source, "Body"), heading(source, "SUMMARY")], ["summary"])], [4, 5]);
  });
});
