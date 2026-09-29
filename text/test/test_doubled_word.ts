import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { doubledAt, doubledIn, gapBetween, isAllowed, isNameBefore, isPartOfLongerWord, startsTitle } from "../packages/chaff/src/detectors/doubled-word.ts";
import type { LanguageAdapter, Lexicon, Token } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

type Word = { readonly surface: string; readonly pos: string; readonly features?: Readonly<Record<string, string>> };

/** 語を順に source に置いた token の並び。間の文字列は gaps で渡す（既定は空白一つ）。 */
const tokensOf = (words: readonly Word[], gaps: readonly string[] = []): { source: string; tokens: Token[] } =>
  words.reduce<{ source: string; tokens: Token[] }>(
    (acc, word, index) => {
      const gap = index === 0 ? "" : (gaps[index - 1] ?? " ");
      const start = acc.source.length + gap.length;
      const token: Token = {
        span: { start, end: start + word.surface.length },
        surface: word.surface,
        pos: word.pos,
        ...(word.features === undefined ? {} : { features: word.features }),
      };
      return { source: `${acc.source}${gap}${word.surface}`, tokens: [...acc.tokens, token] };
    },
    { source: "", tokens: [] },
  );

const w = (surface: string, pos: string, features?: Readonly<Record<string, string>>): Word =>
  features === undefined ? { surface, pos } : { surface, pos, features };
const ART = { PronType: "Art" };
const POSS = { Poss: "Yes" };

const entry = (...surfaces: readonly string[]): Lexicon[number] => ({
  pattern: surfaces.join(" "),
  tokens: tokensOf(surfaces.map((surface) => w(surface, "X"))).tokens,
});

const pairs = (words: readonly Word[], options: { gaps?: readonly string[]; spaced?: boolean; allowed?: Lexicon } = {}): string[] => {
  const { source, tokens } = tokensOf(words, options.gaps);
  return doubledIn(source, tokens, options.spaced ?? true, options.allowed ?? []).map(
    ({ first, second }) => `${first.surface} ${second.surface}@${String(second.span.start)}`,
  );
};

