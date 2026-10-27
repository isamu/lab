import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { firedRules } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// no-doubled-joshi and what the writer cannot rephrase: the title of a law, and a bracketed label the parser reads as a
// noun. Statute titles are Japanese law (public domain); the rest is self-written.

const countFor = (source: string): number => firedRules(ja, source).filter((id) => id === "no-doubled-joshi").length;

describe("no-doubled-joshi: a document's title is one noun", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: the の inside a law's title in brackets are not counted", () => {
    // cao-kourei-wp-r06-s2-2-4-seikatsu-kankyo の形。
    assert.equal(countFor("公共交通機関（高齢者、障害者等の移動等の円滑化の促進に関する法律）に基づく基準への適合を進めた。"), 0);
    // gov-online-kodomo-seihigai-boshi の形。
    assert.equal(countFor("（配偶者からの暴力の防止及び被害者の保護等に関する法律）が成立しました。"), 0);
  });

  it("valid: a title without brackets, and a title inside another title", () => {
    // env-wp-r08-yasei-seibutsu-hogo-kanri の形。
    assert.equal(countFor("絶滅のおそれのある野生動植物の種の保存に関する法律の一部を改正する法律が施行されました。"), 0);
  });

  it("invalid: a run outside the title in the same sentence is still reported", () => {
    assert.equal(countFor("個人情報の保護に関する法律に基づき、弊社の新製品の販売の計画を見直しました。"), 1);
  });

  it("invalid: a run that only looks like a title (no kind of document at its end) is still reported", () => {
    assert.equal(countFor("本社の営業部の第二課の方針を確認しました。"), 1);
    assert.equal(countFor("弊社の新製品の販売の計画に関する説明を行いました。"), 1);
  });

  it("invalid: the の after a short title is part of the run, not of the title", () => {
    // env-wp-r08-yasei-seibutsu-hogo-kanri の形。「保存法」の後ろの「の」から続く連なり。
    assert.equal(countFor("今後の種の保存法の在り方の検討を開始しました。"), 1);
  });
});

describe("no-doubled-joshi: a bracket the parser joins to the next word still ends the run", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("valid: a heading in 【】 run together with the body", () => {
    // yuho-e02742-mda の形。「】(」が 1 つの名詞に読まれる。
    assert.equal(countFor("４【財政状態及び経営成績の状況の分析】(1)経営成績等の状況の概要当年度における状況は次のとおりです。"), 0);
  });

  it("invalid: the same words with no bracket between them are still reported", () => {
    assert.equal(countFor("経営成績の状況の分析の概要は次のとおりです。"), 1);
  });

  it("invalid: a percent sign or a half-width middle dot does not end the run", () => {
    assert.equal(countFor("標準体重の120％以上の体重の者の割合も増加しています。"), 1);
    assert.equal(countFor("各学校の教科･科目等の目標･内容の見直しの方針について述べます。"), 1);
  });
});
