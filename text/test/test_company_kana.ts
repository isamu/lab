import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isKanaWordSlip, type CompanyMention } from "../packages/chaff/src/company-names.ts";
import { kanaSpelledCompanies, kanaSpellingsOf, kanjiReadingOf, type ReadWord } from "../packages/chaff/src/company-kana-spelling.ts";

// 会社の名前の、かなの一字違いと、漢字一字をその読みのかなで書いた所（name-variant）。例文はすべて自作。

const variants = (source: string): readonly string[] => namedRuleRun("name-variant", source, ja, "a.md").findings;

const company = (surface: string, base: string, position: "before" | "after", offset = 0): CompanyMention => ({
  surface,
  base,
  form: "株式会社",
  position,
  offset,
});

const PARTICLES: readonly string[] = ["は", "と", "における"];

const word = (start: number, surface: string, reading: string | undefined): ReadWord => ({ start, end: start + surface.length, surface, reading });

describe("name-variant: 漢字を含む会社名の、かなの違い", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("漢字一字を、その読みのかなで書いた会社名（みどり野生命保険 と みどりの生命保険）", () => {
    assert.deepEqual(
      variants("# 契約概要\n\nみどり野生命保険株式会社\n\nみどり野生命保険株式会社の医療保険です。\n\nみどりの生命保険株式会社 お客さまサービスセンター\n"),
      ["「みどりの生命保険株式会社」は、ほかの所では「みどり野生命保険株式会社」と書いています（名前の漢字一字を、その読みのかなで書いた違い）"],
    );
  });

  it("かなで書いたほうが二度、漢字のほうが一度なら指さない", () => {
    assert.deepEqual(variants("# 契約概要\n\nみどり野生命保険株式会社\n\nみどりの生命保険株式会社です。みどりの生命保険株式会社まで。\n"), []);
  });

  it("漢字を含む会社名の、かなの語の中の一字違い（コモレビ電機 と コモレピ電機）", () => {
    assert.deepEqual(variants("# 保証書\n\nコモレビ電機株式会社\n\nコモレビ電機株式会社が修理します。\n\nコモレピ電機株式会社 お客様相談室\n"), [
      "「コモレピ電機株式会社」は、ほかの所で書いた会社名「コモレビ電機株式会社」と一字違いです",
    ]);
  });

  it("漢字の一字違い、一度ずつの書き分け、短いかなの語、名前の違う二つの会社は指さない", () => {
    assert.deepEqual(variants("# 保証書\n\n日本電気株式会社\n\n日本電気株式会社が修理します。日本電機株式会社まで。\n"), []);
    assert.deepEqual(variants("# 保証書\n\nコモレビ電機株式会社が修理します。コモレピ電機株式会社まで。\n"), []);
    assert.deepEqual(variants("# 保証書\n\nサンワ電機株式会社\n\nサンワ電機株式会社が修理します。サンヨ電機株式会社まで。\n"), []);
    assert.deepEqual(variants("# 保証書\n\nコモレビ電機株式会社\n\nコモレビ電機株式会社が製造し、アオバ電機株式会社が販売します。\n"), []);
  });
});

describe("isKanaWordSlip", () => {
  it("漢字を含む名前の、四字以上のかなの語の中のかな一字違い", () => {
    assert.equal(isKanaWordSlip("コモレビ電機", "コモレピ電機"), true);
    assert.equal(isKanaWordSlip("こもれび電機", "こもれぴ電機"), true);
    assert.equal(isKanaWordSlip("コモレビ電機", "コモレ電機"), true);
    assert.equal(isKanaWordSlip("コモレビ電機", "コモビレ電機"), true);
    assert.equal(isKanaWordSlip("電機コモレビ", "電機コモレピ"), true);
  });

  it("漢字の違い、短いかなの語、漢字の無い名前、二字以上の違い、同じ名前は見ない", () => {
    assert.equal(isKanaWordSlip("日本電気", "日本電機"), false);
    assert.equal(isKanaWordSlip("こもれび電機", "こもれび電器"), false);
    assert.equal(isKanaWordSlip("サンワ電機", "サンヨ電機"), false);
    assert.equal(isKanaWordSlip("コモレビ", "コモレピ"), false);
    assert.equal(isKanaWordSlip("コモレビ電機", "コモレピ電器"), false);
    assert.equal(isKanaWordSlip("コモレビ電機", "アオバ電機"), false);
    assert.equal(isKanaWordSlip("コモレビ電機", "コモレビ電機"), false);
    assert.equal(isKanaWordSlip("ABCD電機", "ABCE電機"), false);
    assert.equal(isKanaWordSlip("コモレビ電機", "コモレB電機"), false);
    assert.equal(isKanaWordSlip("コモレビ電機", "コモレ電電機"), false);
    assert.equal(isKanaWordSlip("", ""), false);
  });
});

