import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { guessLanguage } from "../packages/chaff/src/detect.ts";
import { sentenceLength } from "../packages/chaff/src/detectors/sentence-length.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// A Japanese document with an English abstract, and the other way round. Self-written text.

const textsOf = (adapter: LanguageAdapter, source: string): string[] => adapter.segment(source).sentences.map((sentence) => sentence.text);

const ABSTRACT =
  "With aging of the population, rehabilitation needs have been increasing globally. " +
  "In Japan, the provision of services has expanded since the end of the war. " +
  "This paper summarizes the systems that provide it.";

describe("和文の中の英文を英語の句点で切る", () => {
  it("英語の段落は英文の文末で切れる", () => {
    assert.deepEqual(textsOf(ja, ABSTRACT), [
      "With aging of the population, rehabilitation needs have been increasing globally.",
      "In Japan, the provision of services has expanded since the end of the war.",
      "This paper summarizes the systems that provide it.",
    ]);
  });

  it("文の位置は元の文字列のまま", () => {
    const source = `今日，高齢化が進んでいる．\n\n${ABSTRACT}`;
    ja.segment(source).sentences.forEach((sentence) => assert.equal(source.slice(sentence.span.start, sentence.span.end), sentence.text));
  });

  it("英文の中の略語では切らない", () => {
    assert.deepEqual(textsOf(ja, "Dr. Smith met the U.S. team in March. They agreed on the plan."), [
      "Dr. Smith met the U.S. team in March.",
      "They agreed on the plan.",
    ]);
  });

  it("英文の中の年の後のピリオドでも切る", () => {
    // 分割器は「1997.」を箇条書きの番号と読んで切らない。英語のアダプタと同じ手当て。
    assert.deepEqual(textsOf(ja, "Speech therapists followed in 1997. Programs are run at universities."), [
      "Speech therapists followed in 1997.",
      "Programs are run at universities.",
    ]);
  });

  it("英文の印は英文だけに付き、長さは語で数える", () => {
    const sentences = ja.segment(`${ABSTRACT}\n本稿では整理する。`).sentences;
    assert.deepEqual(
      sentences.map((sentence) => sentence.embeddedLanguage),
      [...Array.from({ length: 3 }, () => ({ id: "en", lengthUnit: "word" })), undefined],
    );
  });

  // 和文の途中の英字とピリオドは、前と同じく和文の一部として読む。
  const JAPANESE_ONLY = [
    "本日は、Dr. 田中が来た。",
    "Version 2.0. を使う。",
    "See Fig. 1. これは図。",
    "東京 (Tokyo). 次に行く。",
    "Acme Inc. の担当者は来た。",
    // 同じ行で英文の後に和文が続くときは切らない。英字の語の後のピリオドと見分けられないため。
    "Then it grew. 本稿では整理する。",
  ];
  it("年だけの短い英文でも切る", () => {
    // 数字は英字とも和字とも数えない。数えると「In 1997.」が英文でなくなり、次の文とつながる。
    assert.deepEqual(textsOf(ja, "In 1997. Programs start."), ["In 1997.", "Programs start."]);
  });

  it("英字の後の全角の「．」は英文の文末と読まない", () => {
    // 和文の規則のとおり、「．」は仮名・漢字の後だけ文末。英語の文末は半角の . ? ! に限る。
    assert.deepEqual(textsOf(ja, "See Table A． Then compare the rows."), ["See Table A． Then compare the rows."]);
  });

  it("英字が多くても仮名があれば和文", () => {
    const source = "chaff lint README.md --fix を実行する。";
    assert.equal(ja.segment(source).sentences[0]?.embeddedLanguage, undefined);
  });

  it("仮名が無くても英字が半分に満たなければ英文ではない", () => {
    assert.equal(ja.segment("東京都港区芝公園 2024-12-06 A.").sentences[0]?.embeddedLanguage, undefined);
  });

  JAPANESE_ONLY.forEach((source) => {
    it(`和文の中の英字では切らない: ${source}`, () => {
      assert.deepEqual(textsOf(ja, source), [source]);
      assert.equal(ja.segment(source).sentences[0]?.embeddedLanguage, undefined);
    });
  });
});

