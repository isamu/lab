import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 基金・区域で閉じる名前は置き方を問わず名前、追悼式で閉じる名前は題として置かれたときに名前。例文は自作。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("max-kanji-continuous: 基金・区域・追悼式で閉じる名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 基金・区域で閉じる名前は、文の中で一度だけ使っても数えない", () => {
    assert.deepEqual(kanjiWords("青葉地域医療介護総合確保基金を活用した。\n"), []);
    assert.deepEqual(kanjiWords("全ての特定復興再生拠点区域の避難指示を解除した。\n"), []);
  });

  it("valid: 見出しに置いた追悼式の名前は、文の中でも数えない", () => {
    assert.deepEqual(kanjiWords("# 青葉市全戦没者追悼式の式辞\n\n本日、青葉市全戦没者追悼式が執り行われます。\n"), []);
  });

  it("invalid: 題として置かれていない追悼式の名前と、閉じる語の無い連なりは数える", () => {
    assert.deepEqual(kanjiWords("本日、青葉市全戦没者追悼式が執り行われます。\n"), ["青葉市全戦没者追悼式"]);
    assert.deepEqual(kanjiWords("来週、新規顧客獲得施策検討会議を開きます。\n"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("区域内新規顧客獲得施策を進めます。\n"), ["区域内新規顧客獲得施策"]);
  });
});
