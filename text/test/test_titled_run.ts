import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { endsInTitle, isTitledName, isTitlePosition, type TitleWords } from "../packages/chaff/src/detectors/titled-run.ts";
import { trailingPrefix } from "../packages/chaff/src/detectors/counter-edge.ts";
import { prepare, tokenize } from "../packages/lang-ja/src/pos.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

const LEXICONS = loadLexicons();
const WORDS: TitleWords = { endings: (LEXICONS["title-ending"] ?? []).map((entry) => entry.pattern) };

const tokensOf = (text: string): Token[] => {
  const tokens = tokenize(text);
  if (tokens === undefined) throw new Error("形態素解析が用意できていない");
  return tokens;
};

/** 文 text の中の word（最初の 1 つ）が題の置き方をしているか。 */
const placed = (text: string, word: string): boolean => {
  const start = text.indexOf(word);
  return isTitlePosition(text, start, start + word.length);
};

describe("endsInTitle — 漢字の連なりが題の名前を閉じる語で終わるか", () => {
  before(async () => {
    await prepare();
  });

  it("語彙表 title-ending が読める", () => {
    assert.ok(WORDS.endings.includes("要綱"));
    assert.ok(WORDS.endings.includes("試験"));
  });

  it("valid: 要綱・要領・試験・事業・法令・奨励金で終わる（大阪市・会計検査院・文部科学省の公開ページにある名前）", () => {
    assert.ok(endsInTitle(tokensOf("大阪市鶴見区役所公募型比較見積実施要綱"), WORDS));
    assert.ok(endsInTitle(tokensOf("認定職業訓練実施奨励金支給要領"), WORDS));
    assert.ok(endsInTitle(tokensOf("国家公務員中途採用者選考試験"), WORDS));
    assert.ok(endsInTitle(tokensOf("高度統計人材育成強化拠点形成事業"), WORDS));
    assert.ok(endsInTitle(tokensOf("地方自治法"), WORDS));
    assert.ok(endsInTitle(tokensOf("業務委託公募型比較見積等発注案件"), WORDS));
  });

  it("invalid: 閉じる語が語の一部（解決方法の法）、閉じる語の前が 1 字（新法、本事業）、閉じる語で終わらない", () => {
    assert.ok(!endsInTitle(tokensOf("問題解決方法"), WORDS));
    assert.ok(!endsInTitle(tokensOf("新法"), WORDS));
    assert.ok(!endsInTitle(tokensOf("本事業"), WORDS));
    assert.ok(!endsInTitle(tokensOf("新規顧客獲得施策検討会議"), WORDS));
    assert.ok(!endsInTitle(tokensOf("情報処理推進機構認定試験受験者"), WORDS));
    assert.ok(!endsInTitle([], WORDS));
    assert.ok(!endsInTitle(tokensOf("試験"), WORDS));
  });
});

describe("isTitlePosition — 連なりが題の名前の置き方をしているか", () => {
  it("valid: 括弧の中身を閉じる（鉤括弧、二重鉤括弧、隅付き括弧）", () => {
    assert.ok(placed("「令和8年度高度統計人材育成強化拠点形成事業」について公募します。", "高度統計人材育成強化拠点形成事業"));
    assert.ok(placed("『地域交流推進計画』を読む。", "地域交流推進計画"));
    assert.ok(placed("【浪速区役所公募型比較見積】消火器の買入", "浪速区役所公募型比較見積"));
  });

  it("valid: すぐ後ろに補いの括弧が付く（全角と半角）", () => {
    assert.ok(placed("国家公務員中途採用者選考試験（就職氷河期世代）を活用します。", "国家公務員中途採用者選考試験"));
    assert.ok(placed("大阪市鶴見区公募型比較見積実施要綱(PDF形式, 327.89KB)", "大阪市鶴見区公募型比較見積実施要綱"));
  });

  it("valid: 文がその連なりだけ（前後の空白は見ない）", () => {
    assert.ok(placed("大阪市鶴見区役所公募型比較見積実施要綱", "大阪市鶴見区役所公募型比較見積実施要綱"));
    assert.ok(placed(" 業務委託公募型比較見積等発注案件\n", "業務委託公募型比較見積等発注案件"));
  });

  it("invalid: 文の中で語として使う、括弧の途中で終わる、括弧を開く前にある", () => {
    assert.ok(!placed("情報処理推進機構認定試験の受験者が増えました。", "情報処理推進機構認定試験"));
    assert.ok(!placed("「情報処理推進機構認定試験の案内」を読む。", "情報処理推進機構認定試験"));
    assert.ok(!placed("新規顧客獲得施策検討計画を「案」として出す。", "新規顧客獲得施策検討計画"));
    assert.ok(!placed("要綱は大阪市鶴見区公募型比較見積実施要綱です。", "大阪市鶴見区公募型比較見積実施要綱"));
    assert.ok(!placed("閉じない「地域交流推進計画", "地域交流推進計画"));
  });
});

describe("isTitledName — 文書の中で題として置かれた名前か", () => {
  it("valid: 同じ名前、または名前の終わりの部分（年度の付いた題と、年度を外した使い方）", () => {
    assert.ok(isTitledName("認定職業訓練実施奨励金", ["認定職業訓練実施奨励金"]));
    assert.ok(isTitledName("高度統計人材育成強化拠点形成事業", ["年度高度統計人材育成強化拠点形成事業"]));
  });

  it("invalid: 題として置かれた名前が無い、名前の頭だけ、違う名前", () => {
    assert.ok(!isTitledName("認定職業訓練実施奨励金", []));
    assert.ok(!isTitledName("認定職業訓練実施", ["認定職業訓練実施奨励金"]));
    assert.ok(!isTitledName("情報処理推進機構認定試験", ["国家公務員中途採用者選考試験"]));
  });
});

describe("trailingPrefix — 連なりの尻の、すぐ後ろの数に付く接頭の語", () => {
  const tailOf = (text: string, run: string): string | undefined => trailingPrefix(tokensOf(text), text.indexOf(run) + run.length, run)?.surface;

  it("valid: 施行令第172条の第", () => {
    assert.equal(tailOf("地方自治法施行令第172条を参照", "地方自治法施行令第"), "第");
  });

  it("invalid: 数が続かない、接頭の語でない、連なりの尻でない", () => {
    assert.equal(tailOf("地方自治法施行令第一条を参照", "地方自治法施行令第一条"), undefined);
    assert.equal(tailOf("地方自治法施行令を参照", "地方自治法施行令"), undefined);
    assert.equal(tailOf("会議室2を使う", "会議室"), undefined);
    assert.equal(trailingPrefix([], 0, ""), undefined);
  });
});
