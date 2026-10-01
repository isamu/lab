import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  distributiveVocabulary,
  isInflectedEcho,
  isKanaEcho,
  isKanaRepeat,
  isWholeWordEcho,
  iterationMarkReading,
  markReduplication,
  type Distributive,
  type Inflection,
  type ReadsAsAdverb,
  type TakesIterationMark,
} from "../packages/lang-ja/src/reduplication.ts";
import type { Token } from "../packages/chaff/src/plugin.ts";
import { prepare, readsAsOneAdverb, readsAsOneWord } from "../packages/lang-ja/src/pos.ts";

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

/** 々 を付けて一語になる漢字を決め打ちした読み。 */
const iterable =
  (...kanji: readonly string[]): TakesIterationMark =>
  (text) =>
    kanji.includes(text);
const NO_KANJI = iterable();

const echoes = (tokens: readonly Token[], readsAsAdverb: ReadsAsAdverb = NO_ADVERB, takesIterationMark: TakesIterationMark = NO_KANJI): string[] =>
  markReduplication(tokens, VOCABULARY, readsAsAdverb, takesIterationMark).flatMap((token) =>
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
    assert.deepEqual(markReduplication(tokens, VOCABULARY, NO_ADVERB, NO_KANJI)[1]?.features, { NumType: "Card", Echo: "Rdp" });
  });

  it("同じ内容語が接して続き、続けて読み直すと一語の副詞なら、二つ目に Echo=Rdp を付ける（がんがん）", () => {
    const readsGangan = adverbs("がんがん");
    assert.deepEqual(echoes(tokensOf(["が", "ADP"], ["がん", "NOUN"], ["がん", "NOUN"], ["じゃ", "ADP"]), readsGangan), ["がん@3"]);
    assert.deepEqual(echoes(tokensOf(["ずる", "VERB"], ["ずる", "VERB"]), adverbs("ずるずる")), ["ずる@2"]);
    assert.deepEqual(echoes(tokensOf(["ほそ", "ADJ"], ["ほそ", "ADJ"]), adverbs("ほそほそ")), ["ほそ@2"]);
  });

  it("読み直しても副詞でない、機能語、品詞が違う、表層が違う、離れている重なりには付けない", () => {
    assert.deepEqual(echoes(tokensOf(["資料", "NOUN"], ["資料", "NOUN"]), adverbs("がんがん")), []);
    assert.deepEqual(echoes(tokensOf(["行っ", "VERB"], ["た", "AUX"], ["た", "AUX"]), adverbs("たた")), []);
    assert.deepEqual(echoes(tokensOf(["着い", "VERB"], ["たら", "AUX"], ["たら", "AUX"]), adverbs("たらたら")), []);
    assert.deepEqual(echoes(tokensOf(["まし", "AUX"], ["た", "AUX"], ["た", "AUX"]), adverbs("たた")), []);
    assert.deepEqual(echoes(tokensOf(["確認", "NOUN"], ["です", "AUX"], ["です", "AUX"]), adverbs("たらたら")), []);
    assert.deepEqual(echoes(tokensOf(["や", "ADP"], ["や", "ADP"]), adverbs("やや")), []);
    assert.deepEqual(echoes(tokensOf(["がん", "NOUN"], ["がん", "VERB"]), adverbs("がんがん")), []);
    assert.deepEqual(echoes(tokensOf(["がん", "NOUN"], ["ガン", "NOUN"]), adverbs("がんガン", "がんがん")), []);
    const apart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "がん", pos: "NOUN" },
      { span: { start: 3, end: 5 }, surface: "がん", pos: "NOUN" },
    ];
    assert.deepEqual(echoes(apart, adverbs("がんがん")), []);
  });

  it("前に述語の無い助動詞の重なりが一語の副詞に読めれば、擬音の切れ端として二つ目に付ける（たん・たら・たら）。述語は印を挟んでも述語", () => {
    const readsTaratara = adverbs("たらたら");
    assert.deepEqual(echoes(tokensOf(["たん", "NOUN"], ["たら", "AUX"], ["たら", "AUX"], ["と", "ADP"]), readsTaratara), ["たら@4"]);
    assert.deepEqual(echoes(tokensOf(["たら", "AUX"], ["たら", "AUX"]), readsTaratara), ["たら@2"]);
    const apart: Token[] = [
      { span: { start: 0, end: 2 }, surface: "着い", pos: "VERB" },
      { span: { start: 3, end: 5 }, surface: "たら", pos: "AUX" },
      { span: { start: 5, end: 7 }, surface: "たら", pos: "AUX" },
    ];
    assert.deepEqual(echoes(apart, readsTaratara), []);
  });

  it("一字の漢字の名詞の重なりは、々 を付けて一語になる漢字なら畳語として二つ目に付ける（家家）", () => {
    const takesIe = iterable("家", "朝");
    assert.deepEqual(echoes(tokensOf(["家", "NOUN"], ["家", "NOUN"], ["の", "ADP"]), NO_ADVERB, takesIe), ["家@1"]);
    assert.deepEqual(echoes(tokensOf(["朝", "NOUN"], ["朝", "NOUN"]), NO_ADVERB, takesIe), ["朝@1"]);
  });

  it("々 を付けても一語にならない漢字、二字の語、名詞でない語、数、離れた語は畳語にしない", () => {
    const takesIe = iterable("家", "資料", "一", "本");
    assert.deepEqual(echoes(tokensOf(["法", "NOUN"], ["法", "NOUN"], ["の", "ADP"]), NO_ADVERB, takesIe), []);
    assert.deepEqual(echoes(tokensOf(["資料", "NOUN"], ["資料", "NOUN"]), NO_ADVERB, takesIe), []);
    assert.deepEqual(echoes(tokensOf(["本", "ADJ"], ["本", "NOUN"]), NO_ADVERB, takesIe), []);
    assert.deepEqual(echoes(tokensOf(["家", "NOUN"], ["家", "VERB"]), NO_ADVERB, takesIe), []);
    const numbers: Token[] = [
      { span: { start: 0, end: 1 }, surface: "一", pos: "NOUN", features: { NumType: "Card" } },
      { span: { start: 1, end: 2 }, surface: "一", pos: "NOUN", features: { NumType: "Card" } },
    ];
    assert.deepEqual(echoes(numbers, NO_ADVERB, takesIe), []);
    const apart: Token[] = [
      { span: { start: 0, end: 1 }, surface: "家", pos: "NOUN" },
      { span: { start: 2, end: 3 }, surface: "家", pos: "NOUN" },
    ];
    assert.deepEqual(echoes(apart, NO_ADVERB, takesIe), []);
  });

  it("空の並びと、語彙表の無い言語", () => {
    assert.deepEqual(markReduplication([], VOCABULARY, NO_ADVERB, NO_KANJI), []);
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

type Word = readonly [string, string, string, string] | readonly [string, string, string, string, string];

describe("iterationMarkReading", () => {
  const readsIeIe = (text: string): boolean => text === "家々";

  it("語彙表の漢字か、々 を付けて一語に読む漢字なら true", () => {
    const takes = iterationMarkReading({ "iteration-kanji": [{ pattern: "朝" }] }, readsIeIe);
    assert.deepEqual(["朝", "家", "法", ""].map(takes), [true, true, false, false]);
  });

  it("語彙表が無ければ、解析器の読みだけ", () => {
    const takes = iterationMarkReading({}, readsIeIe);
    assert.deepEqual(["朝", "家"].map(takes), [false, true]);
  });
});

describe("readsAsOneWord", () => {
  before(async () => {
    await prepare();
  });

  it("品詞を問わず一語に読めば true。二語に切れる、空の文字列は false", () => {
    assert.deepEqual(["家々", "時々", "法々", "朝々", ""].map(readsAsOneWord), [true, true, false, false, false]);
  });
});

/** 語を隙間なく並べた、解析器の読み。[表層, 品詞, 細分類, 活用形, 活用型]。活用型は省けば *。 */
const wordsOf = (...words: readonly Word[]): Inflection[] =>
  words.reduce<Inflection[]>((acc, [surface, pos, detail, form, conjugation]) => {
    const last = acc.at(-1);
    const start = last === undefined ? 0 : last.start + last.surface.length;
    return [...acc, { surface, pos, detail, form, conjugation: conjugation ?? "*", start }];
  }, []);

const echoAt = (words: readonly Inflection[]): number[] => words.flatMap((_, index) => (isInflectedEcho(words, index) ? [index] : []));

const kanaEchoAt = (words: readonly Inflection[]): number[] => words.flatMap((_, index) => (isKanaEcho(words, index) ? [index] : []));

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

  it("助動詞が続けば、語幹の書き損じ", () => {
    assert.deepEqual(
      echoAt(wordsOf(["でき", "動詞", "自立", "連用形", "一段"], ["でき", "動詞", "自立", "連用形", "一段"], ["ます", "助動詞", "*", "基本形"])),
      [],
    );
    assert.deepEqual(
      echoAt(wordsOf(["売り", "動詞", "自立", "連用形", "五段・ラ行"], ["売り", "動詞", "自立", "連用形", "五段・ラ行"], ["ます", "助動詞", "*", "基本形"])),
      [],
    );
  });

  it("接続助詞が続けば、五段動詞の連用形は重ね言葉（売り売りて・行き行きて）、一段動詞の連用形と形容詞は書き損じ", () => {
    const TE: Word = ["て", "助詞", "接続助詞", "*"];
    assert.deepEqual(echoAt(wordsOf(["売り", "動詞", "自立", "連用形", "五段・ラ行"], ["売り", "動詞", "自立", "連用形", "五段・ラ行"], TE)), [1]);
    assert.deepEqual(echoAt(wordsOf(["行き", "動詞", "自立", "連用形", "五段・カ行促音便"], ["行き", "動詞", "自立", "連用形", "五段・カ行促音便"], TE)), [1]);
    assert.deepEqual(echoAt(wordsOf(["でき", "動詞", "自立", "連用形", "一段"], ["でき", "動詞", "自立", "連用形", "一段"], TE)), []);
    assert.deepEqual(
      echoAt(wordsOf(["長く", "形容詞", "自立", "連用テ接続", "形容詞・アウオ段"], ["長く", "形容詞", "自立", "連用テ接続", "形容詞・アウオ段"], TE)),
      [],
    );
    assert.deepEqual(echoAt(wordsOf(["売り", "動詞", "自立", "連用形"], ["売り", "動詞", "自立", "連用形"], TE)), []);
  });

  it("離れた二語、先頭の語、空の並びは重ね言葉にしない", () => {
    const apart: Inflection[] = [
      { surface: "流せ", pos: "動詞", detail: "自立", form: "連用形", conjugation: "一段", start: 0 },
      { surface: "流せ", pos: "動詞", detail: "自立", form: "連用形", conjugation: "一段", start: 3 },
    ];
    assert.deepEqual(echoAt(apart), []);
    assert.deepEqual(echoAt(wordsOf(["流せ", "動詞", "自立", "連用形"])), []);
    assert.deepEqual(echoAt([]), []);
  });
});

