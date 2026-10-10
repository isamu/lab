import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isKanaSlip, isProductSlip, productMentionsIn, type ProductForm, type ProductMention } from "../packages/chaff/src/product-names.ts";

// 製品の名前の書き分け（name-variant の製品の名前）。例文はすべて自作で、製品は架空。

const variants = (source: string): readonly string[] => namedRuleRun("name-variant", source, ja, "a.md").findings;

const FORMS: readonly ProductForm[] = [
  { pattern: "錠", group: "錠" },
  { pattern: "錠剤", group: "錠" },
  { pattern: "粒", group: "粒" },
  { pattern: "顆粒", group: "顆粒" },
  { pattern: "カプセル", group: "カプセル" },
];

const surfaces = (source: string): string[] => productMentionsIn(source, FORMS).map((mention) => `${mention.base}|${mention.form}`);

const product = (base: string, form = "錠"): ProductMention => ({ surface: `${base}${form}`, offset: 0, base, form });

describe("name-variant: 製品の名前の書き分け", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("長音の記号を落とした名前（ミナモール錠 と ミナモル錠）", () => {
    assert.deepEqual(variants("# ミナモール錠\n\nミナモール錠は内服薬です。ミナモル錠を服用したあとは運転をしないでください。\n"), [
      "「ミナモル錠」は、ほかの所で何度も書いた「ミナモール錠」と一字違いです",
    ]);
  });

  it("一字だけ違う名前（ハルカゼクリーム と ハルカセクリーム）", () => {
    assert.deepEqual(
      variants("ハルカゼクリームを薄く塗ります。ハルカゼクリームは目に入れないでください。ハルカセクリームは子どもの手の届かない所に置きます。\n"),
      ["「ハルカセクリーム」は、ほかの所で何度も書いた「ハルカゼクリーム」と一字違いです"],
    );
  });

  it("同じ組の形の語の別の書き方は、同じ製品として数える（ミナモール錠 と ミナモール錠剤）", () => {
    assert.deepEqual(variants("ミナモール錠を飲みます。ミナモール錠剤は苦くありません。ミナモル錠は水で飲みます。\n"), [
      "「ミナモル錠」は、ほかの所で何度も書いた「ミナモール錠」と一字違いです",
    ]);
  });

  it("どちらも一度だけ、二字違い、形の語の違う名前は言わない", () => {
    assert.deepEqual(variants("ミナモール錠とミナモル錠を比べます。\n"), []);
    assert.deepEqual(variants("ミナモール錠を飲みます。ミナモール錠は苦くありません。ミナモリン錠は別の薬です。\n"), []);
    assert.deepEqual(variants("ハルカゼケア粒を与えます。ハルカゼケア粒は一日二回です。ハルカゼケア錠は成犬用です。\n"), []);
    assert.deepEqual(variants("ミナモール錠を飲みます。ミナモール錠は苦くありません。ミナモル顆粒は子ども用です。\n"), []);
  });
});

describe("productMentionsIn", () => {
  it("形の語のすぐ前の 4 字以上のカタカナを名前と読み、長いほうの形の語を取る", () => {
    assert.deepEqual(surfaces("ミナモール錠を飲み、ミナモール錠剤も買う。ハルカゼ顆粒を混ぜる。"), ["ミナモール|錠", "ミナモール|錠", "ハルカゼ|顆粒"]);
  });

  it("短いカタカナ、数の後ろの形の語、長い語の一部の形の語は読まない", () => {
    assert.deepEqual(surfaces("わんぱくケア粒を60粒入れる。"), []);
    assert.deepEqual(surfaces("24錠入り。1粒の重さ。"), []);
    assert.deepEqual(surfaces("ミナモールカプセル化の工程。ミナモール錠剤師。"), []);
    assert.deepEqual(surfaces(""), []);
  });
});

describe("isKanaSlip", () => {
  it("一字の置き換えか、長音の記号一つの有る無し", () => {
    assert.equal(isKanaSlip("ミナモール", "ミナモル"), true);
    assert.equal(isKanaSlip("ミナモル", "ミナモール"), true);
    assert.equal(isKanaSlip("ハルカゼ", "ハルカセ"), true);
  });

  it("同じ名前、二字違い、長音でない字の有る無し、空の名前は違う", () => {
    assert.equal(isKanaSlip("ミナモール", "ミナモール"), false);
    assert.equal(isKanaSlip("ミナモール", "ミナモリン"), false);
    assert.equal(isKanaSlip("ミナモール", "ミナモー"), false);
    assert.equal(isKanaSlip("ミナモール", "ミナモーール"), true);
    assert.equal(isKanaSlip("ミナモール", "ミナモールル"), false);
    assert.equal(isKanaSlip("", ""), false);
    assert.equal(isKanaSlip("", "ー"), true);
  });
});

describe("isProductSlip", () => {
  it("少ないほうが一度だけ、多いほうが二度以上で、形の語の組が同じとき", () => {
    assert.equal(isProductSlip({ mention: product("ミナモル"), count: 1 }, { mention: product("ミナモール"), count: 2 }), true);
    assert.equal(isProductSlip({ mention: product("ミナモル"), count: 1 }, { mention: product("ミナモール"), count: 1 }), false);
    assert.equal(isProductSlip({ mention: product("ミナモル"), count: 2 }, { mention: product("ミナモール"), count: 3 }), false);
    assert.equal(isProductSlip({ mention: product("ミナモル", "粒"), count: 1 }, { mention: product("ミナモール"), count: 2 }), false);
  });
});
