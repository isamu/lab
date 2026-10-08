import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { agreementIn, endsNounPhrase, type AgreementLists } from "../packages/chaff/src/detectors/agreement-slip.ts";
import type { LanguageAdapter, Lexicon, Token } from "../packages/chaff/src/plugin.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

type Word = { readonly surface: string; readonly pos: string; readonly lemma?: string; readonly features?: Readonly<Record<string, string>> };

const tokensOf = (words: readonly Word[]): { source: string; tokens: Token[] } =>
  words.reduce<{ source: string; tokens: Token[] }>(
    (acc, word, index) => {
      const gap = index === 0 ? "" : " ";
      const start = acc.source.length + gap.length;
      const token: Token = { span: { start, end: start + word.surface.length }, ...word };
      return { source: `${acc.source}${gap}${word.surface}`, tokens: [...acc.tokens, token] };
    },
    { source: "", tokens: [] },
  );

const w = (surface: string, pos: string, features?: Readonly<Record<string, string>>, lemma?: string): Word => ({
  surface,
  pos,
  ...(features === undefined ? {} : { features }),
  ...(lemma === undefined ? {} : { lemma }),
});
const ART = { PronType: "Art" };
const PLUR = { Number: "Plur" };
const PART = { VerbForm: "Part" };

const lexicon = (...patterns: readonly string[]): Lexicon => patterns.map((pattern) => ({ pattern }));

const LISTS: AgreementLists = {
  singular: lexicon("a", "an", "each", "this"),
  plural: lexicon("these", "one of the"),
  invariant: new Set(["series", "data"]),
  count: new Set(["few"]),
  possessive: new Set(["your", "their"]),
  finite: new Set(["is"]),
  misnumbered: lexicon("ones of the most"),
};

const slips = (words: readonly Word[], lists: AgreementLists = LISTS): string[] => {
  const { source, tokens } = tokensOf(words);
  return agreementIn(source, tokens, lists).map((slip) => `${slip.variant} ${slip.word}`);
};

const A = w("a", "DET", ART);
const END = w(".", "PUNCT");