const KANA_TO: Word = ["と", "助詞", "並立助詞", "*"];

describe("isKanaEcho", () => {
  it("平仮名だけの自立の語を丸ごと重ね、副詞の位置（と・に・行末・文末）に立てば、二つ目が重ね言葉（擬音・擬態語）", () => {
    assert.deepEqual(kanaEchoAt(wordsOf(["きし", "名詞", "サ変接続", "*"], ["きし", "名詞", "サ変接続", "*"], KANA_TO)), [1]);
    assert.deepEqual(kanaEchoAt(wordsOf(["ちょん", "名詞", "一般", "*"], ["ちょん", "名詞", "一般", "*"], KANA_TO)), [1]);
    assert.deepEqual(kanaEchoAt(wordsOf(["すう", "動詞", "自立", "基本形"], ["すう", "動詞", "自立", "基本形"], ["と", "助詞", "格助詞", "*"])), [1]);
    assert.deepEqual(
      kanaEchoAt(wordsOf(["、", "記号", "読点", "*"], ["しだい", "名詞", "接尾", "*"], ["しだい", "名詞", "接尾", "*"], ["に", "助詞", "格助詞", "*"])),
      [2],
    );
    assert.deepEqual(kanaEchoAt(wordsOf(["あはれ", "名詞", "形容動詞語幹", "*"], ["あはれ", "名詞", "形容動詞語幹", "*"])), [1]);
    assert.deepEqual(kanaEchoAt(wordsOf(["あはれ", "名詞", "形容動詞語幹", "*"], ["あはれ", "名詞", "形容動詞語幹", "*"], ["\n", "記号", "空白", "*"])), [1]);
    const lineEnd: Inflection[] = [
      { surface: "あはれ", pos: "名詞", detail: "形容動詞語幹", form: "*", conjugation: "*", start: 0 },
      { surface: "あはれ", pos: "名詞", detail: "形容動詞語幹", form: "*", conjugation: "*", start: 3 },
      { surface: "自ら", pos: "名詞", detail: "副詞可能", form: "*", conjugation: "*", start: 7 },
    ];
    assert.deepEqual(kanaEchoAt(lineEnd), [1]);
  });

  it("片仮名の語（外来語）、句読点が続く重なり、三拍以上の動詞の重なりは書き損じ", () => {
    assert.deepEqual(kanaEchoAt(wordsOf(["ユーザー", "名詞", "一般", "*"], ["ユーザー", "名詞", "一般", "*"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["ドン", "名詞", "一般", "*"], ["ドン", "名詞", "一般", "*"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["まとめ", "名詞", "一般", "*"], ["まとめ", "名詞", "一般", "*"], ["、", "記号", "読点", "*"])), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["きし", "名詞", "サ変接続", "*"], ["きし", "名詞", "サ変接続", "*"], ["。", "記号", "句点", "*"])), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["できる", "動詞", "自立", "基本形"], ["できる", "動詞", "自立", "基本形"], ["と", "助詞", "格助詞", "*"])), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["しゃべる", "動詞", "自立", "基本形"], ["しゃべる", "動詞", "自立", "基本形"], ["と", "助詞", "格助詞", "*"])), []);
  });

  it("二拍の動詞の重なりは、小さい仮名を拍に数えない（ちょう = 二拍）", () => {
    assert.deepEqual(kanaEchoAt(wordsOf(["ちょう", "動詞", "自立", "基本形"], ["ちょう", "動詞", "自立", "基本形"], ["と", "助詞", "格助詞", "*"])), [1]);
  });

  it("副詞の位置に立たない重なり（まとめまとめを・できるできるように）は書き損じ", () => {
    assert.deepEqual(kanaEchoAt(wordsOf(["まとめ", "名詞", "一般", "*"], ["まとめ", "名詞", "一般", "*"], ["を", "助詞", "格助詞", "*"])), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["できる", "動詞", "自立", "基本形"], ["できる", "動詞", "自立", "基本形"], ["よう", "名詞", "非自立", "*"])), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["まとめ", "名詞", "一般", "*"], ["まとめ", "名詞", "一般", "*"], ["ます", "助動詞", "*", "基本形"])), []);
  });

  it("前の語に付いた接尾語（田中さんさん）、非自立の語、助詞・助動詞、一文字、漢字、表層違い、離れた語は書き損じ", () => {
    assert.deepEqual(
      kanaEchoAt(wordsOf(["田中", "名詞", "固有名詞", "*"], ["さん", "名詞", "接尾", "*"], ["さん", "名詞", "接尾", "*"], ["に", "助詞", "格助詞", "*"])),
      [],
    );
    assert.deepEqual(
      kanaEchoAt(wordsOf(["見", "動詞", "自立", "連用形"], ["られ", "動詞", "接尾", "連用形"], ["られ", "動詞", "接尾", "連用形"], KANA_TO)),
      [],
    );
    assert.deepEqual(kanaEchoAt(wordsOf(["こと", "名詞", "非自立", "*"], ["こと", "名詞", "非自立", "*"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["ください", "動詞", "非自立", "連用形"], ["ください", "動詞", "非自立", "命令ｉ"])), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["から", "助詞", "格助詞", "*"], ["から", "助詞", "格助詞", "*"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["たら", "助動詞", "*", "仮定形"], ["たら", "助動詞", "*", "仮定形"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["ゆ", "名詞", "一般", "*"], ["ゆ", "名詞", "一般", "*"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["確認", "名詞", "サ変接続", "*"], ["確認", "名詞", "サ変接続", "*"], KANA_TO)), []);
    assert.deepEqual(kanaEchoAt(wordsOf(["きし", "名詞", "サ変接続", "*"], ["キシ", "名詞", "サ変接続", "*"], KANA_TO)), []);
    const apart: Inflection[] = [
      { surface: "きし", pos: "名詞", detail: "サ変接続", form: "*", conjugation: "*", start: 0 },
      { surface: "きし", pos: "名詞", detail: "サ変接続", form: "*", conjugation: "*", start: 3 },
    ];
    assert.deepEqual(kanaEchoAt(apart), []);
    assert.deepEqual(kanaEchoAt([]), []);
  });
});

