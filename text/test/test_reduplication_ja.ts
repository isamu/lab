import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distributiveVocabulary,
  isInflectedEcho,
  markReduplication,
  type Distributive,
  type Inflection,
  type ReadsAsAdverb,
} from "../packages/lang-ja/src/reduplication.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { prepare, readsAsOneAdverb } from "../packages/lang-ja/src/pos.ts";

const VOCABULARY: Distributive = { nouns: new Set(["会社", "一", "繰り返し"]), particles: new Set(["で", "の"]) };

/** 語を隙間なく並べた token。 */
const tokensOf = (...words: readonly (readonly [string, string])[]): Token[] =>
  words.reduce<Token[]>((acc, [surface, pos]) => {
    const start = acc.at(-1)?.span.end ?? 0;
    return [...acc, { span: { start, end: start + surface.length }, surface, pos }];
  }, []);

/** 副詞と読む文字列を決め打ちした読み直し。解析器を使わずに判定だけを見る。 */
const adverbs =
  (...words: readonly string[]): ReadsAsAdverb =>
  (text) =>
    words.includes(text);
const NO_ADVERB = adverbs();

const echoes = (tokens: readonly Token[], readsAsAdverb: ReadsAsAdverb = NO_ADVERB): string[] =>
  markReduplication(tokens, VOCABULARY, readsAsAdverb).flatMap((token) =>
    token.features?.["Echo"] === "Rdp" ? [`${token.surface}@${String(token.span.start)}`] : [],
  );

describe("markReduplication", () => {
  it("語彙表の名詞を重ねて語彙表の助詞が続けば、二つ目に Echo=Rdp を付ける", () => {
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"], ["で", "ADP"])), ["会社@2"]);
  });

  it("語彙表に無い名詞は、助詞が続いても付けない（資料資料の）", () => {
    assert.deepEqual(echoes(tokensOf(["資料", "NOUN"], ["資料", "NOUN"], ["の", "ADP"])), []);
  });

  it("続くのが語彙表に無い助詞や動詞なら付けない", () => {
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"], ["を", "ADP"])), []);
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"], ["する", "VERB"])), []);
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"])), []);
  });

  it("名詞でない語、違う名詞、離れた名詞、離れた助詞、助詞でない語には付けない", () => {
    assert.deepEqual(echoes(tokensOf(["会社", "VERB"], ["会社", "VERB"], ["で", "ADP"])), []);
    assert.deepEqual(echoes(tokensOf(["繰り返し", "VERB"], ["繰り返し", "NOUN"], ["の", "ADP"])), []);
    assert.deepEqual(echoes(tokensOf(["繰り返し", "NOUN"], ["会社", "NOUN"], ["で", "ADP"])), []);
    const apart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "会社", pos: "NOUN" },
      { span: { start: 3, end: 5 }, surface: "会社", pos: "NOUN" },
      { span: { start: 5, end: 6 }, surface: "で", pos: "ADP" },
    ];
    assert.deepEqual(echoes(apart), []);
    const particleApart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "会社", pos: "NOUN" },
      { span: { start: 2, end: 4 }, surface: "会社", pos: "NOUN" },
      { span: { start: 5, end: 6 }, surface: "で", pos: "ADP" },
    ];
    assert.deepEqual(echoes(particleApart), []);
    assert.deepEqual(echoes(tokensOf(["会社", "NOUN"], ["会社", "NOUN"], ["で", "AUX"])), []);
  });

  it("元の features は残す", () => {
    const tokens: Token[] = [
      { span: { start: 0, end: 1 }, surface: "一", pos: "NOUN" },
      { span: { start: 1, end: 2 }, surface: "一", pos: "NOUN", features: { NumType: "Card" } },
      { span: { start: 2, end: 3 }, surface: "の", pos: "ADP" },
    ];
    assert.deepEqual(markReduplication(tokens, VOCABULARY, NO_ADVERB)[1]?.features, { NumType: "Card", Echo: "Rdp" });
  });

  it("同じ内容語が接して続き、続けて読み直すと一語の副詞なら、二つ目に Echo=Rdp を付ける（がんがん）", () => {
    const readsGangan = adverbs("がんがん");
    assert.deepEqual(echoes(tokensOf(["が", "ADP"], ["がん", "NOUN"], ["がん", "NOUN"], ["じゃ", "ADP"]), readsGangan), ["がん@3"]);
    assert.deepEqual(echoes(tokensOf(["ずる", "VERB"], ["ずる", "VERB"]), adverbs("ずるずる")), ["ずる@2"]);
    assert.deepEqual(echoes(tokensOf(["ほそ", "ADJ"], ["ほそ", "ADJ"]), adverbs("ほそほそ")), ["ほそ@2"]);
  });

  it("読み直しても副詞でない、機能語、品詞が違う、表層が違う、離れている重なりには付けない", () => {
    assert.deepEqual(echoes(tokensOf(["資料", "NOUN"], ["資料", "NOUN"]), adverbs("がんがん")), []);
    assert.deepEqual(echoes(tokensOf(["た", "AUX"], ["た", "AUX"]), adverbs("たた")), []);
    assert.deepEqual(echoes(tokensOf(["や", "ADP"], ["や", "ADP"]), adverbs("やや")), []);
    assert.deepEqual(echoes(tokensOf(["がん", "NOUN"], ["がん", "VERB"]), adverbs("がんがん")), []);
    assert.deepEqual(echoes(tokensOf(["がん", "NOUN"], ["ガン", "NOUN"]), adverbs("がんガン", "がんがん")), []);
    const apart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "がん", pos: "NOUN" },
      { span: { start: 3, end: 5 }, surface: "がん", pos: "NOUN" },
    ];
    assert.deepEqual(echoes(apart, adverbs("がんがん")), []);
  });

  it("空の並びと、語彙表の無い言語", () => {
    assert.deepEqual(markReduplication([], VOCABULARY, NO_ADVERB), []);
    const none = distributiveVocabulary({});
    assert.deepEqual([...none.nouns, ...none.particles], []);
    const read = distributiveVocabulary({ "distributive-noun": [{ pattern: "会社" }], "distributive-particle": [{ pattern: "で" }] });
    assert.deepEqual([[...read.nouns], [...read.particles]], [["会社"], ["で"]]);
  });
});