describe("doubled-word — 純関数", () => {
  it("同じ語が空白を挟んで続けば、二つ目を指す", () => {
    assert.deepEqual(pairs([w("send", "VERB"), w("the", "DET"), w("the", "DET"), w("file", "NOUN")]), ["the the@9"]);
  });

  it("大文字小文字は問わず、改行を挟んでも同じ語", () => {
    assert.deepEqual(pairs([w("The", "DET"), w("the", "DET")], { gaps: ["\n"] }), ["The the@4"]);
  });

  it("日本語のように語が接していても、同じ語が続けば見つける", () => {
    assert.deepEqual(pairs([w("資料", "NOUN"), w("を", "ADP"), w("を", "ADP"), w("送る", "VERB")], { gaps: ["", "", ""], spaced: false }), ["を を@3"]);
  });

  it("品詞が違えば同じ表層でも数えない（that that の接続詞と指示語）", () => {
    assert.deepEqual(pairs([w("that", "ADP"), w("that", "DET")]), []);
  });

  it("冠詞と所有の語は、違う語でも二つ並べば見つける", () => {
    assert.deepEqual(pairs([w("our", "PRON", POSS), w("the", "DET", ART), w("platform", "NOUN")]), ["our the@4"]);
    assert.deepEqual(pairs([w("a", "DET", ART), w("the", "DET", ART)]), ["a the@2"]);
    assert.deepEqual(pairs([w("the", "DET", ART), w("our", "PRON", POSS)]), ["the our@4"]);
  });

  it("冠詞や所有の印の無い限定詞との並びは数えない（all the / which the / this the）", () => {
    assert.deepEqual(pairs([w("all", "DET"), w("the", "DET", ART)]), []);
    assert.deepEqual(pairs([w("which", "DET"), w("the", "DET", ART)]), []);
    assert.deepEqual(pairs([w("the", "DET", ART), w("all", "DET")]), []);
  });

  it("記号・数・間投詞・副詞・固有名詞・数詞の重なりは数えない", () => {
    assert.deepEqual(pairs([w("-", "X"), w("-", "X")]), []);
    assert.deepEqual(pairs([w("|", "NOUN"), w("|", "NOUN")]), []);
    assert.deepEqual(pairs([w("no", "INTJ"), w("no", "INTJ")]), []);
    assert.deepEqual(pairs([w("very", "ADV"), w("very", "ADV")]), []);
    assert.deepEqual(pairs([w("Walla", "PROPN"), w("Walla", "PROPN")]), []);
    assert.deepEqual(pairs([w("一", "NOUN", { NumType: "Card" }), w("一", "NOUN", { NumType: "Card" })], { gaps: [""], spaced: false }), []);
    assert.deepEqual(pairs([w("12", "NUM"), w("12", "NUM")]), []);
    assert.deepEqual(pairs([w("ten", "NUM"), w("ten", "NUM")]), []);
    assert.deepEqual(pairs([w("etc", "X"), w("etc", "X")]), []);
  });

  it("あいだに文字のある二語は別々の語", () => {
    assert.deepEqual(pairs([w("for", "ADP"), w("for", "ADP")], { gaps: [" `completionMode` "] }), []);
  });

  it("印だけを挟んだ機能語は数え、内容語は数えない（the [the / **app settings** settings）", () => {
    assert.deepEqual(pairs([w("the", "DET"), w("the", "DET")], { gaps: [" ["] }), ["the the@5"]);
    assert.deepEqual(pairs([w("settings", "NOUN"), w("settings", "NOUN")], { gaps: ["** "] }), []);
  });

  it("空白で語を区切る言語では、語に接した片方は長い語の一部（114A The / Content-Type）", () => {
    const glued = tokensOf([w("114", "NUM"), w("A", "DET", ART), w("The", "DET", ART)], ["", " "]);
    assert.deepEqual(doubledIn(glued.source, glued.tokens, true, []), []);
    const hyphen = tokensOf([w("Content", "NOUN"), w("Content", "NOUN"), w("-Type", "X")], ["\n", ""]);
    assert.deepEqual(doubledIn(hyphen.source, hyphen.tokens, true, []), []);
  });

  it("限定詞の対で、小文字の語の後ろの大文字は題名の書き出しなので数えない。同じ語は大文字でも数える", () => {
    assert.deepEqual(pairs([w("the", "DET", ART), w("Your", "PRON", POSS)], { gaps: [" ["] }), []);
    assert.deepEqual(pairs([w("the", "DET", ART), w("The", "DET", ART)]), ["the The@4"]);
    assert.deepEqual(pairs([w("the", "DET", ART), w("Our", "PRON", POSS)]), []);
    assert.deepEqual(pairs([w("The", "DET", ART), w("Our", "PRON", POSS)]), ["The Our@4"]);
    assert.deepEqual(pairs([w("The", "DET", ART), w("the", "DET", ART)]), ["The the@4"]);
    assert.deepEqual(pairs([w("THE", "DET", ART), w("THE", "DET", ART)]), ["THE THE@4"]);
  });

  it("文の途中の大文字の語の後ろの小文字の同じ語は、名前とその後ろの語（May may）", () => {
    assert.deepEqual(pairs([w("for", "ADP"), w("May", "AUX"), w("may", "AUX")]), []);
    assert.deepEqual(pairs([w("“", "PUNCT"), w("The", "DET"), w("the", "DET")], { gaps: ["", " "] }), ["The the@5"]);
    assert.deepEqual(pairs([w("for", "ADP"), w("MAY", "AUX"), w("MAY", "AUX")]), ["MAY MAY@8"]);
    assert.deepEqual(pairs([w("review", "VERB"), w("The", "DET", ART), w("the", "DET", ART)]), ["The the@11"]);
    assert.deepEqual(pairs([w("review", "VERB"), w("Our", "PRON", POSS), w("the", "DET", ART)]), ["Our the@11"]);
    const { tokens } = tokensOf([w("May", "AUX"), w("may", "AUX")]);
    const [capitalised, lower] = tokens;
    assert.ok(capitalised !== undefined && lower !== undefined);
    assert.equal(isNameBefore(capitalised, lower, true), false);
    assert.equal(isNameBefore(capitalised, lower, false), true);
    assert.equal(isNameBefore(lower, capitalised, false), false);
  });

  it("アダプタが重ね言葉（Echo=Rdp）と読んだ二つ目は数えない", () => {
    assert.deepEqual(pairs([w("会社", "NOUN"), w("会社", "NOUN", { Echo: "Rdp" }), w("で", "ADP")], { gaps: ["", ""], spaced: false }), []);
    assert.deepEqual(pairs([w("会社", "NOUN", { Echo: "Rdp" }), w("会社", "NOUN")], { gaps: [""], spaced: false }), ["会社 会社@2"]);
  });

  it("語彙表の重なりは数えない。語彙表は語に分けた形で比べる", () => {
    const allowed: Lexicon = [entry("had", "had")];
    assert.deepEqual(pairs([w("had", "VERB"), w("had", "VERB")], { allowed }), []);
    assert.deepEqual(pairs([w("HAD", "VERB"), w("had", "VERB")], { allowed }), []);
    assert.deepEqual(pairs([w("is", "VERB"), w("is", "VERB")], { allowed }), ["is is@3"]);
  });

  it("語に分けていない語彙表の行は何も許さない", () => {
    const { tokens } = tokensOf([w("had", "VERB"), w("had", "VERB")]);
    const [first, second] = tokens;
    assert.ok(first !== undefined && second !== undefined);
    assert.equal(isAllowed(first, second, [{ pattern: "had had" }]), false);
  });

  it("空の並び、一語だけの並びでは何も出さない", () => {
    assert.deepEqual(doubledIn("", [], true, []), []);
    assert.deepEqual(pairs([w("the", "DET")]), []);
  });

  it("あいだの分類と、長い語の一部かの判定", () => {
    const { source, tokens } = tokensOf([w("a", "DET"), w("b", "DET"), w("c", "DET"), w("d", "DET")], ["  \n ", "*[", "x"]);
    const [a, b, c, d] = tokens;
    assert.ok(a !== undefined && b !== undefined && c !== undefined && d !== undefined);
    assert.equal(gapBetween(source, a, b), "space");
    assert.equal(gapBetween(source, b, c), "markup");
    assert.equal(gapBetween(source, c, d), "text");
    assert.equal(isPartOfLongerWord(source, a, b), false);
    assert.equal(isPartOfLongerWord(source, c, d), false);
    assert.equal(doubledAt(source, a, b, true, []), false);
    assert.equal(startsTitle(a, b), false);
  });
});

