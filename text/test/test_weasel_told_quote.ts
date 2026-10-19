import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { followsToldQuote, quotationStart } from "../packages/chaff/src/detectors/reported-speech.ts";

// weasel-word: その場で相手から言われた言葉を引用して伝える「と言われている」は、名前の無い大勢の説ではない。例文はすべて自作。

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun("weasel-word", `${source}\n`, adapter, "a.md", "docs/faq").findings;

const CUES = { occasion: ["たら、", "だら、", "ところ、"], sayer: ["から", "より"] };

describe("weasel-word: 言われた場面や言った人を名指す引用", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("申し込んだ場面や言った業者を名指した引用のあとは指さない", () => {
    assert.deepEqual(findingsOf("ローンを申し込んだら、「手数料が先に要る」と言われていますが本当ですか。"), []);
    assert.deepEqual(findingsOf("窓口に問い合わせたところ、「書類が足りない」と言われている。"), []);
    assert.deepEqual(findingsOf("業者から「今日中に払えば安くなる」と言われているのですが、払ってよいですか。"), []);
  });

  it("名指しの無い引用や、引用の無い言い回しは、これまでどおり指す", () => {
    assert.equal(findingsOf("「朝食は一日の要だ」と言われている。").length, 1);
    assert.equal(findingsOf("在宅勤務は生産性を上げると言われています。").length, 1);
    assert.equal(findingsOf("ローンを申し込んだら、審査は厳しいと言われている。").length, 1);
  });

  it("英語の言い回しは変わらない", () => {
    assert.equal(findingsOf("Many experts say remote work raises output.", en).length, 1);
  });

  it("quotationStart: 末尾で閉じる引用の始まり", () => {
    assert.equal(quotationStart("申し込んだら、「先に払え」"), 7);
    assert.equal(quotationStart("彼は「上司は『急げ』と言った」"), 2);
    assert.equal(quotationStart("引用の無い文"), -1);
    assert.equal(quotationStart(""), -1);
    assert.equal(quotationStart("閉じだけ」"), -1);
    assert.equal(quotationStart("申し込んだら、『先に払え」"), -1);
    assert.equal(quotationStart("彼は『上司は「急げ」と言った』"), 2);
  });

  it("followsToldQuote: 引用の前に場面か言った人の目印があるか", () => {
    assert.equal(followsToldQuote("申し込んだら、「先に払え」", CUES), true);
    assert.equal(followsToldQuote("業者から『先に払え』", CUES), true);
    assert.equal(followsToldQuote("「先に払え」", CUES), false);
    assert.equal(followsToldQuote("業者から「先に払え」と聞き、", CUES), false);
    assert.equal(followsToldQuote("申し込んだら、「先に払え」", { occasion: [], sayer: [] }), false);
  });
});