describe("agreement-slip — 純関数", () => {
  it("単数の冠詞の後ろの複数の名詞は、形容詞を挟んでも数える", () => {
    assert.deepEqual(slips([A, w("changes", "NOUN", PLUR, "change"), END]), ["number a changes"]);
    assert.deepEqual(slips([A, w("significant", "ADJ"), w("changes", "NOUN", PLUR, "change"), w("in", "ADP")]), ["number a significant changes"]);
    assert.deepEqual(slips([A, w("revised", "VERB", PART), w("rules", "NOUN", PLUR, "rule"), END]), ["number a revised rules"]);
  });

  it("形容詞や数の後ろの a は冠詞でなく記号の名前なので数えない", () => {
    const indices = w("indices", "NOUN", PLUR, "index");
    assert.deepEqual(slips([w("the", "DET", ART), w("eight", "NUM"), w("hourly", "ADJ"), A, indices, END]), []);
    assert.deepEqual(slips([w("the", "DET", ART), w("eight", "NUM"), A, indices, END]), []);
    assert.deepEqual(slips([w("the", "DET", ART), w("new", "ADJ"), w("an", "DET", ART), w("options", "NOUN", PLUR, "option"), END]), ["number an options"]);
    assert.deepEqual(slips([w("on", "ADP"), A, w("tropical", "ADJ"), w("islands", "NOUN", PLUR, "island"), END]), ["number a tropical islands"]);
    assert.deepEqual(slips([w("such", "DET"), A, w("great", "ADJ"), w("results", "NOUN", PLUR, "result"), END]), ["number a great results"]);
    assert.deepEqual(slips([w("eight", "NUM"), w("these", "DET"), w("new", "ADJ"), w("feature", "NOUN"), END]), ["number these new feature"]);
  });

  it("複数の限定詞・句の後ろの単数の名詞を数える", () => {
    assert.deepEqual(slips([w("these", "DET"), w("new", "ADJ"), w("feature", "NOUN"), END]), ["number these new feature"]);
    assert.deepEqual(slips([w("one", "NUM"), w("of", "ADP"), w("the", "DET", ART), w("best", "ADJ"), w("way", "NOUN"), END]), ["number one of the best way"]);
    assert.deepEqual(slips([w("one", "NUM"), w("of", "ADP"), w("the", "DET", ART), w("way", "NOUN"), END]), ["number one of the way"]);
  });

  it("冠詞でない限定詞は、代名詞に読めるので、形容詞を挟まない名詞を数えない", () => {
    assert.deepEqual(slips([w("this", "DET"), w("results", "NOUN", PLUR, "result"), w("in", "ADP")]), []);
    assert.deepEqual(slips([w("these", "DET"), w("help", "NOUN"), w("to", "PART")]), []);
    assert.deepEqual(slips([w("this", "DET"), w("often", "ADV"), w("results", "NOUN", PLUR, "result"), w("in", "ADP")]), []);
    assert.deepEqual(slips([w("this", "DET"), w("required", "VERB", PART), w("changes", "NOUN", PLUR, "change"), w("in", "ADP")]), []);
    assert.deepEqual(slips([w("this", "DET"), w("new", "ADJ"), w("rules", "NOUN", PLUR, "rule"), END]), ["number this new rules"]);
  });

  it("名詞が動詞にも読め、前に名詞句の頭になれる語があれば、主語と動詞かもしれないので数えない", () => {
    const works = w("works", "NOUN", { Number: "Plur", AlsoVerb: "Yes" }, "work");
    assert.deepEqual(slips([w("an", "DET", ART), w("individual", "ADJ", { AlsoNoun: "Yes" }), works, END]), []);
    assert.deepEqual(slips([w("an", "DET", ART), w("individual", "ADJ"), works, END]), ["number an individual works"]);
    assert.deepEqual(slips([w("an", "DET", ART), works, END]), ["number an works"]);
    const report = w("report", "NOUN", { AlsoVerb: "Yes" });
    assert.deepEqual(slips([w("these", "DET"), w("responsible", "ADJ"), report, w("to", "ADP")]), []);
    assert.deepEqual(slips([w("these", "DET"), w("responsible", "ADJ"), w("person", "NOUN"), w("to", "ADP")]), ["number these responsible person"]);
    assert.deepEqual(slips([w("these", "DET"), w("key", "ADJ", { AlsoNoun: "Yes" }), report, w("is", "VERB")]), ["number these key report"]);
    assert.deepEqual(slips([w("an", "DET", ART), w("arbitral", "ADJ"), w("tribunal", "ADJ", { Guess: "Yes" }), works, w("an", "DET", ART)]), []);
    assert.deepEqual(slips([w("an", "DET", ART), w("arbitral", "ADJ"), w("tribunal", "ADJ"), works, w("an", "DET", ART)]), [
      "number an arbitral tribunal works",
    ]);
    assert.deepEqual(slips([w("these", "DET"), w("new", "ADJ"), w("feature", "NOUN"), END]), ["number these new feature"]);
  });

  it("数は合っていれば数えない", () => {
    assert.deepEqual(slips([A, w("change", "NOUN"), END]), []);
    assert.deepEqual(slips([w("these", "DET"), w("new", "ADJ"), w("features", "NOUN", PLUR, "feature"), END]), []);
  });

  it("単数と複数が同じ綴りの語、表層と原形が同じ複数、数の形容詞、数は数えない", () => {
    assert.deepEqual(slips([A, w("series", "NOUN", PLUR, "series"), END]), []);
    assert.deepEqual(slips([A, w("data", "NOUN", PLUR, "datum"), END]), []);
    assert.deepEqual(slips([A, w("lens", "NOUN", PLUR, "lens"), END]), []);
    assert.deepEqual(slips([w("these", "DET"), w("new", "ADJ"), w("stimuli", "NOUN", { Guess: "Yes" }), END]), []);
    assert.deepEqual(slips([w("these", "DET"), w("new", "ADJ"), w("stimuli", "NOUN"), END]), ["number these new stimuli"]);
    assert.deepEqual(slips([A, w("few", "ADJ"), w("days", "NOUN", PLUR, "day"), END]), []);
    assert.deepEqual(slips([w("an", "DET", ART), w("estimated", "VERB", PART), w("5", "NUM"), w("people", "NOUN", PLUR, "person"), END]), []);
  });

  it("名詞が次の名詞を修飾していれば（a sales team）、名詞句の終わりではないので数えない", () => {
    assert.deepEqual(slips([A, w("sales", "NOUN", PLUR, "sale"), w("team", "NOUN")]), []);
    assert.deepEqual(slips([A, w("sales", "NOUN", PLUR, "sale"), w("and", "CCONJ"), w("marketing", "NOUN")]), []);
    assert.deepEqual(slips([A, w("data", "NOUN", PLUR, "datum"), w("driven", "VERB", PART)]), []);
    assert.deepEqual(slips([A, w("sales", "NOUN", PLUR, "sale"), w(",", "PUNCT")]), []);
    assert.deepEqual(slips([A, w("year", "NOUN"), w("'s", "PART")]), []);
  });

  it("大文字で始まる名詞は名前（a Terms page）", () => {
    assert.deepEqual(slips([A, w("Terms", "NOUN", PLUR, "term"), END]), []);
  });

  it("文の途中の大文字の冠詞は名前の一部（Plan A users）", () => {
    assert.deepEqual(slips([w("Plan", "PROPN"), w("A", "DET", ART), w("users", "NOUN", PLUR, "user"), END]), []);
    assert.deepEqual(slips([w("A", "DET", ART), w("users", "NOUN", PLUR, "user"), END]), ["number A users"]);
  });

  it("所有の語の直後の be と、助動詞 + 動詞の原形を数える", () => {
    assert.deepEqual(slips([w("their", "PRON"), w("is", "VERB"), w("no", "DET")]), ["possessive their is"]);
    assert.deepEqual(slips([w("Your", "PRON"), w("can", "AUX"), w("check", "VERB")]), ["possessive Your can"]);
  });

  it("所有の語の後ろが名詞に読める助動詞（your will must）や名詞なら数えない", () => {
    assert.deepEqual(slips([w("your", "PRON"), w("will", "AUX"), w("must", "AUX")]), []);
    assert.deepEqual(slips([w("your", "PRON"), w("can", "AUX"), w("signed", "VERB", PART)]), []);
    assert.deepEqual(slips([w("your", "PRON"), w("account", "NOUN"), w("is", "VERB")]), []);
    assert.deepEqual(slips([w("his", "PRON"), w("is", "VERB")]), []);
    assert.deepEqual(slips([w("Your", "PRON"), w("IS", "VERB")]), []);
  });

  it("複数で書いた句（ones of the most）は、限定詞・形容詞・代名詞の後ろでなければ数える", () => {
    const phrase = [w("ones", "NOUN", PLUR, "one"), w("of", "ADP"), w("the", "DET", ART), w("most", "ADV")];
    assert.deepEqual(slips([w("remains", "VERB"), ...phrase]), ["number ones of the most"]);
    assert.deepEqual(slips([w("the", "DET", ART), ...phrase]), []);
    assert.deepEqual(slips([w("new", "ADJ"), ...phrase]), []);
  });

  it("語彙表が空なら何も数えない", () => {
    const empty: AgreementLists = {
      singular: [],
      plural: [],
      invariant: new Set(),
      count: new Set(),
      possessive: new Set(),
      finite: new Set(),
      misnumbered: [],
    };
    assert.deepEqual(slips([A, w("changes", "NOUN", PLUR, "change"), END], empty), []);
    assert.deepEqual(slips([w("their", "PRON"), w("is", "VERB")], empty), []);
  });

  it("名詞句の終わり: 文末・助動詞・前置詞・文末の記号は終わり、名詞・動詞・接続詞・読点・所有の印は続き", () => {
    assert.equal(endsNounPhrase(undefined, LISTS.finite), true);
    ["AUX", "ADP", "SCONJ", "PRON", "DET", "ADV"].forEach((pos) =>
      assert.equal(endsNounPhrase({ span: { start: 0, end: 1 }, surface: "x", pos }, LISTS.finite), true, pos),
    );
    [".", ";", ":", "?", "!", ")"].forEach((mark) =>
      assert.equal(endsNounPhrase({ span: { start: 0, end: 1 }, surface: mark, pos: "PUNCT" }, LISTS.finite), true, mark),
    );
    ["NOUN", "PROPN", "VERB", "ADJ", "NUM", "CCONJ", "PART", "X", "SYM"].forEach((pos) =>
      assert.equal(endsNounPhrase({ span: { start: 0, end: 1 }, surface: "x", pos }, LISTS.finite), false, pos),
    );
    [",", "(", "-"].forEach((mark) => assert.equal(endsNounPhrase({ span: { start: 0, end: 1 }, surface: mark, pos: "PUNCT" }, LISTS.finite), false, mark));
    assert.equal(endsNounPhrase({ span: { start: 0, end: 1 }, surface: "driven", pos: "VERB", features: PART }, LISTS.finite), false);
    assert.equal(endsNounPhrase({ span: { start: 0, end: 1 }, surface: "using", pos: "VERB", features: { VerbForm: "Ger" } }, LISTS.finite), false);
    assert.equal(endsNounPhrase({ span: { start: 0, end: 2 }, surface: "is", pos: "VERB" }, LISTS.finite), true);
  });

  const at = (surface: string, start: number, pos: string, features?: Readonly<Record<string, string>>, lemma?: string): Token => ({
    span: { start, end: start + surface.length },
    surface,
    pos,
    ...(features === undefined ? {} : { features }),
    ...(lemma === undefined ? {} : { lemma }),
  });

  it("長い語の一部（1a changes）、印を挟んだ所有の語と be、印を挟んだ句は数えない", () => {
    assert.deepEqual(agreementIn("1a changes.", [at("a", 1, "DET", ART), at("changes", 3, "NOUN", PLUR, "change"), at(".", 10, "PUNCT")], LISTS), []);
    assert.deepEqual(agreementIn("your `is`", [at("your", 0, "PRON"), at("is", 6, "VERB")], LISTS), []);
    const ones = [at("ones", 0, "NOUN", PLUR, "one"), at("of", 5, "ADP"), at("the", 9, "DET", ART), at("most", 14, "ADV")];
    assert.deepEqual(agreementIn("ones of `the` most", ones, LISTS), []);
  });

  it("語のあいだに空白以外（コードの印・リンク）があれば一続きではない", () => {
    const source = "a `changes`.";
    const tokens: Token[] = [
      { span: { start: 0, end: 1 }, surface: "a", pos: "DET", features: ART },
      { span: { start: 3, end: 10 }, surface: "changes", pos: "NOUN", features: PLUR, lemma: "change" },
      { span: { start: 11, end: 12 }, surface: ".", pos: "PUNCT" },
    ];
    assert.deepEqual(agreementIn(source, tokens, LISTS), []);
  });
});