/** 重ねて言える漢語の名詞を決め打ちした語彙表。 */
const KANJI_NOUNS: ReadonlySet<string> = new Set(["個人", "一行"]);

const wholeEchoAt = (words: readonly Inflection[], kanjiNouns: ReadonlySet<string> = KANJI_NOUNS): number[] =>
  words.flatMap((_, index) => (isWholeWordEcho(words, index, kanjiNouns) ? [index] : []));

const kanaRepeatAt = (words: readonly Inflection[]): number[] => words.flatMap((_, index) => (isKanaRepeat(words, index) ? [index] : []));

const NOUN = (surface: string, detail = "一般"): Word => [surface, "名詞", detail, "*"];
const PLAIN_ADJECTIVE = (surface: string): Word => [surface, "形容詞", "自立", "基本形"];
const PARTICLE = (surface: string): Word => [surface, "助詞", "係助詞", "*"];

describe("isWholeWordEcho", () => {
  it("内容語の名詞・言い切りの形容詞を丸ごと重ねれば、二つ目が重ね言葉", () => {
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("個人"), NOUN("個人"), PARTICLE("の"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("それ", "代名詞"), NOUN("それ", "代名詞"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("駄目", "形容動詞語幹"), NOUN("駄目", "形容動詞語幹"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("好き", "形容動詞語幹"), NOUN("好き", "接尾"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(PLAIN_ADJECTIVE("若い"), PLAIN_ADJECTIVE("若い"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("ムク"), NOUN("ムク"), KANA_TO)), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("ブー"), NOUN("ブー"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("ゴロン"), NOUN("ゴロン"), ["に", "助詞", "格助詞", "*"])), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("ブイ"), NOUN("ブイ"), ["言わ", "動詞", "自立", "未然形"])), [1]);
  });

  it("付く語・数・一字の語・外来語・三つ目・形容詞の続く形・動詞は重ね言葉にしない", () => {
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("さん", "接尾"), NOUN("さん", "接尾"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("こと", "非自立"), NOUN("こと", "非自立"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("一", "数"), NOUN("一", "数"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("法"), NOUN("法"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("ユーザー"), NOUN("ユーザー"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("データ"), NOUN("データ"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("ライブラリ"), NOUN("ライブラリ"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("アイテム"), NOUN("アイテム"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("テスト"), NOUN("テスト"), ["を", "助詞", "格助詞", "*"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("テスト"), NOUN("テスト"), ["する", "動詞", "自立", "基本形"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("メモ"), NOUN("メモ"), ["。", "記号", "句点", "*"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("二十", "数"), NOUN("二十", "数"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("かけ"), ["かけ", "動詞", "自立", "連用形"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("早め"), NOUN("早め"), NOUN("早め"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(["若かっ", "形容詞", "自立", "連用タ接続"], ["若かっ", "形容詞", "自立", "連用タ接続"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(PLAIN_ADJECTIVE("若い"), NOUN("若い"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(["できる", "動詞", "自立", "基本形"], ["できる", "動詞", "自立", "基本形"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("資料"), NOUN("会議"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(PARTICLE("を"), PARTICLE("を"))), []);
  });

  it("漢字だけの名詞は、語彙表の語か、副詞的な名詞・形容動詞の語幹のときだけ重ね言葉（#412 の続き）", () => {
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("一行"), NOUN("一行"), PARTICLE("を"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("毎年", "副詞可能"), NOUN("毎年", "副詞可能"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("各自", "副詞可能"), NOUN("各自", "副詞可能"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("大変", "形容動詞語幹"), NOUN("大変", "形容動詞語幹"))), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("確認", "サ変接続"), NOUN("確認", "サ変接続"), ["し", "動詞", "自立", "連用形"])), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("資料"), NOUN("資料"), PARTICLE("が"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("対応", "サ変接続"), NOUN("対応", "サ変接続"))), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("個人"), NOUN("個人"), PARTICLE("の")), new Set()), []);
  });

  it("仮名や送り仮名のある名詞は、語彙表に無くても丸ごと重ねれば重ね言葉", () => {
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("早め"), NOUN("早め")), new Set()), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("もちもち"), NOUN("もちもち")), new Set()), [1]);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("それ", "代名詞"), NOUN("それ", "代名詞")), new Set()), [1]);
  });

  it("離れた二語、先頭の語、空の並び", () => {
    const apart: Inflection[] = [
      { surface: "個人", pos: "名詞", detail: "一般", form: "*", conjugation: "*", start: 0 },
      { surface: "個人", pos: "名詞", detail: "一般", form: "*", conjugation: "*", start: 3 },
    ];
    assert.deepEqual(wholeEchoAt(apart), []);
    assert.deepEqual(wholeEchoAt(wordsOf(NOUN("個人"))), []);
    assert.deepEqual(wholeEchoAt([]), []);
    assert.equal(isWholeWordEcho([], -1, KANJI_NOUNS), false);
  });
});

describe("isKanaRepeat", () => {
  it("同じ一字の仮名が三つ以上接して続けば、二つ目から後ろが重ね言葉（ははは・あははは・ババババ）", () => {
    assert.deepEqual(kanaRepeatAt(wordsOf(PARTICLE("は"), PARTICLE("は"), PARTICLE("は"))), [1, 2]);
    assert.deepEqual(kanaRepeatAt(wordsOf(["あ", "フィラー", "*", "*"], PARTICLE("は"), PARTICLE("は"), PARTICLE("は"), ["、", "記号", "読点", "*"])), [2, 3]);
    assert.deepEqual(kanaRepeatAt(wordsOf(NOUN("バ"), NOUN("バ"), NOUN("バ"), NOUN("バ"))), [1, 2, 3]);
  });

  it("二つだけ、二字の語、仮名でない字、違う字、離れた字は重ね言葉にしない", () => {
    assert.deepEqual(kanaRepeatAt(wordsOf(PARTICLE("を"), PARTICLE("を"))), []);
    assert.deepEqual(kanaRepeatAt(wordsOf(PARTICLE("を"), PARTICLE("を"), PARTICLE("を"))), []);
    assert.deepEqual(kanaRepeatAt(wordsOf(PARTICLE("に"), PARTICLE("に"), PARTICLE("に"))), []);
    assert.deepEqual(kanaRepeatAt(wordsOf(PARTICLE("ふ"), PARTICLE("ふ"), PARTICLE("ふ"))), [1, 2]);
    assert.deepEqual(kanaRepeatAt(wordsOf(PARTICLE("よ"), PARTICLE("よ"), PARTICLE("ね"))), []);
    assert.deepEqual(kanaRepeatAt(wordsOf(NOUN("はは"), NOUN("はは"), NOUN("はは"))), []);
    assert.deepEqual(kanaRepeatAt(wordsOf(NOUN("木"), NOUN("木"), NOUN("木"))), []);
    assert.deepEqual(kanaRepeatAt(wordsOf(["a", "名詞", "一般", "*"], ["a", "名詞", "一般", "*"], ["a", "名詞", "一般", "*"])), []);
    const apart: Inflection[] = [
      { surface: "は", pos: "助詞", detail: "係助詞", form: "*", conjugation: "*", start: 0 },
      { surface: "は", pos: "助詞", detail: "係助詞", form: "*", conjugation: "*", start: 1 },
      { surface: "は", pos: "助詞", detail: "係助詞", form: "*", conjugation: "*", start: 3 },
    ];
    assert.deepEqual(kanaRepeatAt(apart), []);
    assert.deepEqual(kanaRepeatAt([]), []);
  });

  it("前の語に付いた並びは助詞・助動詞の書き損じ（資料ををを・行ったたた）。記号・フィラーの後ろと文の頭は立つ", () => {
    assert.deepEqual(kanaRepeatAt(wordsOf(NOUN("資料"), PARTICLE("を"), PARTICLE("を"), PARTICLE("を"))), []);
    assert.deepEqual(
      kanaRepeatAt(
        wordsOf(["行っ", "動詞", "自立", "連用タ接続"], ["た", "助動詞", "*", "基本形"], ["た", "助動詞", "*", "基本形"], ["た", "助動詞", "*", "基本形"]),
      ),
      [],
    );
    assert.deepEqual(kanaRepeatAt(wordsOf(["「", "記号", "括弧開", "*"], PARTICLE("は"), PARTICLE("は"), PARTICLE("は"))), [2, 3]);
    assert.deepEqual(kanaRepeatAt(wordsOf(["あ", "感動詞", "*", "*"], PARTICLE("は"), PARTICLE("は"), PARTICLE("は"))), [2, 3]);
    const afterSpace: Inflection[] = [
      { surface: "笑い", pos: "名詞", detail: "一般", form: "*", conjugation: "*", start: 0 },
      { surface: "は", pos: "助詞", detail: "係助詞", form: "*", conjugation: "*", start: 3 },
      { surface: "は", pos: "助詞", detail: "係助詞", form: "*", conjugation: "*", start: 4 },
      { surface: "は", pos: "助詞", detail: "係助詞", form: "*", conjugation: "*", start: 5 },
    ];
    assert.deepEqual(kanaRepeatAt(afterSpace), [2, 3]);
  });
});
