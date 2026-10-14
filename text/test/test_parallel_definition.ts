import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { definitionOf, definitionWordsOf, isParallelDefinition } from "../packages/chaff/src/detectors/parallel-definition.ts";
import type { Lexicon } from "../packages/chaff/src/plugin.ts";

// 並べた定義（違う語を同じ型で定義する文の並び）は repeated-sentence-ending が指さない。例文はすべて自作。

before(async () => {
  await ja.prepare?.({ pos: true });
});

const RULE = "repeated-sentence-ending";
const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja, "a.md", "business/report", "normal").findings;

const LEXICON: Lexicon = [
  { pattern: "を指す", group: "frame" },
  { pattern: "という", group: "frame" },
  { pattern: "のこと", group: "frame" },
  { pattern: "は", group: "topic" },
];
const words = definitionWordsOf(LEXICON);
const sentencesOf = (text: string) => buildDocument("a.md", text, ja).sentences;
const termsOf = (text: string): (string | undefined)[] => sentencesOf(text).map((sentence) => definitionOf(sentence, words)?.term);

describe("definitionOf", () => {
  it("topic の助詞より前が、定義する語", () => {
    assert.deepEqual(termsOf("暴風は、風速が強い風を指します。小雨は弱い雨のことです。"), ["暴風", "小雨"]);
  });

  it("topic が無ければ、型の助詞の直前の語", () => {
    assert.deepEqual(termsOf("風速が強い風を暴風といいます。"), ["暴風"]);
  });

  it("型の助詞の直前が名詞でなければ語は無い", () => {
    assert.deepEqual(termsOf("強い風を、といいます。"), [undefined]);
  });

  it("型を返す", () => {
    assert.deepEqual(
      sentencesOf("暴風は強い風を指します。").map((sentence) => definitionOf(sentence, words)),
      [{ term: "暴風", frame: "を指す" }],
    );
  });

  it("型の文でなければ語は無い", () => {
    assert.deepEqual(termsOf("この機能は必要です。資料を確認しました。手順の確認。"), [undefined, undefined, undefined]);
  });

  it("空の語彙では何も定義と見ない", () => {
    assert.deepEqual(
      sentencesOf("暴風は強い風を指します。").map((sentence) => definitionOf(sentence, definitionWordsOf(undefined))),
      [undefined],
    );
  });
});

describe("isParallelDefinition", () => {
  it("どの文も違う語の定義なら並べた定義", () => {
    assert.equal(isParallelDefinition(sentencesOf("暴風は強い風を指します。小雨は弱い雨を指します。濃霧は深い霧を指します。"), words), true);
  });

  it("同じ語を二度定義すれば並べた定義ではない", () => {
    assert.equal(isParallelDefinition(sentencesOf("暴風は強い風を指します。暴風は激しい風を指します。濃霧は深い霧を指します。"), words), false);
  });

  it("型が違う定義の並びは、並べた定義ではない", () => {
    assert.equal(isParallelDefinition(sentencesOf("暴風は強い風を指します。強い雨を豪雨といいます。濃霧は深い霧を指します。"), words), false);
  });

  it("定義でない文が一つでも混じれば並べた定義ではない", () => {
    assert.equal(isParallelDefinition(sentencesOf("暴風は強い風を指します。小雨は弱い雨を指します。この区分は必要です。"), words), false);
  });
});

describe("repeated-sentence-ending: 並べた定義", () => {
  it("valid: 違う語を同じ型で定義する文が続いても指さない", () => {
    assert.deepEqual(
      findingsOf(
        "暴風は、風速が毎秒二十メートルを超える風を指します。強風は、毎秒十五メートルを超える風を指します。疾風は、毎秒十メートルを超える風を指します。\n",
      ),
      [],
    );
    assert.deepEqual(findingsOf("強い風を暴風といいます。弱い雨を小雨といいます。深い霧を濃霧といいます。\n"), []);
  });

  it("invalid: 同じ語を言い直す定義の並びは指す", () => {
    assert.equal(findingsOf("暴風は強い風を指します。暴風は激しい風を指します。暴風は荒い風を指します。\n").length, 1);
  });

  it("invalid: 定義でない文の同じ文末は今までどおり指す", () => {
    assert.equal(findingsOf("資料を確認しました。手順を修正しました。結果を報告しました。\n").length, 1);
    assert.equal(findingsOf("この機能は必要です。設定は簡単です。費用は無料です。\n").length, 1);
  });

  it("invalid: 定義の並びの中に定義でない文が入れば指す", () => {
    assert.equal(findingsOf("暴風は強い風を指します。小雨は弱い雨を指します。この区分は担当者が指します。\n").length, 1);
  });
});
