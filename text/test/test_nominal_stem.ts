import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { asNounWhereNominal, documentNounKeys, isStemForm, nounKeyOf, withNounsAfterParticles } from "../packages/chaff/src/nominal-stem.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { namedRuleRun } from "./rule-run.ts";

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

  it("する・できるの前の連用形は名詞（申出する）。ほかの動詞の前は動詞のまま", () => {
    const light = [
      at("する", "VERB", { lemma: "する" }),
      at("し", "VERB", { lemma: "する" }),
      at("できる", "VERB", { lemma: "できる" }),
      at("出来る", "VERB", { lemma: "出来る" }),
    ];
    light.forEach((next) => assert.equal(asNounWhereNominal(verb("申出", "申出る"), next).pos, "NOUN"));
    assert.equal(asNounWhereNominal(verb("申出", "申出る"), at("始める", "VERB", { lemma: "始める" })).pos, "VERB");
    assert.equal(asNounWhereNominal(verb("申出", "申出る"), at("ます", "AUX", { lemma: "ます" })).pos, "VERB");
  });

  it("文書がほかで名詞として書く語なら、自立の名詞の前でも名詞（申し出期限）。書かない語は動詞のまま", () => {
    const stem = verb("申し出", "申し出る");
    const withReading = { ...stem, reading: "モウシデ" };
    const deadline = at("期限", "NOUN");
    assert.equal(asNounWhereNominal(withReading, deadline, new Set(), new Set(["申出|モウシデ"])).pos, "NOUN");
    assert.equal(asNounWhereNominal(withReading, deadline, new Set(), new Set(["受取|ウケトリ"])).pos, "VERB");
    assert.equal(asNounWhereNominal(withReading, deadline).pos, "VERB");
    // 漢字の無い語は名詞の一覧と突き合わせない（かかり と 係 は読みが同じでも別の語）。
    const kana = { ...verb("かかり", "かかる"), reading: "カカリ" };
    assert.equal(asNounWhereNominal(kana, at("療養", "NOUN"), new Set(), new Set(["|カカリ", "係|カカリ"])).pos, "VERB");
  });
});

describe("nounKeyOf", () => {
  it("漢字と読み。送り仮名が違っても同じ（申出 と 申し出）", () => {
    assert.equal(nounKeyOf(at("申出", "NOUN", { reading: "モウシデ" })), "申出|モウシデ");
    assert.equal(nounKeyOf(at("申し出", "VERB", { reading: "モウシデ" })), "申出|モウシデ");
  });

  it("漢字の無い語、読みの無い語は無い", () => {
    assert.equal(nounKeyOf(at("かかり", "VERB", { reading: "カカリ" })), undefined);
    assert.equal(nounKeyOf(at("申出", "NOUN")), undefined);
    assert.equal(nounKeyOf(at("", "NOUN", { reading: "" })), undefined);
  });
});

describe("documentNounKeys", () => {
  const read = (surface: string, pos: string, reading: string, extra: Partial<Token> = {}): Token => at(surface, pos, { reading, ...extra });

  it("名詞と、名詞として使った連用形（申出 の前の の）を集める", () => {
    const sentence = [read("申出", "VERB", "モウシデ", { lemma: "申出る" }), read("の", "ADP", "ノ"), read("撤回", "NOUN", "テッカイ")];
    assert.deepEqual(documentNounKeys([sentence]), new Set(["申出|モウシデ", "撤回|テッカイ"]));
  });

  it("動詞として続く連用形（読点の前）、漢字の無い名詞、空の文書は集めない", () => {
    const sentence = [read("申し出", "VERB", "モウシデ", { lemma: "申し出る" }), read("、", "PUNCT", "、"), read("こと", "NOUN", "コト")];
    assert.deepEqual([...documentNounKeys([sentence])], []);
    assert.deepEqual([...documentNounKeys([])], []);
    assert.deepEqual([...documentNounKeys([[]])], []);
  });
});

describe("withNounsAfterParticles", () => {
  const comma = at("、", "PUNCT");
  const stem = verb("取組み", "取組む");
  const posOf = (tokens: readonly Token[]): string[] => withNounsAfterParticles(tokens).map((token) => token.pos);

  it("の や に関する と読点のあいだの連用形は、書いたとおりの名詞（地域の取組み、）", () => {
    ["の", "での", "に関する", "における"].forEach((particle) => {
      const read = withNounsAfterParticles([at("地域", "NOUN"), at(particle, "ADP"), stem, comma]);
      assert.equal(read[2]?.pos, "NOUN");
      assert.equal(read[2]?.lemma, "取組み");
    });
  });

  it("に・を の後、読点でない語の前、連用形でない形、動詞でない語はそのまま（課題に取り組み、）", () => {
    assert.deepEqual(posOf([at("課題", "NOUN"), at("に", "ADP"), verb("取り組み", "取り組む"), comma]), ["NOUN", "ADP", "VERB", "PUNCT"]);
    assert.deepEqual(posOf([at("成果", "NOUN"), at("を", "ADP"), verb("上げ", "上げる"), comma]), ["NOUN", "ADP", "VERB", "PUNCT"]);
    assert.deepEqual(posOf([at("の", "ADP"), stem, at("を", "ADP")]), ["ADP", "VERB", "ADP"]);
    assert.deepEqual(posOf([at("の", "ADP"), verb("取り組ん", "取り組む"), comma]), ["ADP", "VERB", "PUNCT"]);
    assert.deepEqual(posOf([at("の", "ADP"), at("取組み", "VERB"), comma]), ["ADP", "VERB", "PUNCT"]);
    assert.deepEqual(posOf([at("の", "NOUN"), stem, comma]), ["NOUN", "VERB", "PUNCT"]);
    assert.deepEqual(posOf([stem, comma]), ["VERB", "PUNCT"]);
    assert.deepEqual(posOf([at("の", "ADP"), stem]), ["ADP", "VERB"]);
    assert.deepEqual(posOf([]), []);
  });
});

describe("orthographic-variant: の と読点のあいだの連用形", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const findingsOf = (source: string): readonly string[] => namedRuleRun("orthographic-variant", source, ja).findings;

  it("地域の取組み、 は名詞。動詞の 取り組む とは比べない", () => {
    assert.deepEqual(findingsOf("課題に取り組み、成果を上げた。新しい事業に取り組む。研修に取り組みます。地域の取組み、学校の取組みを紹介する。\n"), []);
  });

  it("動詞の 取り組み、 は動詞のまま。名詞の 取組み とは比べず、動詞どうしで比べる", () => {
    assert.deepEqual(findingsOf("学校の取組みを紹介する。地域の取組みは三つある。課題に取り組み、成果を上げた。\n"), []);
    assert.equal(findingsOf("課題に取組み、成果を上げた。新しい事業に取り組む。研修に取り組みます。\n").length, 1);
  });
});
