import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { asNounWhereNominal, isStemForm } from "../packages/chaff/src/nominal-stem.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";

// 動詞の連用形が名詞として使われているか（nominal-stem.ts）。例はすべて自作。

const at = (surface: string, pos: string, extra: Partial<Token> = {}): Token => ({ span: { start: 0, end: surface.length }, surface, pos, ...extra });
const verb = (surface: string, lemma: string): Token => at(surface, "VERB", { lemma });

describe("isStemForm", () => {
  it("五段と一段の連用形", () => {
    assert.equal(isStemForm("払い込み", "払い込む"), true);
    assert.equal(isStemForm("買取り", "買取る"), true);
    assert.equal(isStemForm("申出", "申出る"), true);
    assert.equal(isStemForm("話し", "話す"), true);
  });

  it("連用形でない形と、短すぎる語、空の語", () => {
    assert.equal(isStemForm("ください", "下さる"), false);
    assert.equal(isStemForm("払い込ん", "払い込む"), false);
    assert.equal(isStemForm("払い込む", "払い込む"), false);
    assert.equal(isStemForm("払い込め", "払い込む"), false);
    assert.equal(isStemForm("", "る"), false);
    assert.equal(isStemForm("", ""), false);
    assert.equal(isStemForm("あ", "あ"), false);
  });
});

describe("asNounWhereNominal", () => {
  it("助詞・括弧・接尾の語・句点・文の終わりの前の連用形は、書いたとおりの名詞", () => {
    const nextTokens = [at("の", "ADP"), at("）", "PUNCT"), at("等", "NOUN", { features: { Bound: "Yes" } }), at("。", "PUNCT"), undefined];
    nextTokens.forEach((next) => {
      const token = asNounWhereNominal(verb("払込み", "払込む"), next);
      assert.equal(token.pos, "NOUN");
      assert.equal(token.lemma, "払込み");
    });
  });

  it("動詞が続く形（読点、て、ます、動詞、形容詞、自立の名詞）の前は動詞のまま", () => {
    const goesOn = [
      at("、", "PUNCT"),
      at("，", "PUNCT"),
      at(",", "PUNCT"),
      at("て", "SCONJ"),
      at("ます", "AUX"),
      at("始める", "VERB"),
      at("やすい", "ADJ"),
      at("療養", "NOUN"),
    ];
    goesOn.forEach((next) => assert.equal(asNounWhereNominal(verb("払込み", "払込む"), next).pos, "VERB"));
  });

  it("接尾として渡した名詞（受取り前 の 前）の前は名詞。渡していない名詞の前は動詞のまま", () => {
    const before = at("前", "NOUN");
    assert.equal(asNounWhereNominal(verb("受取り", "受取る"), before, new Set(["前"])).pos, "NOUN");
    assert.equal(asNounWhereNominal(verb("受取り", "受取る"), before, new Set(["後"])).pos, "VERB");
  });

  it("動詞でないもの、辞書の形、連用形でない形、lemma の無いものはそのまま", () => {
    const next = at("の", "ADP");
    const unchanged = [at("期日", "NOUN", { lemma: "期日" }), verb("払い込む", "払い込む"), verb("ください", "下さる"), at("払込み", "VERB")];
    unchanged.forEach((token) => assert.equal(asNounWhereNominal(token, next), token));
  });
});
