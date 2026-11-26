import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isSentenceEndingOnly, sentencesInEndingRuns } from "../packages/chaff/src/detectors/gram-ending.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// ngram-repetition: 文の結びだけの語句（してまいります。）は、結びの単調さを見る repeated-sentence-ending に任せて数えない。例文はすべて自作。

const findingsOf = (source: string): readonly string[] => namedRuleRun("ngram-repetition", source, ja).findings;

before(async () => {
  await ja.prepare?.({ pos: true });
});

const ITEMS = [
  "当社は、地域の店舗網を生かした新しい販売の仕組みを整え、来店の機会を増やす取り組みを",
  "物流の拠点を見直して配送にかかる日数を縮め、在庫の持ち方を地域ごとに合わせる仕組みを",
  "従業員が働きやすい職場を目指して、勤務の形を選べる制度と育児を支える制度の利用を",
  "取引先との対話の場を年に二度設け、品質の基準と納期の考え方をすり合わせる体制を",
  "店舗の照明と空調を省エネルギーの設備へ順に入れ替え、使う電力の量を減らす計画を",
  "若手の社員が売場の運営を学べる研修を充実させ、店長を任せられる人材の育成を",
  "会員向けのアプリを使いやすく作り直し、買い物の記録に合わせたお知らせの配信を",
  "仕入れの段階で産地と作り手を確かめ、安心して選べる商品の品揃えを",
  "地域の行事や清掃の活動に社員が参加できるよう、休暇の取り方を見直して地域との連携を",
  "売場の案内を外国語でも読めるように作り替え、旅行で訪れるお客様への応対を",
  "古くなった店舗の改装を計画どおりに進め、車いすでも通りやすい通路の確保を",
  "社内の会議を減らして決める手順を短くし、現場の判断で動ける仕組みの導入を",
];

const INTRO = ["# 経営の方針", "", "当社グループは、経営の基盤を固めて成長を続けるために、次の項目に重点を置いて取り組みます。", ""];

/** 項目を一つの段落に続けて書く（同じ結びの文が並ぶ）。 */
const runOn = (ending: (stem: string, index: number) => string): string => INTRO.concat(ITEMS.map(ending).join("")).join("\n");

/** 項目ごとに段落を分ける（同じ結びが離れた所で何度も出る）。 */
const apart = (ending: (stem: string, index: number) => string): string => INTRO.concat(ITEMS.map((stem, index) => `${ending(stem, index)}\n`)).join("\n");

const LIGHT_VERBS = ["推進", "強化", "実施", "整備", "拡充", "徹底", "展開", "加速", "強化", "改善", "推進", "検討"];

const tokensOf = (text: string): readonly Token[] => ja.segment(text).sentences.flatMap((sentence) => sentence.tokens ?? []);

const endingOnly = (text: string, phrase: string): boolean => {
  const start = text.lastIndexOf(phrase);
  return isSentenceEndingOnly(tokensOf(text), { start, end: start + phrase.length });
};

describe("ngram-repetition: 文の結びだけの語句", () => {
  const lightEnding = (stem: string, index: number): string => `${stem}${LIGHT_VERBS[index] ?? "推進"}してまいります。`;

  it("続けて並ぶ文の「〜してまいります。」は、文末の繰り返しとして repeated-sentence-ending に任せる", () => {
    assert.deepEqual(findingsOf(runOn(lightEnding)), []);
  });

  it("離れた所で何度も出る「〜してまいります。」は言い回しの癖として指摘する", () => {
    assert.equal(findingsOf(apart(lightEnding)).length, 1);
  });

  it("中身の動詞を持つ結び（〜努めてまいります。）は、並んでいても指摘する", () => {
    assert.equal(findingsOf(runOn((stem) => `${stem}進めるよう努めてまいります。`)).length, 1);
  });

  it("結びだけかどうかの見分け", () => {
    assert.equal(endingOnly("販売の仕組みを強化してまいります。", "してまいります。"), true);
    assert.equal(endingOnly("販売の仕組みを検討してまいりました。", "てまいりました。"), true);
    assert.equal(endingOnly("販売の仕組みに取り組んでまいります。", "んでまいります。"), false);
    assert.equal(endingOnly("販売の仕組みの改善に努めてまいります。", "めてまいります。"), false);
    assert.equal(endingOnly("販売の仕組みを強化してまいりますが、", "してまいりますが"), false);
    assert.equal(endingOnly("販売の仕組みを強化してまいります。", "強化してまいります"), false);
    assert.equal(endingOnly("販売の仕組みを強化してまいります。", ""), false);
    assert.equal(isSentenceEndingOnly([], { start: 0, end: 8 }), false);
    assert.equal(sentencesInEndingRuns([], []).size, 0);
  });
});