describe("readsAsOneAdverb", () => {
  before(async () => {
    await prepare();
  });

  it("その文字列だけを解析器が一語の副詞と読めば true", () => {
    assert.equal(readsAsOneAdverb("がんがん"), true);
  });

  it("二語以上に切れる、一語でも副詞でない、空の文字列は false", () => {
    assert.equal(readsAsOneAdverb("資料資料"), false);
    assert.equal(readsAsOneAdverb("ややや"), false);
    assert.equal(readsAsOneAdverb("もも"), false);
    assert.equal(readsAsOneAdverb(""), false);
  });
});

/** 語を隙間なく並べた、解析器の読み。[表層, 品詞, 細分類, 活用形]。 */
const wordsOf = (...words: readonly (readonly [string, string, string, string])[]): Inflection[] =>
  words.reduce<Inflection[]>((acc, [surface, pos, detail, form]) => {
    const last = acc.at(-1);
    const start = last === undefined ? 0 : last.start + last.surface.length;
    return [...acc, { surface, pos, detail, form, start }];
  }, []);

const echoAt = (words: readonly Inflection[]): number[] => words.flatMap((_, index) => (isInflectedEcho(words, index) ? [index] : []));

const TO: readonly [string, string, string, string] = ["と", "助詞", "格助詞", "*"];

describe("isInflectedEcho", () => {
  it("自立の動詞・形容詞を連用形か命令形のまま重ねれば、二つ目が重ね言葉", () => {
    assert.deepEqual(echoAt(wordsOf(["流せ", "動詞", "自立", "連用形"], ["流せ", "動詞", "自立", "連用形"], TO)), [1]);
    assert.deepEqual(echoAt(wordsOf(["待て", "動詞", "自立", "連用形"], ["待て", "動詞", "自立", "命令ｅ"], ["、", "記号", "読点", "*"])), [1]);
    assert.deepEqual(echoAt(wordsOf(["見ろ", "動詞", "自立", "命令ｒｏ"], ["見ろ", "動詞", "自立", "命令ｒｏ"])), [1]);
    assert.deepEqual(
      echoAt(wordsOf(["長く", "形容詞", "自立", "連用テ接続"], ["長く", "形容詞", "自立", "連用テ接続"], ["続く", "動詞", "自立", "基本形"])),
      [1],
    );
    assert.deepEqual(echoAt(wordsOf(["売り", "動詞", "自立", "連用形"], ["売り", "動詞", "自立", "連用形"], ["し", "動詞", "自立", "連用形"])), [1]);
  });

  it("終止形・非自立・一文字・表層違い・名詞の重なりは重ね言葉にしない", () => {
    assert.deepEqual(echoAt(wordsOf(["行く", "動詞", "自立", "基本形"], ["行く", "動詞", "自立", "基本形"])), []);
    assert.deepEqual(echoAt(wordsOf(["見る", "動詞", "自立", "基本形"], ["見る", "動詞", "自立", "連用形"], TO)), []);
    assert.deepEqual(echoAt(wordsOf(["ください", "動詞", "非自立", "連用形"], ["ください", "動詞", "非自立", "命令ｉ"])), []);
    assert.deepEqual(echoAt(wordsOf(["来い", "動詞", "自立", "命令ｉ"], ["来い", "動詞", "非自立", "命令ｉ"])), []);
    assert.deepEqual(echoAt(wordsOf(["し", "動詞", "自立", "連用形"], ["し", "動詞", "自立", "連用形"], TO)), []);
    assert.deepEqual(echoAt(wordsOf(["降り", "動詞", "自立", "連用形"], ["売り", "動詞", "自立", "連用形"], TO)), []);
    assert.deepEqual(echoAt(wordsOf(["確認", "名詞", "サ変接続", "*"], ["確認", "名詞", "サ変接続", "*"], TO)), []);
    assert.deepEqual(echoAt(wordsOf(["書き", "動詞", "自立", "連用形"], ["書き", "名詞", "接尾", "*"])), []);
  });

  it("語尾（助動詞・接続助詞）が続けば、語幹の書き損じ", () => {
    assert.deepEqual(echoAt(wordsOf(["でき", "動詞", "自立", "連用形"], ["でき", "動詞", "自立", "連用形"], ["ます", "助動詞", "*", "基本形"])), []);
    assert.deepEqual(echoAt(wordsOf(["売り", "動詞", "自立", "連用形"], ["売り", "動詞", "自立", "連用形"], ["て", "助詞", "接続助詞", "*"])), []);
  });

  it("離れた二語、先頭の語、空の並びは重ね言葉にしない", () => {
    const apart: Inflection[] = [
      { surface: "流せ", pos: "動詞", detail: "自立", form: "連用形", start: 0 },
      { surface: "流せ", pos: "動詞", detail: "自立", form: "連用形", start: 3 },
    ];
    assert.deepEqual(echoAt(apart), []);
    assert.deepEqual(echoAt(wordsOf(["流せ", "動詞", "自立", "連用形"])), []);
    assert.deepEqual(echoAt([]), []);
  });
});
