import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { vocabularyOf as vocabularyOfDocument } from "../packages/chaff/src/detectors/number-word-figure.ts";
import { figureValue, numberOfWords, wordFigureSlips, type NumberVocabulary } from "../packages/chaff/src/structure/number-word-figure.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 文字で書いた数と括弧の数字が違う（number-word-figure-mismatch）。例文はすべて自作。

const RULE = "number-word-figure-mismatch";

const vocabularyOf = (adapter: LanguageAdapter): NumberVocabulary => vocabularyOfDocument(buildDocument("t.md", "x\n", adapter));

const EN = vocabularyOf(en);
const JA = vocabularyOf(ja);

/** The value of words split the way the scan reads them: spaces and hyphens. */
const wordsValue = (written: string, vocabulary: NumberVocabulary): number | undefined => {
  const parts = written.split(/[ -]/u).filter((part) => part !== "");
  const words = parts.flatMap((part) => vocabulary.words.filter((word) => word.word.toLowerCase() === part.toLowerCase()));
  return words.length === parts.length ? numberOfWords(words) : undefined;
};

/** Japanese words are one character each. */
const kanjiValue = (written: string): number | undefined => wordsValue([...written].join(" "), JA);

const slips = (text: string, vocabulary: NumberVocabulary): string[] =>
  wordFigureSlips(text, vocabulary).map((slip) => `${slip.written}=${slip.words}/${slip.figure}`);

describe("numberOfWords: English number words", () => {
  it("reads single words, tens with hyphens, hundreds, scales and 'and'", () => {
    assert.equal(wordsValue("six", EN), 6);
    assert.equal(wordsValue("Thirteen", EN), 13);
    assert.equal(wordsValue("forty-five", EN), 45);
    assert.equal(wordsValue("ninety nine", EN), 99);
    assert.equal(wordsValue("one hundred", EN), 100);
    assert.equal(wordsValue("hundred", EN), 100);
    assert.equal(wordsValue("one hundred and five", EN), 105);
    assert.equal(wordsValue("twelve hundred", EN), 1200);
    assert.equal(wordsValue("Fifty Thousand", EN), 50_000);
    assert.equal(wordsValue("one hundred twenty-five thousand", EN), 125_000);
    assert.equal(wordsValue("one million two hundred thousand", EN), 1_200_000);
    assert.equal(wordsValue("Two Million Five Hundred Thousand and Ten", EN), 2_500_010);
    assert.equal(wordsValue("three billion", EN), 3_000_000_000);
    assert.equal(wordsValue("zero", EN), 0);
  });
  it("does not read words that are not one number", () => {
    assert.equal(numberOfWords([]), undefined);
    assert.equal(wordsValue("five five", EN), undefined);
    assert.equal(wordsValue("one twenty", EN), undefined);
    assert.equal(wordsValue("twenty thirty", EN), undefined);
    assert.equal(wordsValue("twenty zero", EN), undefined);
    assert.equal(wordsValue("thousand", EN), undefined);
    assert.equal(wordsValue("five hundred hundred", EN), undefined);
    assert.equal(wordsValue("one thousand two million", EN), undefined);
    assert.equal(wordsValue("one thousand thousand", EN), undefined);
    assert.equal(wordsValue("and five", EN), undefined);
    assert.equal(wordsValue("five and", EN), undefined);
    assert.equal(wordsValue("one and and two", EN), undefined);
    assert.equal(wordsValue("one and two", EN), undefined);
    assert.equal(wordsValue("one and hundred", EN), undefined);
    assert.equal(wordsValue("one hundred and thousand", EN), undefined);
    assert.equal(wordsValue("two thousand and twenty-six", EN), 2026);
    assert.equal(numberOfWords([{ word: "%", kind: "unit", value: 0 }]), undefined);
    assert.equal(numberOfWords([{ word: "金", kind: "lead", value: 0 }]), undefined);
  });
});