describe("kanjiReadingOf", () => {
  it("かなと漢字一字の語の、漢字の読み", () => {
    assert.deepEqual(kanjiReadingOf("みどり野", "ミドリノ"), { index: 3, kanji: "野", reading: "ノ" });
    assert.deepEqual(kanjiReadingOf("野", "ノ"), { index: 0, kanji: "野", reading: "ノ" });
    assert.deepEqual(kanjiReadingOf("あお葉みどり", "アオバミドリ"), { index: 2, kanji: "葉", reading: "バ" });
  });

  it("漢字二字以上の語、漢字の無い語、読みの無い語、かなが読みに合わない語は読まない", () => {
    assert.equal(kanjiReadingOf("生命", "セイメイ"), undefined);
    assert.equal(kanjiReadingOf("みどり", "ミドリ"), undefined);
    assert.equal(kanjiReadingOf("みどり野", undefined), undefined);
    assert.equal(kanjiReadingOf("みどり野", "ミドリ"), undefined);
    assert.equal(kanjiReadingOf("みどり野", "アオバノ"), undefined);
    assert.equal(kanjiReadingOf("A野", "エーノ"), undefined);
    assert.equal(kanjiReadingOf("", ""), undefined);
  });
});

describe("kanaSpellingsOf と kanaSpelledCompanies", () => {
  const midori = company("みどり野生命保険株式会社", "みどり野生命保険", "after");
  const words = [word(0, "みどり野", "ミドリノ"), word(4, "生命", "セイメイ"), word(6, "保険", "ホケン"), word(8, "株式会社", "カブシキガイシャ")];

  it("漢字一字を、その読みのひらがなかカタカナで書いた形", () => {
    assert.deepEqual(kanaSpellingsOf(midori, words), ["みどりの生命保険株式会社", "みどりノ生命保険株式会社"]);
    assert.deepEqual(kanaSpellingsOf(company("株式会社みどり野", "みどり野", "before"), [word(4, "みどり野", "ミドリノ")]), [
      "株式会社みどりの",
      "株式会社みどりノ",
    ]);
    assert.deepEqual(kanaSpellingsOf(midori, []), []);
  });

  it("二度書いた名前を、かなで一度だけ書いた所", () => {
    const source = "みどり野生命保険株式会社。みどり野生命保険株式会社。当社はみどりの生命保険株式会社です。";
    const mentions = [midori, { ...midori, offset: 13 }];
    assert.deepEqual(kanaSpelledCompanies(source, mentions, words, PARTICLES), [
      { surface: "みどりの生命保険株式会社", offset: 29, usual: "みどり野生命保険株式会社" },
    ]);
  });

  it("一度だけの名前、二度あるかな、名前の続きの中のかなは指さない", () => {
    const once = "みどり野生命保険株式会社。みどりの生命保険株式会社。";
    assert.deepEqual(kanaSpelledCompanies(once, [midori], words, PARTICLES), []);
    const twice = "みどり野生命保険株式会社。みどり野生命保険株式会社。みどりの生命保険株式会社、みどりの生命保険株式会社。";
    assert.deepEqual(kanaSpelledCompanies(twice, [midori, { ...midori, offset: 13 }], words, PARTICLES), []);
    const longer = "みどり野生命保険株式会社。みどり野生命保険株式会社。東京みどりの生命保険株式会社。";
    assert.deepEqual(kanaSpelledCompanies(longer, [midori, { ...midori, offset: 13 }], words, PARTICLES), []);
    const hiraganaHead = "みどり野生命保険株式会社。みどり野生命保険株式会社。あおいみどりの生命保険株式会社。";
    assert.deepEqual(kanaSpelledCompanies(hiraganaHead, [midori, { ...midori, offset: 13 }], words, PARTICLES), []);
  });

  it("形の語が前に立つ名前: 後ろのひらがなは、助詞で始まるときだけ名前の外", () => {
    const leading = company("株式会社みどり野", "みどり野", "before");
    const leadingWords = [word(4, "みどり野", "ミドリノ")];
    const twice = "株式会社みどり野。株式会社みどり野。";
    assert.deepEqual(kanaSpelledCompanies(`${twice}株式会社みどりのは`, [leading, { ...leading, offset: 9 }], leadingWords, PARTICLES), [
      { surface: "株式会社みどりの", offset: 18, usual: "株式会社みどり野" },
    ]);
    assert.deepEqual(kanaSpelledCompanies(`${twice}株式会社みどりのかぜ。`, [leading, { ...leading, offset: 9 }], leadingWords, PARTICLES), []);
    assert.deepEqual(kanaSpelledCompanies(`${twice}株式会社みどりの電機。`, [leading, { ...leading, offset: 9 }], leadingWords, PARTICLES), []);
  });
});