const RULES = { ja: loadRules("ja"), en: loadRules("en") };

const findingsOf = (source: string, adapter: LanguageAdapter = en, language: "ja" | "en" = "en"): string[] =>
  runRules(buildDocument("t.md", source, adapter), RULES[language], {}, true, "business/report")
    .findings.filter((finding) => finding.rule === "agreement-slip")
    .map((finding) => `${String(finding.line)}:${String(finding.column)} ${String(finding.values["word"])}`);

describe("agreement-slip — 英語", () => {
  before(async () => {
    await en.prepare?.({ pos: true });
  });

  it("invalid: corpus で見つかった書き損じ（#274）", () => {
    assert.deepEqual(findingsOf("Your can check the status of your key."), ["1:1 Your can"]);
    assert.deepEqual(findingsOf("The problem remains ones of the most intriguing questions."), ["1:21 ones of the most"]);
    assert.deepEqual(findingsOf("The results show a significant changes in accuracy."), ["1:18 a significant changes"]);
  });

  it("invalid: 限定詞と名詞の数の食い違い", () => {
    assert.deepEqual(findingsOf("We saw a changes in the log."), ["1:8 a changes"]);
    assert.deepEqual(findingsOf("An studies of this kind are rare."), ["1:1 An studies"]);
    assert.deepEqual(findingsOf("These new version will ship in May."), ["1:1 These new version"]);
    assert.deepEqual(findingsOf("These key result is missing."), ["1:1 These key result"]);
    assert.deepEqual(findingsOf("Each new users is sent a welcome email."), ["1:1 Each new users"]);
    assert.deepEqual(findingsOf("Their is no limit on requests."), ["1:1 Their is"]);
  });

  it("valid: 正しい文と、読みが一通りに決まらない文", () => {
    const valid = [
      "This results in a loss.",
      "This changes everything.",
      "These help to fix the build.",
      "These data sets are a series of news reports.",
      "A few days later, a number of users wrote in.",
      "We need a sales and marketing team.",
      "We need a sales team and a data driven approach.",
      "One of the most important features is speed.",
      "I know some one of the name of Cecily.",
      "One of the team members will call you.",
      "An estimated 5 million people use it.",
      "This means users can sign in.",
      "Plan A users keep their discount.",
      "Your will must be signed. His is red.",
      "You can check the status of your key.",
      "There is no limit on requests.",
      "The ones of the most interest are listed.",
      "Each of the users gets an email.",
      "This year's results are in.",
      "A great many people came.",
      "Usual number of hours an individual works.",
      "An arbitral tribunal makes an award on a summary basis.",
      "Those responsible report to the board.",
      "Plan an extra several hours at the beginning of the day.",
      "Your AM also reviews the plan.",
      "These new stimuli will ship in May.",
      "These new zxqvbug will ship in May.",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text), [], text));
  });

  it("valid: 名詞にもなる -ing 形の後ろの動詞は、主語と動詞（#621）", () => {
    const valid = [
      "A heading counts as stated when the other document has the same heading.",
      "A finding points at the line and column in the file.",
      "Dropping them would let you believe a setting works when it does not.",
    ];
    valid.forEach((text) => assert.deepEqual(findingsOf(text), [], text));
  });

  it("invalid: 名詞にならない -ing 形は修飾語のまま（#621）", () => {
    assert.deepEqual(findingsOf("We found a missing values in the table."), ["1:10 a missing values"]);
  });

  it("文学と書き起こしでは、ジャンルが止めて理由を言う（台詞や話し言葉の形は書き手の選択）", () => {
    ["literature/fiction", "speech/transcript"].forEach((genre) => {
      const result = runRules(buildDocument("t.md", "Your can check the status.", en), RULES.en, {}, true, genre);
      assert.equal(
        result.findings.some((finding) => finding.rule === "agreement-slip"),
        false,
        genre,
      );
      assert.ok(
        result.skipped.some((skip) => skip.rule === "agreement-slip"),
        genre,
      );
    });
  });

  it("日本語では動かさない（英語の rule）", () => {
    assert.deepEqual(findingsOf("資料を送ります。", ja, "ja"), []);
  });
});
