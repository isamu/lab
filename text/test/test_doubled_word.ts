import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import {
  doubledAt,
  doubledIn,
  gapBetween,
  isAllowed,
  isNameBefore,
  isPartOfLongerWord,
  opensPhrase,
  startsTitle,
} from "../packages/chaff/src/detectors/doubled-word.ts";
import { citedNamesOf, endsCitedName } from "../packages/chaff/src/detectors/cited-name.ts";
import type { LanguageAdapter, Lexicon, StructureNode, Token } from "../packages/chaff/src/plugin.ts";
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

const pairs = (words: readonly Word[], options: { gaps?: readonly string[]; spaced?: boolean; allowed?: Lexicon; phrases?: Lexicon } = {}): string[] => {
  const { source, tokens } = tokensOf(words, options.gaps);
  return doubledIn(source, tokens, options.spaced ?? true, options.allowed ?? [], options.phrases ?? []).map(
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

  it("文の途中の大文字 1 字の冠詞（site A、Peer A）の後ろの違う限定詞は、名前とその後ろの語。文頭と同じ語は書き損じ", () => {
    assert.deepEqual(pairs([w("site", "NOUN"), w("A", "DET", ART), w("the", "DET", ART)]), []);
    assert.deepEqual(pairs([w("plan", "NOUN"), w("A", "DET", ART), w("our", "PRON", POSS)]), []);
    assert.deepEqual(pairs([w("A", "DET", ART), w("the", "DET", ART)]), ["A the@2"]);
    assert.deepEqual(pairs([w("site", "NOUN"), w("A", "DET", ART), w("a", "DET", ART)]), ["A a@7"]);
    assert.deepEqual(pairs([w("site", "NOUN"), w("a", "DET", ART), w("the", "DET", ART)]), ["a the@7"]);
    assert.deepEqual(pairs([w("review", "VERB"), w("An", "DET", ART), w("the", "DET", ART)]), ["An the@10"]);
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
    assert.deepEqual(pairs([w("had", "VERB"), w("had", "VERB"), w("had", "VERB")], { allowed }), ["had had@8"]);
    assert.deepEqual(pairs([w("it", "PRON"), w("had", "VERB"), w("had", "VERB"), w("been", "VERB")], { allowed }), []);
    // 前の語まで書いた行は、その語が前にあるときだけ（sign in in advance と、stored in in the folder）。
    const phrasal: Lexicon = [entry("sign", "in", "in")];
    assert.deepEqual(pairs([w("sign", "VERB"), w("in", "ADP"), w("in", "ADP"), w("advance", "NOUN")], { allowed: phrasal }), []);
    assert.deepEqual(pairs([w("stored", "VERB"), w("in", "ADP"), w("in", "ADP"), w("the", "DET")], { allowed: phrasal }), ["in in@10"]);
    assert.deepEqual(pairs([w("in", "ADP"), w("in", "ADP")], { allowed: phrasal }), ["in in@3"]);
    // 後ろの語まで書いた行（set up up to 10 と、set up up the environment）。
    const upTo: Lexicon = [entry("up", "up", "to")];
    assert.deepEqual(pairs([w("set", "VERB"), w("up", "ADP"), w("up", "ADP"), w("to", "PART"), w("10", "NUM")], { allowed: upTo }), []);
    assert.deepEqual(pairs([w("set", "VERB"), w("up", "ADP"), w("up", "ADP"), w("the", "DET")], { allowed: upTo }), ["up up@7"]);
    assert.deepEqual(pairs([w("to", "PART"), w("up", "ADP"), w("up", "ADP")], { allowed: upTo }), ["up up@6"]);
    // 行の最後の語が重なりの一つ目になる並べかたは無い。
    assert.deepEqual(pairs([w("up", "ADP"), w("up", "ADP"), w("to", "PART"), w("to", "PART")], { allowed: upTo }), ["to to@9"]);
  });

  it("語に分けていない語彙表の行は何も許さない", () => {
    const { tokens } = tokensOf([w("had", "VERB"), w("had", "VERB")]);
    const [first, second] = tokens;
    assert.ok(first !== undefined && second !== undefined);
    assert.equal(isAllowed([first, second], 0, [{ pattern: "had had" }]), false);
    assert.equal(isAllowed([first, second], 0, [entry("had", "had")]), true);
    // 一語の行は重なりを言っていない。前後の語まで書いた行は、その語が並びにあるときだけ。
    assert.equal(isAllowed([first, second], 0, [entry("had")]), false);
    assert.equal(isAllowed([first, second], 0, [entry("we", "had", "had")]), false);
    assert.equal(isAllowed([first, second], 0, [entry("had", "had", "been")]), false);
  });

  it("決まった句（a priori）の頭の冠詞は、前の冠詞と並んでも書き損じではない", () => {
    const phrases = [entry("a", "priori")];
    const words = [w("the", "DET", ART), w("a", "DET", ART), w("priori", "NOUN"), w("approach", "NOUN")];
    assert.deepEqual(pairs(words, { phrases }), []);
    assert.deepEqual(pairs(words), ["the a@4"]);
    // 句の続きが無ければ句ではない。
    assert.deepEqual(pairs([w("the", "DET", ART), w("a", "DET", ART), w("report", "NOUN")], { phrases }), ["the a@4"]);
    // 同じ語の重なり（a a priori）は書き損じのまま。
    assert.deepEqual(pairs([w("a", "DET", ART), w("a", "DET", ART), w("priori", "NOUN")], { phrases }), ["a a@2"]);
    // 句より前の重なりは書き損じのまま。
    assert.deepEqual(pairs([w("the", "DET", ART), w("the", "DET", ART), w("a", "DET", ART), w("priori", "NOUN")], { phrases }), ["the the@4"]);
  });

  it("opensPhrase: 句の語が全部並んでいるときだけ。一語の行は句ではない", () => {
    const { tokens } = tokensOf([w("the", "DET"), w("A", "DET"), w("la", "X"), w("carte", "NOUN")]);
    assert.equal(opensPhrase(tokens, 1, [entry("a", "la", "carte")]), true);
    assert.equal(opensPhrase(tokens, 0, [entry("a", "la", "carte")]), false);
    assert.equal(opensPhrase(tokens, 1, [entry("a", "la", "mode")]), false);
    assert.equal(opensPhrase(tokens, 1, [entry("a")]), false);
    assert.equal(opensPhrase(tokens, 2, [entry("la", "carte", "menu")]), false);
    assert.equal(opensPhrase(tokens, 1, [{ pattern: "a la carte" }]), false);
    assert.equal(opensPhrase(tokens, 1, []), false);
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
    assert.equal(doubledAt(source, a, b, true), false);
    assert.equal(startsTitle(a, b), false);
  });
});

