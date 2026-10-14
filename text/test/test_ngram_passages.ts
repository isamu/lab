import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { gramPassagesOf, isQuestionHeading } from "../packages/chaff/src/detectors/gram-passages.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, Section, Sentence } from "../packages/chaff/src/plugin.ts";

// ngram-repetition は、書き手が一つの流れの中で同じ言い回しを繰り返すのを見る。よくある質問の答えは一つずつ読まれるので、
// 別々の答えが同じ案内（〜をご覧ください）で終わっても繰り返しではない。

const sentence = (text: string, start: number): Sentence => ({ span: { start, end: start + text.length }, text });
const section = (depth: number, heading: string, texts: readonly string[], start: number): Pick<Section, "depth" | "heading" | "sentences"> => ({
  depth,
  heading,
  sentences: texts.map((text, index) => sentence(text, start + index * 10)),
});
const textsOf = (passages: readonly (readonly Sentence[])[]): string[][] => passages.map((passage) => passage.map((each) => each.text));

describe("isQuestionHeading", () => {
  it("問いの印で終わる見出しは問い", () => {
    assert.equal(isQuestionHeading("台風の番号はどういう順番で付けるのですか？"), true);
    assert.equal(isQuestionHeading("How Are Hurricanes Named? "), true);
  });

  it("問いの印の後ろの括弧の注記はあってもよい", () => {
    assert.equal(isQuestionHeading("How do I go paperless? (updated Nov. 14, 2024)"), true);
    assert.equal(isQuestionHeading("申し込めますか？（令和6年4月更新）"), true);
  });

  it("Q の札だけでは問いと見ない。四半期の見出しと見分けられない", () => {
    assert.equal(isQuestionHeading("Q1 2024 results"), false);
    assert.equal(isQuestionHeading("Q１　ノロウイルスとは"), false);
    assert.equal(isQuestionHeading("Q&A本文"), false);
  });

  it("問いでない見出しは問いではない", () => {
    assert.equal(isQuestionHeading("はじめに"), false);
    assert.equal(isQuestionHeading("Why? Because (it works)."), false);
    assert.equal(isQuestionHeading(""), false);
  });
});

describe("gramPassagesOf", () => {
  it("問いの見出しがなければ、文書全体で一つの範囲", () => {
    const sections = [section(0, "", ["前置き。"], 0), section(2, "概要", ["一。"], 100), section(2, "詳細", ["二。"], 200)];
    assert.deepEqual(textsOf(gramPassagesOf(sections)), [["前置き。", "一。", "二。"]]);
  });

  it("問いの見出しごとに一つの範囲。より深い見出し（A1）は、その答えに入る", () => {
    const sections = [
      section(1, "Q&A", ["前置き。"], 0),
      section(3, "Q1　何ですか？", [], 100),
      section(4, "A1", ["答え一。"], 200),
      section(3, "Q2　どこですか？", ["答え二。"], 300),
    ];
    assert.deepEqual(textsOf(gramPassagesOf(sections)), [["前置き。"], ["答え一。"], ["答え二。"]]);
  });

  it("同じ深さか浅い問いでない見出しで、答えは閉じる", () => {
    const sections = [section(2, "なぜですか？", ["答え。"], 0), section(2, "まとめ", ["結び。"], 100), section(3, "補足", ["補足。"], 200)];
    assert.deepEqual(textsOf(gramPassagesOf(sections)), [["結び。", "補足。"], ["答え。"]]);
  });

  it("答えの中の問いの見出しは、その下だけを別の範囲にし、外の答えは続く", () => {
    const sections = [
      section(2, "どこですか？", ["外一。"], 0),
      section(3, "なぜですか？", ["内。"], 100),
      section(4, "補足", ["内の補足。"], 200),
      section(3, "手順", ["外二。"], 300),
    ];
    assert.deepEqual(textsOf(gramPassagesOf(sections)), [
      ["外一。", "外二。"],
      ["内。", "内の補足。"],
    ]);
  });

  it("節が無ければ範囲も無い", () => {
    assert.deepEqual(gramPassagesOf([]), []);
  });
});

const worstOf = async (adapter: LanguageAdapter, source: string): Promise<string | undefined> => {
  await adapter.prepare?.({ pos: true });
  const finding = runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "docs/faq").findings.find(
    (each) => each.rule === "ngram-repetition",
  );
  return finding === undefined ? undefined : String(finding.values["word"]);
};

const PLACES = ["川", "山", "海", "森", "畑", "町", "港", "駅"];
const jaFiller = Array.from({ length: 40 }, (_, index) => `資料${String(index)}番号${String(index)}。`).join("");
const jaAnswer = (place: string, index: number): string => `${place}${String(index)}の記録は毎月まとめています。詳しい数値は${place}の観測表をご覧ください。`;

describe("ngram-repetition: よくある質問の答え", () => {
  it("valid: 別々の問いの答えが同じ案内で終わっても数えない", async () => {
    const body = PLACES.map((place, index) => `## ${place}の記録はどこで見られますか？\n\n${jaAnswer(place, index)}`).join("\n\n");
    assert.equal(await worstOf(ja, `# よくある質問\n\n${jaFiller}\n\n${body}\n`), undefined);
  });

  it("invalid: 一つの答えの中の繰り返しは数える", async () => {
    const answer = PLACES.map((place, index) => jaAnswer(place, index)).join("");
    assert.match((await worstOf(ja, `# よくある質問\n\n${jaFiller}\n\n## 記録はどこで見られますか？\n\n${answer}\n`)) ?? "", /記録|ご覧/u);
  });

  it("invalid: 問いでない見出しの節をまたいだ繰り返しは、今までどおり数える", async () => {
    const body = PLACES.map((place, index) => `## ${place}の記録\n\n${jaAnswer(place, index)}`).join("\n\n");
    assert.match((await worstOf(ja, `# 記録の案内\n\n${jaFiller}\n\n${body}\n`)) ?? "", /記録|ご覧/u);
  });

  it("valid: 英語でも、別々の問いの答えの同じ案内は数えない", async () => {
    const filler = Array.from({ length: 50 }, (_, index) => `Zq${String(index)}a Yk${String(index)}b Xm${String(index)}c Wp${String(index)}d.`).join(" ");
    const body = ["rivers", "hills", "coasts", "forests", "fields", "towns", "ports", "stations"]
      .map((topic) => `## Where are the ${topic} records kept?\n\nRecords on ${topic} are filed monthly. Please see the table for the full figures.`)
      .join("\n\n");
    assert.equal(await worstOf(en, `# FAQ\n\n${filler}\n\n${body}\n`), undefined);
  });
});
