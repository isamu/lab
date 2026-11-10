import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { cleftFocus } from "../packages/chaff/src/detectors/cleft-focus.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LexiconEntry } from "../packages/chaff/src/plugin.ts";

// heading-echo reads a cleft first sentence (〜のは、…ことだ。) by its focus: the topic clause only presents it. Every example is self-written.

before(async () => {
  await ja.prepare?.({ pos: true });
});

const FRAME: readonly LexiconEntry[] = [
  { pattern: "のは", group: "topic" },
  { pattern: "ことだ", group: "close" },
  { pattern: "ことです", group: "close" },
];

const focusOf = (text: string): string | undefined => {
  const span = cleftFocus(text, FRAME);
  return span === undefined ? undefined : text.slice(span.start, span.end);
};

describe("cleftFocus", () => {
  const cases: readonly (readonly [string, string | undefined])[] = [
    ["いちばん驚いたのは、駅が新しくなったことだ。", "駅が新しくなった"],
    ["困ったのは雨が続いたことです。", "雨が続いた"],
    ["困ったのは雨が続いたことです。 ", "雨が続いた"],
    ["わかったのは、上司が困っていたのは資料ではなかったということだ。", "上司が困っていたのは資料ではなかったという"],
    // no topic clause before the marker, no closing word, or nothing between them
    ["のは、駅が新しくなったことだ。", undefined],
    ["駅が新しくなったのは先月だ。", undefined],
    ["駅が新しくなったことだ。", undefined],
    ["驚いたのはことだ。", undefined],
    ["", undefined],
  ];
  cases.forEach(([text, focus]) => {
    it(`${JSON.stringify(text)} → ${JSON.stringify(focus)}`, () => assert.equal(focusOf(text), focus));
  });

  it("a language without the lexicon has no clefts", () => assert.equal(cleftFocus("驚いたのは、駅が新しくなったことだ。", []), undefined));
});

const essay = (heading: string, first: string): string =>
  ["# 通勤を変えて", "", "去年から自転車で通っている。", "", `## ${heading}`, "", first, "", "朝の道は空いていて、信号も少ない。"].join("\n");

const echoes = (heading: string, first: string): boolean => firedRules(ja, essay(heading, first), "blog/essay").includes("heading-echo");

describe("heading-echo: a cleft whose focus restates the heading", () => {
  it("invalid: the focus says the heading again", () => {
    assert.ok(echoes("駅までの時間が短くなった", "いちばん大きく変わったのは、駅までの所要時間が短くなったことだ。"));
  });

  it("valid: the focus says something the heading does not", () => {
    assert.ok(!echoes("駅までの時間が短くなった", "意外だったのは、帰りの坂道がほとんど苦にならないことだ。"));
  });

  it("valid: an ordinary first sentence that adds to the heading is not a cleft", () => {
    assert.ok(!echoes("駅までの時間が短くなった", "駅までの時間が短くなり、朝に新聞を読む余裕ができた。"));
  });
});
