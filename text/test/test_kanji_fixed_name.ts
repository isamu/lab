import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { repeatedRuns } from "../packages/chaff/src/detectors/titled-run.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 法令・制度・給付の名前は、文のどこにあっても名前。催し・窓口・機関・事業の名前は、文書が繰り返せば名前。
// 例文は自作。名前は法令と白書（政府標準利用規約 2.0、PDL-1.0 互換）に出るものを、文は書き起こした。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs/manual"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

describe("repeatedRuns", () => {
  it("二度以上出る連なりだけ", () => {
    assert.deepEqual([...repeatedRuns(["自衛隊高級幹部会同", "防衛力", "自衛隊高級幹部会同"])], ["自衛隊高級幹部会同"]);
    assert.deepEqual([...repeatedRuns(["新規顧客獲得施策検討会議", "防衛力"])], []);
    assert.deepEqual([...repeatedRuns([])], []);
  });
});

describe("max-kanji-continuous: 法令・制度・給付の名前と、繰り返す名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 法令の名前（施行令、施行規則、〜法）は文の中にあっても数えない", () => {
    assert.deepEqual(kanjiWords("併記できる旧氏は、住民基本台帳法施行令に定める旧氏です。"), []);
    assert.deepEqual(kanjiWords("書式は特許登録令施行規則の様式に従います。"), []);
    assert.deepEqual(kanjiWords("令和3年に施行された改正高年齢者雇用安定法により、就業の確保が努力義務になった。"), []);
  });

  it("valid: 制度・交付金・助成金の名前", () => {
    assert.deepEqual(kanjiWords("勤労者財産形成貯蓄制度の普及を図る。"), []);
    assert.deepEqual(kanjiWords("社会資本整備総合交付金等の活用により、公園を整備する。"), []);
    assert.deepEqual(kanjiWords("常用雇用への移行を特定求職者雇用開発助成金で支える。"), []);
  });

  it("valid: 催しや窓口の名前は、文書が同じ連なりを繰り返せば名前", () => {
    assert.deepEqual(kanjiWords("本日、自衛隊高級幹部会同を開いた。\n\n前回の自衛隊高級幹部会同は十八年前だった。\n", "speech/address"), []);
    assert.deepEqual(kanjiWords("区役所就学事務担当窓口へ相談してください。\n\n書類は区役所就学事務担当窓口で受け取れます。\n"), []);
    assert.deepEqual(kanjiWords("会社が破綻したときは、保険契約者保護機構が補償します。\n\n保険契約者保護機構の補償には上限があります。\n"), []);
    assert.deepEqual(kanjiWords("消費者安全確保地域協議会の設置と、消費者安全確保地域協議会どうしの連携を進める。"), []);
  });

  it("invalid: 一度だけ文の中で使った会議・試験・事業・機関の名前は数える", () => {
    assert.deepEqual(kanjiWords("来週、新規顧客獲得施策検討会議を開きます。"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("情報処理推進機構認定試験の受験者を募ります。"), ["情報処理推進機構認定試験"]);
    assert.deepEqual(kanjiWords("業務効率化推進体制整備事業を進めます。"), ["業務効率化推進体制整備事業"]);
    assert.deepEqual(kanjiWords("業務効率化推進体制整備協議会を開催します。"), ["業務効率化推進体制整備協議会"]);
  });

  it("invalid: 名前を閉じる語で終わらない語の積み重ねは、繰り返しても数える", () => {
    assert.deepEqual(kanjiWords("業務効率化推進体制整備を進めます。\n\n業務効率化推進体制整備は来年度までに終えます。\n"), [
      "業務効率化推進体制整備",
      "業務効率化推進体制整備",
    ]);
    assert.deepEqual(kanjiWords("政治資金規正法改正を進める。"), ["政治資金規正法改正"]);
  });

  it("invalid: 閉じる語が語の切れ目で始まらないか、前の語が短ければ名前と読まない", () => {
    assert.deepEqual(kanjiWords("全社業務改善推進手法を定めます。"), ["全社業務改善推進手法"]);
  });
});
