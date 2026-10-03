import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { firedRules, namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 謙譲語を相手に使った形（humble-for-others）と、バイト敬語（baito-keigo）。例文はすべて自作。

const HUMBLE = "humble-for-others";
const BAITO = "baito-keigo";

before(async () => {
  await ja.prepare?.({ pos: true });
});

const findingsOf = (rule: string, source: string, genre = "business/report"): readonly string[] => namedRuleRun(rule, source, ja, "a.md", genre).findings;

/** Every listed form, put in a sentence of its own, is found by its rule. */
const everyEntryMatches = (rule: string): void => {
  const lexicon = ja.lexicons[rule] ?? [];
  assert.ok(lexicon.length > 0);
  lexicon.forEach((entry) => assert.equal(findingsOf(rule, `ここで${entry.pattern}。\n`).length, 1, entry.pattern));
};

describe("humble-for-others: 謙譲語を相手の動作に使う", () => {
  it("謙譲語に「てください」を付けて相手に頼む形", () => {
    assert.deepEqual(findingsOf(HUMBLE, "資料は受付で拝見してください。\n"), ["「拝見してください」は謙譲語を相手の動作に使っています"]);
    assert.deepEqual(findingsOf(HUMBLE, "明日、本社へ伺ってくださいませ。\n"), ["「伺ってください」は謙譲語を相手の動作に使っています"]);
    assert.deepEqual(findingsOf(HUMBLE, "内容をご確認してください。\n"), ["「ご確認してください」は謙譲語を相手の動作に使っています"]);
  });

  it("謙譲語に尊敬の「れる・られる」を付けた形", () => {
    assert.deepEqual(findingsOf(HUMBLE, "部長が申されたとおりです。\n"), ["「申される」は謙譲語を相手の動作に使っています"]);
    assert.deepEqual(findingsOf(HUMBLE, "先生が会場に参られました。\n"), ["「参られる」は謙譲語を相手の動作に使っています"]);
  });

  it("自分の側の謙譲語と、正しい尊敬語は言わない", () => {
    assert.deepEqual(findingsOf(HUMBLE, "私が明日伺います。資料を拝見しました。母が申しておりました。\n"), []);
    assert.deepEqual(findingsOf(HUMBLE, "資料は受付でご覧ください。内容をご確認ください。部長がおっしゃったとおりです。\n"), []);
  });

  it("「窺われる」と同じ字の「伺われる」は言わない", () => {
    assert.deepEqual(findingsOf(HUMBLE, "文面から苦心の跡が伺われる。\n"), []);
  });

  it("語彙表の形は、どれも文の中で当たる", () => everyEntryMatches(HUMBLE));

  it("文学のジャンルでは動かない", () => {
    const source = "資料は受付で拝見してください。\n";
    assert.ok(firedRules(ja, source, "business/report").includes(HUMBLE));
    assert.ok(!firedRules(ja, source, "literature/fiction").includes(HUMBLE));
  });
});

describe("baito-keigo: バイト敬語", () => {
  it("「よろしかったでしょうか」「こちらになります」「円からお預かり」", () => {
    assert.deepEqual(findingsOf(BAITO, "ご注文は以上でよろしかったでしょうか。\n"), ["「でよろしかったでしょうか」はバイト敬語と呼ばれる言い方です"]);
    assert.deepEqual(findingsOf(BAITO, "会議の資料はこちらになります。\n"), ["「こちらになります」はバイト敬語と呼ばれる言い方です"]);
    assert.deepEqual(findingsOf(BAITO, "1万円からお預かりします。\n"), ["「円からお預かり」はバイト敬語と呼ばれる言い方です"]);
  });

  it("変化を言う「になります」と、人から預かる「から」は言わない", () => {
    assert.deepEqual(findingsOf(BAITO, "来月から有料になります。お客様からお預かりした書類を返します。\n"), []);
    assert.deepEqual(findingsOf(BAITO, "ご注文は以上でよろしいでしょうか。会議の資料はこちらです。1万円をお預かりします。\n"), []);
  });

  it("語彙表の形は、どれも文の中で当たる", () => everyEntryMatches(BAITO));

  it("文学と話し言葉のジャンルでは動かない", () => {
    const source = "ご注文は以上でよろしかったでしょうか。\n";
    assert.ok(firedRules(ja, source, "business/report").includes(BAITO));
    ["literature/fiction", "speech/transcript"].forEach((genre) => assert.ok(!firedRules(ja, source, genre).includes(BAITO), genre));
  });
});
