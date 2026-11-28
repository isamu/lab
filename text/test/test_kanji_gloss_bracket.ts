import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 語のすぐ後ろの丸括弧の中身がまるごと漢字の連なりなら、前の語の言い換えか展開で、1 つの名前。
// 例文は自作。語は中央教育審議会の答申（政府標準利用規約 2.0、PDL-1.0 互換）と有価証券報告書の指標名に出るもの。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 語の後ろの補いの括弧", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 略語や語のすぐ後ろの丸括弧を埋める連なりは数えない", () => {
    assert.deepEqual(kanjiWords("投資の判断基準としているＥＢＩＴＤＡ＋（減価償却他調整前営業利益）も重要な指標です。"), []);
    assert.deepEqual(kanjiWords("投資の判断基準としているEBITDA（減価償却他調整前営業利益）も重要な指標です。"), []);
    assert.deepEqual(kanjiWords("専修免許状は修士の学位（大学院修士課程修了程度）を基礎資格とする。"), []);
  });

  it("valid: 文書のどこかで補いの括弧に置いた名前は、文の中で使っても数えない", () => {
    assert.deepEqual(kanjiWords("指標にＥＢＩＴＤＡ＋（減価償却他調整前営業利益）を使う。\n\n減価償却他調整前営業利益は前年より増えた。\n"), []);
  });

  it("invalid: 括弧の中に連なりのほかの語や文があるか、括弧が語に付いていなければ数える", () => {
    assert.deepEqual(kanjiWords("専修免許状は修士の学位（大学院修士課程修了程度を想定）を基礎資格とする。"), ["大学院修士課程修了程度"]);
    assert.deepEqual(kanjiWords("会議を開く。（新規顧客獲得施策検討会議）"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("来週、新規顧客獲得施策検討会議を開きます。"), ["新規顧客獲得施策検討会議"]);
  });
});
