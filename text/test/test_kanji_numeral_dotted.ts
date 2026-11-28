import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { leadingDate } from "../packages/chaff/src/detectors/kanji-name-edge.ts";
import { measuredOffOn } from "../scripts/rules-measure-files.ts";

// max-kanji-continuous: 漢数字の日付、序数の付いた組織の単位（第三担当）、中黒の後ろで組織の語で閉じる名前、繰り返す訓練の名前。
// 名前は白書・官報・首相官邸の資料（政府標準利用規約 2.0、PDL-1.0 互換）に出るもの。文は書き起こした。

const RULES = loadRules("ja");
const KANJI_AT_NORMAL = { "max-kanji-continuous": RULES.find((rule) => rule.id === "max-kanji-continuous")?.levels.normal ?? 0 };

const kanjiWords = (source: string, genre = "docs/manual"): string[] =>
  runRules(buildDocument("t.md", source, ja), RULES, measuredOffOn(genre), true, genre, KANJI_AT_NORMAL)
    .findings.filter((finding) => finding.rule === "max-kanji-continuous")
    .map((finding) => String(finding.values?.["word"]));

/** 字ごとに 1 語の並び（語の切れ目がどこにでもある）。 */
const charTokens = (text: string, at = 0): Token[] =>
  [...text].map((surface, index) => ({ surface, span: { start: at + index, end: at + index + 1 }, pos: "NOUN" }));

describe("leadingDate", () => {
  it("月と日までの日付を頭から外す。年は付いても付かなくてもよい。連なりがまるごと日付でもよい", () => {
    assert.deepEqual(leadingDate(charTokens("大正三年十一月二十五日学習院", 10), 10, "大正三年十一月二十五日学習院"), {
      surface: "大正三年十一月二十五日",
      span: { start: 10, end: 21 },
    });
    assert.equal(leadingDate(charTokens("六月十日会議"), 0, "六月十日会議")?.surface, "六月十日");
    assert.equal(leadingDate(charTokens("令和七年六月二十三日"), 0, "令和七年六月二十三日")?.surface, "令和七年六月二十三日");
  });

  it("年だけ、月だけ、日付で始まらない連なり、空、語の切れ目で終わらない日付は外さない", () => {
    assert.equal(leadingDate(charTokens("令和七年度予算"), 0, "令和七年度予算"), undefined);
    assert.equal(leadingDate(charTokens("十一月会議"), 0, "十一月会議"), undefined);
    assert.equal(leadingDate(charTokens("会議六月十日"), 0, "会議六月十日"), undefined);
    assert.equal(leadingDate([], 0, ""), undefined);
    const glued: Token[] = [{ surface: "六月十日会", span: { start: 0, end: 5 }, pos: "NOUN" }];
    assert.equal(leadingDate(glued, 0, "六月十日会議"), undefined);
  });
});

describe("max-kanji-continuous: 日付、序数の付いた単位、中黒の後ろで閉じる名前", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: 漢数字の日付は、算用数字の日付と同じく連なりの外", () => {
    assert.deepEqual(kanjiWords("令和七年六月二十三日\n", "speech/address"), []);
    assert.deepEqual(kanjiWords("――大正三年十一月二十五日学習院輔仁会において述――\n", "speech/address"), []);
  });

  it("invalid: 日付の後ろの長い連なりと、年度で始まる連なりは数える", () => {
    assert.deepEqual(kanjiWords("六月二十三日新規顧客獲得施策検討会議を開く。"), ["新規顧客獲得施策検討会議"]);
    assert.deepEqual(kanjiWords("令和七年度予算執行状況調査結果報告を行う。"), ["令和七年度予算執行状況調査結果報告"]);
  });

  it("valid: 序数で始まる組織の単位（第三担当、第一原子力発電所）", () => {
    assert.deepEqual(kanjiWords("方式審査室第三担当\n"), []);
    assert.deepEqual(kanjiWords("東京電力福島第一原子力発電所の事故から十四年がたった。"), []);
  });

  it("invalid: 序数の後ろが組織の単位で閉じなければ数える", () => {
    assert.deepEqual(kanjiWords("第三回情報処理推進会議の資料です。"), ["第三回情報処理推進会議"]);
    assert.deepEqual(kanjiWords("第三次産業構造改革推進計画策定を行う。"), ["第三次産業構造改革推進計画策定"]);
    assert.deepEqual(kanjiWords("大規模火力発電所建設計画を進める。"), ["大規模火力発電所建設計画"]);
  });

  it("valid: 中黒の後ろで組織の語で閉じる名前の前半", () => {
    assert.deepEqual(kanjiWords("中央環境審議会地球環境部会気候変動影響評価・適応小委員会において検討した。"), []);
    assert.deepEqual(kanjiWords("社会保障審議会企業年金・個人年金部会で議論した。"), []);
    assert.deepEqual(kanjiWords("独立行政法人大学改革支援・学位授与機構において審査する。"), []);
    assert.deepEqual(kanjiWords("総合教育政策局 男女共同参画共生社会学習・安全課 環境教育推進係\n"), []);
  });

  it("invalid: 名前で始まらない前半、組織の語で閉じない中黒の並び", () => {
    assert.deepEqual(kanjiWords("業務効率化推進体制整備・検討委員会を開く。"), ["業務効率化推進体制整備"]);
    assert.deepEqual(kanjiWords("社会保障審議会企業年金・個人年金制度改正を議論した。"), ["社会保障審議会企業年金"]);
  });

  it("訓練の名前は、文書が繰り返せば名前。一度だけなら数える", () => {
    assert.deepEqual(kanjiWords("緊急災害現地対策本部運営訓練を行った。\n\n緊急災害現地対策本部運営訓練は二回目だ。\n"), []);
    assert.deepEqual(kanjiWords("新規顧客獲得施策検討訓練を行った。"), ["新規顧客獲得施策検討訓練"]);
  });

  it("名付けられた地震の名前は、文書が繰り返せば名前。一度だけなら数える", () => {
    assert.deepEqual(kanjiWords("日本海溝・千島海溝周辺海溝型地震を想定した。\n\n日本海溝・千島海溝周辺海溝型地震の対策を進める。\n"), []);
    assert.deepEqual(kanjiWords("日本海溝・千島海溝周辺海溝型地震を想定した。"), ["千島海溝周辺海溝型地震"]);
  });
});