describe("英文の中の和文", () => {
  it("和文は日本語の印が付き、文字で数える", () => {
    const sentences = en.segment("The survey asked one question. 回答者の多くは、制度の名前を知らなかったと答えた。").sentences;
    assert.deepEqual(
      sentences.map((sentence) => sentence.embeddedLanguage),
      [undefined, { id: "ja", lengthUnit: "char" }],
    );
  });

  it("数字の多い和文も日本語の印が付く", () => {
    assert.deepEqual(en.segment("2024年12月16日から2025年12月31日まで。").sentences[0]?.embeddedLanguage, { id: "ja", lengthUnit: "char" });
  });

  it("仮名の無い漢字だけの文は日本語と読まない", () => {
    assert.equal(en.segment("中华人民共和国国务院办公厅发布通知。").sentences[0]?.embeddedLanguage, undefined);
  });

  it("日本語の語を一つ含むだけの英文は英文のまま", () => {
    assert.equal(en.segment("The word かいぜん means steady improvement at work.").sentences[0]?.embeddedLanguage, undefined);
  });
});

const RULE = "max-sentence-length";
/** A genre with no limits of its own for the rule: these read how the rule counts, not where the measurement put a genre's limit. */
const BASE_GENRE = "speech/address";
const lengthFindings = (adapter: LanguageAdapter, source: string): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, BASE_GENRE).findings.filter((finding) => finding.rule === RULE);

const words = (count: number): string => [...Array.from({ length: count - 1 }, (_, index) => "word" + String(index)), "end."].join(" ");

describe("和文の中の英文の長さは、英語の語数と英語の上限で見る", () => {
  it("英語の上限を超える英文を語数で指摘する", () => {
    const [finding, ...rest] = lengthFindings(ja, `日本語の文です。\n\n${words(30)}\n`);
    assert.equal(rest.length, 0);
    assert.equal(finding?.values["count"], 30);
    assert.equal(finding?.values["limit"], 25);
    const rule = loadRules("ja").find((entry) => entry.id === RULE);
    assert.ok(rule);
    assert.ok(finding);
    assert.equal(messageOf(rule, finding, "ja"), "この英文は 30 語あります（25 語まで）");
  });

  it("文字では長くても、英語の上限に収まる英文は指摘しない", () => {
    // 20 語、空白を除いて 100 文字を超える。文字で数えると日本語の上限（100）を超えていた。
    const sentence = words(20);
    assert.ok(sentence.replace(/\s/gu, "").length > 100);
    assert.deepEqual(lengthFindings(ja, `日本語の文です。\n\n${sentence}\n`), []);
  });

  it("段階を変えると、英文の上限も英語の段で変わる", () => {
    const findings = runRules(
      buildDocument("t.md", `日本語の文です。\n\n${words(20)}\n`, ja),
      loadRules("ja"),
      { [RULE]: "strict" },
      false,
      BASE_GENRE,
    ).findings;
    assert.deepEqual(
      findings.filter((finding) => finding.rule === RULE).map((finding) => finding.values["limit"]),
      [18],
    );
  });

  it("chaff.yaml の数の上限は文書の単位なので、英文には英語の段を使う", () => {
    const source = `${"あ".repeat(60)}。\n\n${words(30)}\n`;
    const findings = runRules(buildDocument("t.md", source, ja), loadRules("ja"), {}, false, BASE_GENRE, { [RULE]: 50 }).findings;
    assert.deepEqual(
      findings.filter((finding) => finding.rule === RULE).map((finding) => [finding.values["count"], finding.values["limit"]]),
      [
        [61, 50],
        [30, 25],
      ],
    );
  });

  it("英語の段が渡されなければ、前と同じく文書の単位と上限で測る", () => {
    const doc = buildDocument("t.md", `${words(30)}\n`, ja);
    const [finding] = sentenceLength(doc, { limit: 100 });
    assert.equal(finding?.values["count"], words(30).replace(/\s/gu, "").length);
    assert.equal(finding?.variant, undefined);
  });

  it("rule は読み込んだ言語以外の段を持つ", () => {
    const rule = loadRules("ja").find((entry) => entry.id === RULE);
    assert.deepEqual(Object.keys(rule?.other_languages ?? {}), ["en"]);
    assert.equal(rule?.other_languages?.["en"]?.by_genre["academic"]?.normal, 50);
  });

  it("日本語の文は前と同じく文字で数える", () => {
    const [finding] = lengthFindings(ja, `${"あ".repeat(120)}。\n`);
    assert.equal(finding?.values["count"], 121);
    assert.equal(finding?.variant, undefined);
  });

  it("英文の中の長い和文を文字数で指摘する", () => {
    const [finding] = lengthFindings(en, `The survey asked one question.\n\n${"あ".repeat(120)}。\n`);
    assert.equal(finding?.values["count"], 121);
    assert.equal(finding?.values["limit"], 100);
    const rule = loadRules("en").find((entry) => entry.id === RULE);
    assert.ok(rule);
    assert.ok(finding);
    assert.equal(messageOf(rule, finding, "en"), "This Japanese sentence runs 121 characters (limit 100)");
  });
});