const RULES = { ja: loadRules("ja"), en: loadRules("en") };

const findingsOf = (source: string, adapter: LanguageAdapter, language: "ja" | "en"): string[] =>
  runRules(buildDocument("t.md", source, adapter), RULES[language], {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "doubled-word")
    .map((finding) => `${String(finding.line)}:${String(finding.column)} ${String(finding.values["word"])}`);

describe("doubled-word — 英語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("invalid: 同じ語の重なりと、冠詞・所有の語の重なりを、二つ目の位置で出す", () => {
    assert.deepEqual(findingsOf("Please review the the draft before Friday.", en, "en"), ["1:19 the the"]);
    assert.deepEqual(findingsOf("Developers interact with our the platform every day.", en, "en"), ["1:30 our the"]);
    assert.deepEqual(findingsOf("We will send a the report to the team.", en, "en"), ["1:16 a the"]);
    assert.deepEqual(findingsOf("The plan is is ready for review.", en, "en"), ["1:13 is is"]);
  });

  it("invalid: 行をまたいでも、大文字で始まっても同じ語", () => {
    assert.deepEqual(findingsOf("Please send the\nthe report to finance.", en, "en"), ["2:1 the the"]);
    assert.deepEqual(findingsOf("The the report is attached.", en, "en"), ["1:5 The the"]);
    assert.deepEqual(findingsOf("Please review the The draft.", en, "en"), ["1:19 the The"]);
    assert.deepEqual(findingsOf("Please review The the draft before Friday.", en, "en"), ["1:19 The the"]);
  });

  it("valid: 文法が許す重なりと、並んでよい限定詞は数えない", () => {
    const valid = [
      "He had had enough of the delays.",
      "I think that that is fine.",
      "Give her the book before the meeting.",
      "We sent her our report before the meeting.",
      "Please give her her copy of the signed agreement.",
      "No no, we should not deploy today.",
      "I told her my plan and her their schedule.",
      "All the reports are in, and both the leads agreed.",
      "It was such a long week.",
      "This is the order in which the steps run.",
      "The results were very very good.",
      "They call this the end of the line.",
      "Section 114A The Information Commission",
      "We visited Walla Walla last spring.",
      "The answer is, is it worth it?",
      "Contact us about the [Your Rights section](https://example.com) above.",
      "Open the My Account page.",
      "We do do manual reviews for high-risk cases.",
      "Payment for May may be delayed due to procurement review.",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, en, "en"), [], text));
  });

  it("valid: コードを挟んだ語は別々の語", () => {
    assert.deepEqual(findingsOf("It can be offered as a new value for `.spec.mode` for Jobs.", en, "en"), []);
  });

  it("invalid: リンクの印だけを挟んだ機能語は数える", () => {
    assert.deepEqual(findingsOf("In general, the [the documentation](https://example.com) applies.", en, "en"), ["1:18 the the"]);
  });
});

