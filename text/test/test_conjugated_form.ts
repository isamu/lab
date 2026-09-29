import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { conjugatedForms } from "../packages/chaff/src/detectors/conjugated-form.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import type { LanguageAdapter, Sentence, Token } from "../packages/chaff/src/plugin.ts";

// 語彙表が原形で書いた語句（という、と呼ぶ）の、活用して書かれた形（といいます）。例文はすべて自作。

type Parts = readonly (readonly [string, string, string?])[];

/** 文を [表層, 品詞, 原形] の並びから組み立てる。span は文字の位置どおり。 */
const sentenceOf = (parts: Parts, start = 0): Sentence => {
  const tokens = parts.reduce<Token[]>((made, [surface, pos, lemma]) => {
    const at = made.at(-1)?.span.end ?? start;
    return [...made, { span: { start: at, end: at + surface.length }, surface, pos, ...(lemma === undefined ? {} : { lemma }) }];
  }, []);
  return { span: { start, end: tokens.at(-1)?.span.end ?? start }, text: parts.map(([surface]) => surface).join(""), tokens };
};

const BASES = ["という", "と呼ぶ", "と称す"];

describe("conjugatedForms", () => {
  it("valid: 最後の動詞の原形で照らし、続く助動詞まで取る", () => {
    const written = sentenceOf([
      ["（", "PUNCT"],
      ["以下", "NOUN", "以下"],
      ["「", "PUNCT"],
      ["GSS", "PROPN"],
      ["」", "PUNCT"],
      ["と", "ADP", "と"],
      ["いい", "VERB", "いう"],
      ["ます", "AUX", "ます"],
      ["。", "PUNCT"],
      ["）", "PUNCT"],
    ]);
    assert.deepEqual(conjugatedForms([written], BASES), ["といいます"]);
  });

  it("valid: 助動詞が 2 つ続く（呼びました）。文が文書の途中から始まっても位置が合う", () => {
    const written = sentenceOf(
      [
        ["と", "ADP", "と"],
        ["呼び", "VERB", "呼ぶ"],
        ["まし", "AUX", "ます"],
        ["た", "AUX", "た"],
      ],
      40,
    );
    assert.deepEqual(conjugatedForms([written], BASES), ["と呼びました"]);
  });

  it("valid: 同じ形は 1 つにまとめる", () => {
    const written = sentenceOf([
      ["と", "ADP", "と"],
      ["いい", "VERB", "いう"],
      ["ます", "AUX", "ます"],
    ]);
    assert.deepEqual(conjugatedForms([written, written], BASES), ["といいます"]);
  });

  const misses: readonly (readonly [string, Parts])[] = [
    [
      "動詞の前が語句の前の部分と違う（にいいます）",
      [
        ["に", "ADP", "に"],
        ["いい", "VERB", "いう"],
        ["ます", "AUX", "ます"],
      ],
    ],
    [
      "原形が語彙表のどの語句の終わりでもない（と書きます）",
      [
        ["と", "ADP", "と"],
        ["書き", "VERB", "書く"],
        ["ます", "AUX", "ます"],
      ],
    ],
    ["動詞でない語（助詞の という）", [["という", "ADP", "という"]]],
    [
      "原形の無い動詞（前に語彙表の語句がまるごとあっても）",
      [
        ["という", "ADP", "という"],
        ["いい", "VERB"],
        ["ます", "AUX", "ます"],
      ],
    ],
    [
      "原形が空の動詞（前に語彙表の語句がまるごとあっても）",
      [
        ["という", "ADP", "という"],
        ["いい", "VERB", ""],
        ["ます", "AUX", "ます"],
      ],
    ],
  ];
  misses.forEach(([form, parts]) => {
    it(`invalid: ${form}`, () => assert.deepEqual(conjugatedForms([sentenceOf(parts)], BASES), []));
  });

  it("異常な入力: 品詞の無い文、空の文、空の語彙表", () => {
    assert.deepEqual(conjugatedForms([{ span: { start: 0, end: 5 }, text: "といいます" }], BASES), []);
    assert.deepEqual(conjugatedForms([], BASES), []);
    assert.deepEqual(
      conjugatedForms(
        [
          sentenceOf([
            ["と", "ADP", "と"],
            ["いい", "VERB", "いう"],
          ]),
        ],
        [],
      ),
      [],
    );
  });
});

const reported = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), { "undefined-acronym": "strict" }, true, "business/report")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

const doc = (definition: string): string => `# 手引き\n\n共通基盤${definition}を使います。SREも見ます。\n`;

describe("undefined-acronym: 活用した定義の語（日本語）", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  [
    "（以下、「GSS」といいます。）",
    "（以下「GSS」と呼びます。）",
    "（以下「GSS」と称します。）",
    "（以下「GSS」と略します。）",
    "（以下「GSS」と言います。）",
    "（以下「GSS」といいました。）",
    "（「GSS」といいます。）",
  ].forEach((definition) => {
    it(`valid: ${definition}`, () => assert.deepEqual(reported(ja, doc(definition)), ["SRE"]));
  });

  [
    ["活用した語の後ろに語が続く", "（以下「GSS」といいます部署）"],
    ["括弧の中に別の略語と並ぶ", "（以下「GSS」「SLO」といいます。）"],
    ["閉じ括弧が無い", "（以下「GSS」といいます。"],
    ["語彙表に無い動詞", "（以下「GSS」と書きます。）"],
  ].forEach(([form, definition]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(reported(ja, doc(String(definition))).includes("GSS"), true));
  });
});
