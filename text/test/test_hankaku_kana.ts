import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { halfwidthKanaRuns } from "../packages/chaff/src/detectors/hankaku-kana.ts";

// 半角の片仮名（hankaku-kana）。例文はすべて自作。

const RULE = "hankaku-kana";

const findingsOf = (source: string, path = "a.md"): readonly string[] => namedRuleRun(RULE, source, ja, path).findings;

const runsIn = (source: string): string[] => halfwidthKanaRuns(source, [{ start: 0, end: source.length }]).map((run) => run.written);

describe("hankaku-kana: 半角の片仮名がある", () => {
  it("半角の片仮名の並びを一つとして言い、全角の形を添える", () => {
    assert.deepEqual(findingsOf("申込書はﾒｰﾙで送ってください。\n"), ["半角の片仮名「ﾒｰﾙ」があります（全角は「メール」）"]);
  });

  it("濁点と半濁点は前の字と合わせて全角にする", () => {
    assert.deepEqual(findingsOf("ﾃﾞｰﾀをﾊﾟｿｺﾝに入れます。\n"), [
      "半角の片仮名「ﾃﾞｰﾀ」があります（全角は「データ」）",
      "半角の片仮名「ﾊﾟｿｺﾝ」があります（全角は「パソコン」）",
    ]);
  });

  it("半角の中黒と句読点も数える", () => {
    assert.deepEqual(runsIn("財形貯蓄･年金貯蓄､それから｢書類｣｡"), ["･", "､", "｢", "｣｡"]);
  });

  it("見出しと表の中も数える", () => {
    assert.deepEqual(findingsOf("# ﾒﾆｭｰ\n\n| 項目 | 内容 |\n| --- | --- |\n| ｶﾅ | 本文 |\n").length, 2);
  });

  it("鉤括弧や引用符で引いた画面の表示は数えない", () => {
    assert.deepEqual(runsIn('画面に「ｶﾅ表示」と出ます。"ﾃｽﾄ" とも出ます。'), []);
  });

  it("コードとリンクの中は数えない", () => {
    assert.deepEqual(findingsOf("設定は `ｶﾅ` です。[ﾒｰﾙ](https://example.jp/) を見てください。\n\n```\nｱｲｳ\n```\n"), []);
  });

  it("全角の片仮名だけなら何も言わない", () => {
    assert.deepEqual(findingsOf("申込書はメールで送ってください。\n"), []);
  });

  it("空の文書", () => {
    assert.deepEqual(runsIn(""), []);
  });

  it("英語の文書では動かず、理由を言う", () => {
    assert.deepEqual(namedRuleRun(RULE, "A plain sentence.\n", en).skipped, ["not a rule for en"]);
  });
});