describe("doubled-word — 日本語", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("invalid: 同じ語が続けば、二つ目の位置で出す", () => {
    assert.deepEqual(findingsOf("資料をを送ります。", ja, "ja"), ["1:4 をを"]);
    assert.deepEqual(findingsOf("私のの本です。", ja, "ja"), ["1:3 のの"]);
    assert.deepEqual(findingsOf("内容を確認確認します。", ja, "ja"), ["1:6 確認確認"]);
    assert.deepEqual(findingsOf("会議会議を開きます。", ja, "ja"), ["1:3 会議会議"]);
    assert.deepEqual(findingsOf("資料資料が届きました。", ja, "ja"), ["1:3 資料資料"]);
    assert.deepEqual(findingsOf("資料資料の確認をお願いします。", ja, "ja"), ["1:3 資料資料"]);
    assert.deepEqual(findingsOf("資料資料で確認してください。", ja, "ja"), ["1:3 資料資料"]);
    assert.deepEqual(findingsOf("会社会社を訪問します。", ja, "ja"), ["1:3 会社会社"]);
  });

  it("valid: 重ね言葉と繰り返し記号は数えない", () => {
    const valid = [
      "まだまだ改善の余地があります。",
      "時々、人々が集まります。",
      "ますます増えています。",
      "いろいろな案があります。",
      "ドンドン進めてください。",
      "一つ一つ確認します。",
      "見る見るうちに増えました。",
      "そうそう無い機会です。",
      "もっともっと良くします。",
      "はいはい、分かりました。",
      "それはそれは大変でした。",
      "少しずつ少しずつ進めます。",
      "我々は様々な方法を試しました。",
      "一一確認する必要はありません。",
      "毎日毎日同じ作業をしています。",
      "チームでの参加の場合も、個人個人で申し込みが必要です。",
      "場面場面で使い分けます。",
      "会社会社で判断が異なります。",
      "部署部署の事情によって変わります。",
      "地域地域によって違います。",
      "会社会社により条件が異なります。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("valid: 読点で区切った同じ語は数えない", () => {
    assert.deepEqual(findingsOf("は、はい。資料、資料と言われても困ります。", ja, "ja"), []);
  });

  it("valid: 数と記号の重なりは数えない", () => {
    assert.deepEqual(findingsOf("１１　前項の規定による。", ja, "ja"), []);
    assert.deepEqual(findingsOf("「A」「A」の二つがあります。", ja, "ja"), []);
  });
});

describe("doubled-word — 品詞が無いとき", () => {
  const untagged: LanguageAdapter = {
    ...en,
    segment: (text) => ({ sentences: en.segment(text).sentences.map((sentence) => ({ span: sentence.span, text: sentence.text })) }),
  };

  it("品詞を返さない言語では動かさず、理由を言う", () => {
    const result = runRules(buildDocument("t.md", "Please review the the draft.", untagged), RULES.en, {}, true, "business/report");
    assert.equal(
      result.findings.some((finding) => finding.rule === "doubled-word"),
      false,
    );
    assert.ok(result.skipped.some((skip) => skip.rule === "doubled-word" && skip.why.includes("parts of speech")));
  });

  it("品詞の capability が無い言語でも理由を言う", () => {
    const noPos: LanguageAdapter = { ...untagged, capabilities: { ...en.capabilities, pos: false } };
    const result = runRules(buildDocument("t.md", "Please review the the draft.", noPos), RULES.en, {}, true, "business/report");
    assert.ok(result.skipped.some((skip) => skip.rule === "doubled-word"));
  });
});
