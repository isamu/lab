import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 「〜として認定」の前の区分の名前と、一行だけのお知らせの題の名前は数えない。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 指定された区分の名前と、お知らせの題", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 「として認定・指定・登録」の前の連なりは、制度が決めた区分の名前", () => {
    assert.deepEqual(kanjiWords("青葉市は三施設を認定希少植物保全植物園等として認定している。\n"), []);
    assert.deepEqual(kanjiWords("この湿地は希少野生動植物生息地保護区として指定された。\n"), []);
  });

  it("valid: 一行だけの「〜のお知らせ」「〜のご案内」の題は、送られたままの名前", () => {
    assert.deepEqual(kanjiWords("送信件名\n\n[青葉]本人確認・追加認証設定解除完了のお知らせ\n\n[青葉]本人確認・追加認証設定解除本申請のご案内\n"), []);
  });

  it("invalid: 文の中のお知らせと、区分の名前でない連なりは数える", () => {
    assert.deepEqual(kanjiWords("追加認証設定解除完了のお知らせを送ります。\n"), ["追加認証設定解除完了"]);
    assert.deepEqual(kanjiWords("来週、新規顧客獲得施策検討会議を開きます。\n"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("新規顧客獲得施策検討会議として使う部屋を決めた。\n"), ["新規顧客獲得施策検討会議"]);
  });
});