describe("numberOfWords: 漢数字（大字も）", () => {
  it("位取りで読む", () => {
    assert.equal(kanjiValue("三"), 3);
    assert.equal(kanjiValue("十"), 10);
    assert.equal(kanjiValue("十二"), 12);
    assert.equal(kanjiValue("二十一"), 21);
    assert.equal(kanjiValue("百五"), 105);
    assert.equal(kanjiValue("三千五百"), 3500);
    assert.equal(kanjiValue("十二万五千"), 125_000);
    assert.equal(kanjiValue("一億二千万"), 120_000_000);
    assert.equal(kanjiValue("三兆"), 3_000_000_000_000);
  });
  it("大字を読む", () => {
    assert.equal(kanjiValue("参拾万"), 300_000);
    assert.equal(kanjiValue("壱萬"), 10_000);
    assert.equal(kanjiValue("弐阡伍佰"), 2500);
    assert.equal(kanjiValue("壱億弐千参百萬"), 123_000_000);
  });
  it("一つの数になっていない並びは読まない", () => {
    assert.equal(kanjiValue("万"), undefined);
    assert.equal(kanjiValue("万一"), undefined);
    assert.equal(kanjiValue("二〇二六"), undefined);
    assert.equal(kanjiValue("三五"), undefined);
    assert.equal(kanjiValue("百千"), undefined);
    assert.equal(kanjiValue("十二百"), undefined);
    assert.equal(kanjiValue("万億"), undefined);
    assert.equal(kanjiValue("一万億"), undefined);
    assert.equal(kanjiValue("一億万"), undefined);
  });
});

describe("figureValue: the figure in brackets", () => {
  it("reads digits, separators, currency marks, a scale word and a unit", () => {
    assert.equal(figureValue("6", EN), 6);
    assert.equal(figureValue(" 45 ", EN), 45);
    assert.equal(figureValue("$5,000", EN), 5000);
    assert.equal(figureValue("US$50,000.00", EN), 50_000);
    assert.equal(figureValue("$5 million", EN), 5_000_000);
    assert.equal(figureValue("5%", EN), 5);
    assert.equal(figureValue("10 dollars", EN), 10);
    assert.equal(figureValue("300,000円", JA), 300_000);
    assert.equal(figureValue("３", JA), 3);
    assert.equal(figureValue("３００，０００円", JA), 300_000);
    assert.equal(figureValue("¥300,000", JA), 300_000);
    assert.equal(figureValue("3億円", JA), 300_000_000);
    assert.equal(figureValue("5％", JA), 5);
  });
  it("does not read a bracket that holds anything but a figure", () => {
    assert.equal(figureValue("", EN), undefined);
    assert.equal(figureValue("Section 6", EN), undefined);
    assert.equal(figureValue("the Term", EN), undefined);
    assert.equal(figureValue("6 months", EN), undefined);
    assert.equal(figureValue("6) and (7", EN), undefined);
    assert.equal(figureValue("$", EN), undefined);
    assert.equal(figureValue("1,", EN), undefined);
    assert.equal(figureValue("1,2", EN), undefined);
    assert.equal(figureValue("1,0000", EN), undefined);
    assert.equal(figureValue("1..5", EN), undefined);
    assert.equal(figureValue("１，２", JA), undefined);
    assert.equal(figureValue("a", EN), undefined);
    assert.equal(figureValue("ii", EN), undefined);
    assert.equal(figureValue("第6条", JA), undefined);
    assert.equal(figureValue("甲", JA), undefined);
    assert.equal(figureValue("6号", JA), undefined);
  });
});

describe("wordFigureSlips: English", () => {
  it("reports words and a figure that disagree", () => {
    assert.deepEqual(slips("The term is six (7) months.", EN), ["six (7)=6/7"]);
    assert.deepEqual(slips("Pay within thirty (13) days.", EN), ["thirty (13)=30/13"]);
    assert.deepEqual(slips("The fee is Fifty Thousand Dollars ($5,000).", EN), ["Fifty Thousand Dollars ($5,000)=50000/5000"]);
    assert.deepEqual(slips("Notice of forty-five (54) days.", EN), ["forty-five (54)=45/54"]);
    assert.deepEqual(slips("one hundred and five (150) units", EN), ["one hundred and five (150)=105/150"]);
    assert.deepEqual(slips("a rate of ten percent (15%)", EN), ["ten percent (15%)=10/15"]);
    assert.deepEqual(slips("Two Million Dollars ($2 billion)", EN), ["Two Million Dollars ($2 billion)=2000000/2000000000"]);
    assert.deepEqual(slips("six(7) months", EN), ["six(7)=6/7"]);
    assert.deepEqual(slips("Notice of Sixty (60) days and thirty (31) days.", EN), ["thirty (31)=30/31"]);
  });
  it("is silent when they agree", () => {
    assert.deepEqual(slips("The term is six (6) months.", EN), []);
    assert.deepEqual(slips("The fee is Fifty Thousand Dollars ($50,000).", EN), []);
    assert.deepEqual(slips("within forty-five (45) days", EN), []);
    assert.deepEqual(slips("one hundred and five (105) units", EN), []);
    assert.deepEqual(slips("ten percent (10%)", EN), []);
    assert.deepEqual(slips("Five Million Dollars ($5 million)", EN), []);
    assert.deepEqual(slips("Two Thousand Twenty-Six (2026)", EN), []);
  });
  it("is silent when the bracket holds something else, or the words are not a number", () => {
    assert.deepEqual(slips("as set out in Section (6) below", EN), []);
    assert.deepEqual(slips("six (Section 7) months", EN), []);
    assert.deepEqual(slips("the Term (as defined in Section 6)", EN), []);
    assert.deepEqual(slips("in year two (2026) of the term", EN), []);
    assert.deepEqual(slips("Notice is often (2) given.", EN), []);
    assert.deepEqual(slips("someone (1) must sign", EN), []);
    assert.deepEqual(slips("five five (55)", EN), []);
    assert.deepEqual(slips("the parties and (5) others", EN), []);
    assert.deepEqual(slips("Fifty Thousand and 00/100 Dollars ($5,000.00)", EN), []);
    assert.deepEqual(slips("one-half (1/2) of the fee", EN), []);
    assert.deepEqual(slips("(6) months", EN), []);
    assert.deepEqual(slips("", EN), []);
    assert.deepEqual(slips("two (1,)", EN), []);
    assert.deepEqual(slips("one and hundred (1)", EN), []);
    assert.deepEqual(slips(`${"one ".repeat(10_000)}(2)`, EN), []);
    assert.deepEqual(slips(`six${" ".repeat(10_000)}(7)`, EN), []);
    assert.deepEqual(wordFigureSlips("six (7)", { words: [], marksBefore: [], marksAfter: [], multipliers: [] }), []);
  });
});