const nodeOf = (kind: StructureNode["kind"], start: number, attrs: StructureNode["attrs"], children: readonly StructureNode[] = []): StructureNode => ({
  kind,
  address: "",
  span: { start, end: start + 1 },
  line: 1,
  attrs,
  children,
});

describe("doubled-word — 文書の名前の重なり（純関数）", () => {
  const KINDS = new Set(["法", "規則"]);
  const tokenAt = (surface: string, end: number): Token => ({ span: { start: end - surface.length, end }, surface, pos: "NOUN" });

  it("参照の節点を入れ子の奥まで集め、名前の付いたものだけを始まりの位置で引けるようにする", () => {
    const tree = nodeOf("doc", 0, {}, [
      nodeOf("section", 0, {}, [nodeOf("reference", 4, { document: "法法" }), nodeOf("reference", 20, {})]),
      nodeOf("reference", 30, { document: "民法" }),
      nodeOf("definition", 40, { document: "所法" }),
      nodeOf("reference", 50, { document: 3 }),
    ]);
    assert.deepEqual(
      [...citedNamesOf(tree)],
      [
        [4, "法法"],
        [30, "民法"],
      ],
    );
    assert.equal(citedNamesOf(undefined).size, 0);
  });

  it("valid: 番地のすぐ前の文書の名前が、頭の一字と種類の一字の重なりそのものなら、名前", () => {
    assert.equal(endsCitedName(tokenAt("法", 1), tokenAt("法", 2), new Map([[2, "法法"]]), KINDS), true);
  });

  it("invalid: 種類の語でない語、二字の種類の語、名前の一部だけの重なり、参照に届かない語、名前の無い参照は書き損じのまま", () => {
    assert.equal(endsCitedName(tokenAt("民法", 2), tokenAt("民法", 4), new Map([[4, "民法民法"]]), KINDS), false);
    assert.equal(endsCitedName(tokenAt("規則", 2), tokenAt("規則", 4), new Map([[4, "規則規則"]]), KINDS), false);
    assert.equal(endsCitedName(tokenAt("法", 2), tokenAt("法", 3), new Map([[3, "旧法法"]]), KINDS), false);
    assert.equal(endsCitedName(tokenAt("法", 1), tokenAt("法", 2), new Map([[3, "法法"]]), KINDS), false);
    assert.equal(endsCitedName(tokenAt("法", 1), tokenAt("法", 2), new Map(), KINDS), false);
    assert.equal(endsCitedName(tokenAt("法", 1), tokenAt("法", 2), new Map([[2, "法法"]]), new Set()), false);
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
    assert.deepEqual(findingsOf("A the report is attached.", en, "en"), ["1:3 A the"]);
    assert.deepEqual(findingsOf("The plan is is ready for review.", en, "en"), ["1:13 is is"]);
  });

  it("invalid: 行をまたいでも、大文字で始まっても同じ語", () => {
    assert.deepEqual(findingsOf("Please send the\nthe report to finance.", en, "en"), ["2:1 the the"]);
    assert.deepEqual(findingsOf("The the report is attached.", en, "en"), ["1:5 The the"]);
    assert.deepEqual(findingsOf("Please review the The draft.", en, "en"), ["1:19 the The"]);
    assert.deepEqual(findingsOf("Please review The the draft before Friday.", en, "en"), ["1:19 The the"]);
    assert.deepEqual(findingsOf("The vendor had had had enough time to respond.", en, "en"), ["1:20 had had"]);
    assert.deepEqual(findingsOf("The file is stored in in the shared folder.", en, "en"), ["1:23 in in"]);
    assert.deepEqual(findingsOf("Set up up the environment first.", en, "en"), ["1:8 up up"]);
  });

  it("valid: 文法が許す重なりと、並んでよい限定詞は数えない", () => {
    const valid = [
      "He had had enough of the delays.",
      "I think that that is fine.",
      "Give her the book before the meeting.",
      "We sent her our report before the meeting.",
      "Please give her her copy of the signed agreement.",
      "No no, we should not deploy today.",
      "Please sign in in advance.",
      "Customers can opt in in May.",
      "Users who logged in in March kept access.",
      "Set up up to 10 projects before launch.",
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
      "If at site A the connection no longer exists, site B is told.",
      "Under plan B the team ships first.",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, en, "en"), [], text));
  });

  it("valid: 冠詞のような語で始まる決まった句（a priori）は、前の冠詞と重なっていない", () => {
    const valid = [
      "This is meant to be analogous to the a priori trusted origin concept.",
      "We reject the a posteriori argument.",
      "It is an a fortiori case.",
      "Order from our A la carte menu.",
      "The a cappella group sang.",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, en, "en"), [], text));
  });

  it("invalid: 句でなければ、句の前でも冠詞の重なりは書き損じ", () => {
    assert.deepEqual(findingsOf("Please send the a report on the a priori method.", en, "en"), ["1:17 the a"]);
    assert.deepEqual(findingsOf("It is the a prior approach.", en, "en"), ["1:11 the a"]);
    assert.deepEqual(findingsOf("This is a a priori argument.", en, "en"), ["1:11 a a"]);
    assert.deepEqual(findingsOf("Use a a la carte menu.", en, "en"), ["1:7 a a"]);
  });

  it("決まった句の語彙表を持たない言語では、句の前の冠詞も重なりとして数える", () => {
    const bare: LanguageAdapter = { ...en, lexicons: Object.fromEntries(Object.entries(en.lexicons).filter(([name]) => name !== "fixed-phrase")) };
    assert.deepEqual(findingsOf("We reject the a posteriori argument.", bare, "en"), ["1:15 the a"]);
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

  it("invalid: 付属語（助詞・助動詞）が続けば、二つ目の位置で出す", () => {
    assert.deepEqual(findingsOf("資料をを送ります。", ja, "ja"), ["1:4 をを"]);
    assert.deepEqual(findingsOf("私のの本です。", ja, "ja"), ["1:3 のの"]);
  });

  // #412 の実文書で当たりだった重なり。語句だけを使った自作の文。
  it("invalid: 付属語の重なりと、付く先のある非自立の語の重なりは数える", () => {
    assert.deepEqual(findingsOf("プロダクトをを作ります。", ja, "ja"), ["1:7 をを"]);
    assert.deepEqual(findingsOf("その話にに出ました。", ja, "ja"), ["1:5 にに"]);
    assert.deepEqual(findingsOf("新しい方式に置き換えられたた。", ja, "ja"), ["1:14 たた"]);
    assert.deepEqual(findingsOf("世の中がが変わります。", ja, "ja"), ["1:5 がが"]);
    assert.deepEqual(findingsOf("資料を配っているいる。", ja, "ja"), ["1:9 いるいる"]);
    assert.deepEqual(findingsOf("そうですよよね。", ja, "ja"), ["1:6 よよ"]);
  });

  it("invalid: 内容語でも三つ続けば、二つ目と三つ目の重なりを出す", () => {
    assert.deepEqual(findingsOf("早め早め早めに動きます。", ja, "ja"), ["1:5 早め早め"]);
    assert.deepEqual(findingsOf("資料資料資料が届きました。", ja, "ja"), ["1:5 資料資料"]);
  });

  it("valid: 内容語（名詞・形容詞）を丸ごと重ねた形は畳語か強めで、数えない（#412）", () => {
    const valid = [
      "個人個人の考えを聞きます。",
      "一行一行を読み直します。",
      "それそれ、と頷きました。",
      "駄目駄目です。",
      "嫌い嫌い。",
      "えらいえらい。",
      "若い若い。",
      "蓼食う虫も好き好きです。",
      "そんなのはお茶の子さいさいです。",
      "このパンはもちもちです。",
      "雲がムクムクと湧きます。",
      "車でブイブイ言わせます。",
      "煙がブスブスと出ます。",
      "ババババと音がします。",
      "内容を確認確認します。",
      "資料資料が届きました。",
      "会社会社を訪問します。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("valid: 一字の仮名の三つ以上の並び（笑い声）と、語彙表の決まった言い回しは数えない（#412）", () => {
    const valid = [
      "ははは、と笑いました。",
      "あははは、と笑いました。",
      "ふふふと笑う。",
      "りんご、みかん、などなど。",
      "それはあるあるです。",
      "知ったかか、と言われました。",
      "前置きはほどほどにします。",
      "代わる代わるコーディングします。",
      "めでたしめでたし。",
      "またまた基礎の話です。",
      "これは私の研究です、えへへ。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("invalid: 片仮名の外来語の重なりは、擬音の形でも副詞の位置に立たなければ書き損じ", () => {
    assert.deepEqual(findingsOf("テストテストを実行します。", ja, "ja"), ["1:4 テストテスト"]);
    assert.deepEqual(findingsOf("メモメモ。", ja, "ja"), ["1:3 メモメモ"]);
    assert.deepEqual(findingsOf("ユーザーユーザー、確認します。", ja, "ja"), ["1:5 ユーザーユーザー"]);
  });

  it("invalid: 一字の仮名は二つなら書き損じ。三つでも前の語に付いていれば書き損じ", () => {
    assert.deepEqual(findingsOf("私ははそう思います。", ja, "ja"), ["1:3 はは"]);
    assert.deepEqual(findingsOf("資料ををを送ります。", ja, "ja"), ["1:4 をを", "1:5 をを"]);
    assert.deepEqual(findingsOf("世の中ががが変わります。", ja, "ja"), ["1:5 がが", "1:6 がが"]);
    assert.deepEqual(findingsOf("昨日行ったたたので疲れた。", ja, "ja"), ["1:6 たた", "1:7 たた"]);
    assert.deepEqual(findingsOf("ををを送ります。", ja, "ja"), ["1:2 をを", "1:3 をを"]);
    assert.deepEqual(findingsOf("よよよね。", ja, "ja"), ["1:2 よよ", "1:3 よよ"]);
    assert.deepEqual(findingsOf("私ははは元気です。", ja, "ja"), ["1:3 はは", "1:4 はは"]);
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
      "気象情報を活用して、早め早めの避難行動を心がけてください。",
      "早め早めに準備してください。",
      "チームでの参加の場合も、個人個人で申し込みが必要です。",
      "場面場面で使い分けます。",
      "会社会社で判断が異なります。",
      "部署部署の事情によって変わります。",
      "地域地域によって違います。",
      "会社会社により条件が異なります。",
      "会社会社による違いがあります。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("valid: 話し言葉の重ね言葉（国会の会議録）は数えない", () => {
    const valid = [
      "そういった段階段階のところをきっちりと制度上つくっていくことが重要です。",
      "段階段階で確認します。",
      "濫用的な通報というのは、繰り返し繰り返し来る通報のことだと思います。",
      "繰り返し繰り返し説明しました。",
      "要するに、労働者ががんがんじゃなくて経営者が報復する。",
      "がんがん進めてください。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("invalid: 重ね言葉と同じ形でも書き損じは数える", () => {
    assert.deepEqual(findingsOf("昨日行ったたので疲れた。", ja, "ja"), ["1:6 たた"]);
  });

  it("valid: 番地のすぐ前の法令の略称（法法 = 法人税法）は名前で、重なりに数えない", () => {
    const valid = [
      "所法第67条の2第1項又は法法第64条の2第1項の規定により売買があったものとされる。",
      "法法第六十四条の規定による。",
      "詳しくは法法第22条第4項を参照。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("invalid: 番地が続かない一字の略称は数える", () => {
    assert.deepEqual(findingsOf("法法の規定による。", ja, "ja"), ["1:2 法法"]);
  });

  it("valid: 動詞・形容詞を連用形や命令形のまま重ねた形（青空文庫の小説・戯曲・歌集）は数えない", () => {
    const valid = [
      "身は波の上。枕。流せ流せ」と囃している。",
      "待て待て、そこで、さうしてゝ見ろ。",
      "長く長く忘れし友に",
      "死ね死ねと己を怒り",
      "止せ止せ問答",
      "早く早くしてください。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("invalid: 同じ活用の重なりでも、非自立の語・一文字の語・語尾が続く重なりは数える", () => {
    assert.deepEqual(findingsOf("確認してくださいください。", ja, "ja"), ["1:9 くださいください"]);
    assert.deepEqual(findingsOf("確認できできます。", ja, "ja"), ["1:5 できでき"]);
    assert.deepEqual(findingsOf("準備ができできて安心した。", ja, "ja"), ["1:6 できでき"]);
    assert.deepEqual(findingsOf("確認ししました。", ja, "ja"), ["1:4 しし"]);
  });

  it("valid: 仮名の擬音・擬態語、一字の漢字の畳語、五段動詞の連用形に「て」が続く重ね言葉（青空文庫の歌集・小説）は数えない", () => {
    const valid = [
      "きしきしと寒さに踏めば板軋む",
      "ちょんちょんと\nとある小藪に頬白の遊ぶを眺む",
      "たんたらたらたんたらたらと\n雨滴が",
      "凄いものが手元から、すうすうと逃げて行くように思われる。",
      "しかし捕まえるものがないから、しだいしだいに水に近づいて来る。",
      "森の奥より銃声聞ゆ\nあはれあはれ\n自ら死ぬる音のよろしさ",
      "家家の高低の軒に",
      "朝朝の\nうがひの料の水薬の",
      "六年ほど日毎日毎にかぶりたる",
      "売り売りて\n手垢きたなきドイツ語の辞書のみ残る",
      "木木の緑が濃くなりました。",
      "神神の住む山です。",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text, ja, "ja"), [], text));
  });

  it("invalid: 仮名の語でも、接尾語・語尾・助詞の重なりや、副詞の位置に立たない重なりは数える", () => {
    assert.deepEqual(findingsOf("田中さんさんに連絡します。", ja, "ja"), ["1:5 さんさん"]);
    assert.deepEqual(findingsOf("確認できるできるように準備します。", ja, "ja"), ["1:6 できるできる"]);
    assert.deepEqual(findingsOf("着いたらたら連絡します。", ja, "ja"), ["1:5 たらたら"]);
    assert.deepEqual(findingsOf("本日は確認ですです。", ja, "ja"), ["1:8 ですです"]);
    assert.deepEqual(findingsOf("制御するためののコントロール。", ja, "ja"), ["1:8 のの"]);
    assert.deepEqual(findingsOf("ユーザーユーザー、確認します。", ja, "ja"), ["1:5 ユーザーユーザー"]);
    assert.deepEqual(findingsOf("データデータ、確認します。", ja, "ja"), ["1:4 データデータ"]);
    assert.deepEqual(findingsOf("対応できるできると回答しました。", ja, "ja"), ["1:6 できるできる"]);
  });

  it("invalid: 々 を付けて畳語にならない一字の漢字の重なりは数える（金金は強めて繰り返した言い方だが、書き損じと形では見分けられない）", () => {
    assert.deepEqual(findingsOf("法法の規定による。", ja, "ja"), ["1:2 法法"]);
    assert.deepEqual(findingsOf("何事も金金とわらひ", ja, "ja"), ["1:5 金金"]);
  });

  it("valid: 読点で区切った同じ語は数えない", () => {
    assert.deepEqual(findingsOf("は、はい。資料、資料と言われても困ります。", ja, "ja"), []);
  });

  it("valid: 数と記号の重なりは数えない", () => {
    assert.deepEqual(findingsOf("１１　前項の規定による。", ja, "ja"), []);
    assert.deepEqual(findingsOf("「A」「A」の二つがあります。", ja, "ja"), []);
  });

  // 最高裁判決（パブリックドメイン）を縮めた文。同じ文の「にもかかわらず」の かか は一語（かかわる）の中で、書き損じは うかかが の方。
  it("一語の中の同じ仮名（にもかかわらず）は数えず、書き損じ（うかかがわれない）は数える", () => {
    assert.deepEqual(findingsOf("報告を求められたにもかかわらず報告しなかった。", ja, "ja"), []);
    assert.deepEqual(findingsOf("報告を求められたにもかかわらず，事情があったことはうかかがわれない。", ja, "ja"), ["1:28 かか"]);
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