const REFERENCE = "Yamada T, Suzuki K. Rehabilitation services for older people in Japan: a review of policies. J Health Policy. 2022;71(1):35-44.";
const referenceList = (count: number): string => Array.from({ length: count }, (_, index) => `- [${String(index + 1)}] ${REFERENCE}`).join("\n\n");
const JAPANESE_BODY = "今日，高齢化が進み，リハビリテーションの需要が高まっている．本稿では，提供体制を整理する．";

describe("言語の見当付けは、文献一覧を数えない", () => {
  it("英語の文献一覧が長くても、本文が日本語なら日本語", () => {
    assert.equal(guessLanguage(`${JAPANESE_BODY}\n\nReferences\n\n${referenceList(12)}\n`).language, "ja");
  });

  it("Markdown の見出し（参考文献）の下の一覧も数えない", () => {
    assert.equal(guessLanguage(`# 序論\n\n${JAPANESE_BODY}\n\n## 参考文献\n\n${referenceList(12)}\n`).language, "ja");
  });

  it("Markdown の見出しの節は、次の同じ深さの見出しまで数えない", () => {
    // 見出しの節なら、文献を一覧でなく段落で並べても数えない。次の節の本文は数える。
    const paragraphs = Array.from({ length: 12 }, () => REFERENCE).join("\n\n");
    assert.equal(guessLanguage(`## References\n\n${paragraphs}\n\n## 付録\n\n${JAPANESE_BODY}\n`).language, "ja");
  });

  it("日本語の文献一覧が長くても、本文が英語なら英語", () => {
    const list = Array.from(
      { length: 12 },
      (_, index) => `${String(index + 1)}. 山田太郎，鈴木花子．日本における高齢者のリハビリテーション提供体制．保健医療科学．2022．`,
    ).join("\n");
    assert.equal(guessLanguage(`The survey asked one question about the service.\n\n参考文献\n\n${list}\n`).language, "en");
  });

  it("見出しの語だけの行の後に一覧が続かなければ、後ろの段落は数える", () => {
    // 見出しでない「References」の行は、すぐ後の一覧だけを文献一覧とする。一覧が無ければ何も除かない。
    const english = Array.from({ length: 12 }, () => "This paragraph explains how the references were chosen.").join(" ");
    assert.equal(guessLanguage(`${JAPANESE_BODY}\n\nReferences\n\n${english}\n`).language, "en");
  });

  it("一覧の後の段落は数える", () => {
    const english = Array.from({ length: 12 }, () => "The appendix lists every question of the survey.").join(" ");
    assert.equal(guessLanguage(`${JAPANESE_BODY}\n\nReferences\n\n${referenceList(2)}\n\n${english}\n`).language, "en");
  });

  it("文書が文献一覧だけなら、一覧で見当を付ける", () => {
    assert.equal(guessLanguage("参考文献\n\n- 山田太郎．高齢者のリハビリテーション．2022．\n").language, "ja");
  });
});