describe("wordFigureSlips: 日本語", () => {
  it("文字と数字の食い違いを指す", () => {
    assert.deepEqual(slips("対価は金参拾万円（30,000円）とする。", JA), ["参拾万円（30,000円）=300000/30000"]);
    assert.deepEqual(slips("期間は三（4）か月とする。", JA), ["三（4）=3/4"]);
    assert.deepEqual(slips("十二（21）か月", JA), ["十二（21）=12/21"]);
    assert.deepEqual(slips("金壱萬円（1,000円）", JA), ["壱萬円（1,000円）=10000/1000"]);
    assert.deepEqual(slips("年五パーセント（6％）の割合", JA), ["五パーセント（6％）=5/6"]);
    assert.deepEqual(slips("期間は三(4)か月", JA), ["三(4)=3/4"]);
    assert.deepEqual(slips("契約期間十二（11）か月", JA), ["十二（11）=12/11"]);
    assert.deepEqual(slips("契約期間三（4）か月", JA), ["三（4）=3/4"]);
    assert.deepEqual(slips("第三（4）号", JA), ["三（4）=3/4"]);
  });
  it("同じ数なら指さない", () => {
    assert.deepEqual(slips("対価は金参拾万円（300,000円）とする。", JA), []);
    assert.deepEqual(slips("期間は三（3）か月とする。", JA), []);
    assert.deepEqual(slips("金一億二千万円（120,000,000円）", JA), []);
    assert.deepEqual(slips("十二（１２）か月", JA), []);
  });
  it("括弧が数字でないもの、数の語でないものは読まない", () => {
    assert.deepEqual(slips("前条第三項（第6条を除く。）", JA), []);
    assert.deepEqual(slips("書式を統一（2）する", JA), []);
    assert.deepEqual(slips("唯一（2）の方法", JA), []);
    assert.deepEqual(slips("万一（1）の場合", JA), []);
    assert.deepEqual(slips("二〇二六（2025）年", JA), []);
    assert.deepEqual(slips("第（6）号", JA), []);
    assert.deepEqual(slips("その三（甲）", JA), []);
    assert.deepEqual(slips("数十（30）", JA), []);
  });
});

describe("number-word-figure-mismatch through the rule", () => {
  it("reports the message in both languages", () => {
    assert.deepEqual(namedRuleRun(RULE, "# Terms\n\nPay within thirty (13) days.\n", en, "a.md", "legal/contract").findings, [
      '"thirty (13)" says 30 in words and 13 in figures',
    ]);
    assert.deepEqual(namedRuleRun(RULE, "# 契約\n\n対価は金参拾万円（30,000円）とする。\n", ja, "a.md", "legal/contract").findings, [
      "「参拾万円（30,000円）」は、文字では300,000、括弧の数字では30,000です",
    ]);
  });
  it("does not read code", () => {
    assert.deepEqual(namedRuleRun(RULE, "# Terms\n\n```\nsix (7)\n```\n", en, "a.md", "legal/contract").findings, []);
  });
});
