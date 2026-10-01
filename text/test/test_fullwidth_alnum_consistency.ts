import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 英数字の全角と半角の混在（fullwidth-alnum-consistency）。例文はすべて自作。

const RULE = "fullwidth-alnum-consistency";

const findingsOf = (source: string): readonly string[] => namedRuleRun(RULE, source, ja).findings;

// 数字の並びを半角で書いた段落。
const PLAIN = "申込は2024年10月15日までです。説明会は2024年11月20日に開きます。会場は12階です。定員は5人で、3回に分け、2部屋と4部屋を使います。\n\n";

describe("fullwidth-alnum-consistency: 英数字の全角と半角が混ざっている", () => {
  it("半角の文書の中の全角の数字の並び", () => {
    assert.deepEqual(findingsOf(`${PLAIN}締切は２０２４年です。\n`), [
      "全角の「２０２４」と書いています（この文書はふつう半角の「2024」。8 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("全角の文書の中の半角（少ないほうを指摘する。どちらが正しいかは決めない）", () => {
    assert.deepEqual(findingsOf("会場は１２階です。受付は１５時です。控室は１３号室です。予備は14号室です。\n"), [
      "半角の「14」と書いています（この文書はふつう全角の「１４」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("英字の語も比べる", () => {
    assert.deepEqual(findingsOf("URL を開き、ID を入れ、PDF を保存します。ＵＲＬは変わります。\n"), [
      "全角の「ＵＲＬ」と書いています（この文書はふつう半角の「URL」。4 箇所のうち 1 箇所が違う）",
    ]);
  });

  it("英字と数字は別に比べる（英字は半角、数字は全角でそろえた文書）", () => {
    assert.deepEqual(findingsOf("URL と ID を使います。会場は１２階、受付は１５時、控室は１３号室、予備は１４号室、倉庫は１６号室です。\n"), []);
  });

  it("全角と半角が混ざった並び（Ｈ30）は数えない", () => {
    assert.deepEqual(findingsOf("ＵＲＬとＩＤとＰＤＦとＨ30を使います。\n"), []);
  });

  it("一字と二字以上は別に比べる（１桁は全角、２桁以上は半角の決まり）", () => {
    assert.deepEqual(findingsOf("第１条から第12条まで、第３条と第15条を読みます。\n"), []);
  });

  it("少ないほうが三分の一を超えれば、使い分けと見て言わない", () => {
    assert.deepEqual(findingsOf("会場は１２階です。受付は15時です。\n"), []);
  });

  it("項目と注の番号、箇条書きの頭の番号は数えない", () => {
    assert.deepEqual(findingsOf(`${PLAIN}（１）を見ます。※３も見ます。\n\n１．はじめに\n\n- ４「勧告」の考え方\n`), []);
  });

  it("メールアドレスとドメイン名は数えない", () => {
    assert.deepEqual(
      findingsOf("ＩＤを入れ、ＰＤＦを保存し、ＡＰＩを使い、ＣＳＶとＸＭＬとＨＴＭＬとＪＳＯＮとＳＱＬを送ります。連絡先はsupport@example.comです。\n"),
      [],
    );
  });

  it("鉤括弧で引いたものの中は数えない", () => {
    assert.deepEqual(findingsOf(`${PLAIN}画面には「２０２４年度」と出ます。\n`), []);
  });

  it("そろっていれば何も言わない", () => {
    assert.deepEqual(findingsOf(PLAIN), []);
  });

  it("英語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "A plain sentence.\n", en).skipped, ["not a rule for en"]);
  });
});
