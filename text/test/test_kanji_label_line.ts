import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { labelsLines } from "../packages/chaff/src/detectors/kanji-name-edge.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 番号や内容の上に一行で置いた名前（窓口の名前と、その下の電話番号）は、書き手が 1 つの名前と示したもの。
// 例文は自作。窓口の名前は政府広報（政府標準利用規約 2.0、PDL-1.0 互換）に出るもの。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "blog/owned-media"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("labelsLines", () => {
  it("後ろに行が続く一行を、連なりと漢字も平仮名も無い語だけで埋める", () => {
    assert.equal(labelsLines("児童相談所虐待対応ダイヤル\n189", 0, 9), true);
    assert.equal(labelsLines("相談先\n性犯罪被害相談電話\n＃8103", 4, 13), true);
  });

  it("平仮名のある行、後ろに行の無い行、平仮名で続く行は見出しの行ではない", () => {
    assert.equal(labelsLines("性犯罪被害相談電話の全国共通番号\n＃8103", 0, 9), false);
    assert.equal(labelsLines("性犯罪被害相談電話", 0, 9), false);
    assert.equal(labelsLines("性犯罪被害相談電話\n", 0, 9), false);
    assert.equal(labelsLines("新規顧客獲得施策検討会議\nを開きます。", 0, 12), false);
    assert.equal(labelsLines("", 0, 0), false);
  });
});

describe("max-kanji-continuous: 番号の上に一行で置いた名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 番号の上の一行の名前は数えず、文書の中で使っても数えない", () => {
    const source = [
      "- 児童相談所虐待対応ダイヤル",
      "189（通話料無料）",
      "最寄りの児童相談所につながります。",
      "",
      "児童相談所虐待対応ダイヤル",
      "189",
      "",
      "性犯罪被害相談電話",
      "＃8103",
      "",
      "最寄りの警察の性犯罪被害相談電話窓口につながります。",
      "",
    ].join("\n");
    assert.deepEqual(kanjiWords(source), []);
  });

  it("invalid: 一行だけの連なりと、文の中で一度だけ使った連なりは数える", () => {
    assert.deepEqual(kanjiWords("性犯罪被害相談電話\n"), ["性犯罪被害相談電話"]);
    assert.deepEqual(kanjiWords("最寄りの警察の性犯罪被害相談電話窓口につながります。\n"), ["性犯罪被害相談電話窓口"]);
    assert.deepEqual(kanjiWords("来週、\n新規顧客獲得施策検討会議\nを開きます。\n"), ["新規顧客獲得施策検討会議"]);
  });
});
