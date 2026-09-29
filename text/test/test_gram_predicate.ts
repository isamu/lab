import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasPredicateIn } from "../packages/chaff/src/detectors/gram-predicate.ts";
import { isNamePart } from "../packages/chaff/src/detectors/name-part.ts";
import type { LengthUnit, Span, Token } from "../packages/chaff/src/plugin.ts";

// 繰り返された語句（窓）が言い回しか、名前の繰り返しか。品詞は手で付ける（解析器の読み違いもそのまま再現する）。

type Word = readonly [surface: string, pos: string, nameType?: string];

/** 語を空白 1 つで並べた文と、その語。 */
const sentenceOf = (words: readonly Word[], separator = " "): { text: string; tokens: Token[] } => {
  const state = { at: 0 };
  const tokens = words.map(([surface, pos, nameType]) => {
    const start = state.at;
    state.at += surface.length + separator.length;
    const span = { start, end: start + surface.length };
    return nameType === undefined ? { span, surface, pos } : { span, surface, pos, features: { NameType: nameType } };
  });
  return { text: words.map(([surface]) => surface).join(separator), tokens };
};

/** 文の中の gram の範囲。 */
const windowOf = (text: string, gram: string): Span => {
  const start = text.indexOf(gram);
  assert.notEqual(start, -1, `${gram} は ${text} に無い`);
  return { start, end: start + gram.length };
};

const predicateIn = (words: readonly Word[], gram: string, unit: LengthUnit = "word"): boolean => {
  const separator = unit === "word" ? " " : "";
  const { text, tokens } = sentenceOf(words, separator);
  return hasPredicateIn(tokens, windowOf(text, gram), unit);
};

const NSF: readonly Word[] = [
  ["It", "PRON"],
  ["is", "AUX"],
  ["identified", "VERB"],
  ["in", "ADP"],
  ["the", "DET"],
  ["NSF", "PROPN"],
  ["Proposal", "PROPN"],
  ["&", "CCONJ"],
  ["Award", "PROPN"],
  ["Policies", "PROPN"],
  ["&", "CCONJ"],
  ["Procedures", "PROPN"],
  ["Guide", "VERB"],
  ["(", "X"],
  ["PAPPG", "PROPN"],
  [")", "X"],
  [".", "PUNCT"],
];

describe("hasPredicateIn: 言い回しは述語を含む", () => {
  it("invalid: 窓の中に丸ごと入った動詞は述語（it is important to）", () => {
    const words: Word[] = [
      ["Note", "VERB"],
      ["that", "SCONJ"],
      ["it", "PRON"],
      ["is", "AUX"],
      ["important", "ADJ"],
      ["to", "PART"],
      ["act", "VERB"],
    ];
    assert.equal(predicateIn(words, "it is important to"), true);
  });

  it("invalid: 丸ごと入った動詞は、隣が名前だけでも述語（use the Cloud Service）", () => {
    const words: Word[] = [
      ["Customer", "PROPN"],
      ["may", "AUX"],
      ["use", "VERB"],
      ["the", "DET"],
      ["Cloud", "PROPN"],
      ["Service", "PROPN"],
      ["daily", "ADV"],
    ];
    assert.equal(predicateIn(words, "use the Cloud Servi"), true);
  });

  it("invalid: 端で切れた動詞でも、隣に普通の語があれば述語（the same participant described）", () => {
    const words: Word[] = [
      ["the", "DET"],
      ["same", "ADJ"],
      ["participant", "NOUN"],
      ["described", "VERB"],
      ["it", "PRON"],
    ];
    assert.equal(predicateIn(words, "e participant descri"), true);
  });

  it("invalid: 端で切れた動詞の隣に名前があっても、普通の語も並べば言い回し（ed the NSF budget）", () => {
    const words: Word[] = [
      ["they", "PRON"],
      ["reviewed", "VERB"],
      ["the", "DET"],
      ["NSF", "PROPN"],
      ["budget", "NOUN"],
    ];
    assert.equal(predicateIn(words, "ed the NSF budget"), true);
  });

  it("invalid: 端で切れた動詞の隣が中身の無い語だけなら、名前の繰り返しではない", () => {
    const words: Word[] = [
      ["it", "PRON"],
      ["was", "AUX"],
      ["identified", "VERB"],
      ["in", "ADP"],
      ["the", "DET"],
      ["end", "NOUN"],
    ];
    assert.equal(predicateIn(words, "ed in the"), true);
  });

  it("invalid: 大文字の動詞でも、隣が文頭の語なら名前の並びではない（Select Save (if applicable)）", () => {
    const words: Word[] = [
      ["Select", "VERB"],
      ["Save", "VERB"],
      ["(", "X"],
      ["if", "ADP"],
      ["applicable", "ADJ"],
      [")", "X"],
    ];
    assert.equal(predicateIn(words, "Save ( if applicable"), true);
  });

  it("invalid: char 単位（日本語）では大文字を名前のしるしに使わない", () => {
    const words: Word[] = [
      ["資料", "NOUN"],
      ["Procedures", "PROPN"],
      ["Guide", "VERB"],
      ["を", "ADP"],
    ];
    assert.equal(predicateIn(words, "ProceduresGuideを", "char"), true);
  });
});

describe("hasPredicateIn: 名前の繰り返しは言い回しではない", () => {
  it("valid: 大文字の名前の中で動詞と読まれた語は述語でない（Procedures Guide (PAPPG)）", () => {
    assert.equal(predicateIn(NSF, "Procedures Guide ( P"), false);
  });

  it("valid: 端で切れた動詞の隣が名前と中身の無い語だけなら、繰り返しは名前（ed in the NSF Propos）", () => {
    assert.equal(predicateIn(NSF, "ed in the NSF Propos"), false);
  });

  it("valid: 後ろの端で切れた動詞も同じ（the Cloud Service prov）", () => {
    const words: Word[] = [
      ["the", "DET"],
      ["Cloud", "PROPN"],
      ["Service", "PROPN"],
      ["provides", "VERB"],
      ["it", "PRON"],
    ];
    assert.equal(predicateIn(words, "the Cloud Service prov"), false);
  });

  it("valid: 隣の名前が、大文字の名前の中で動詞と読まれた語でも同じ", () => {
    const words: Word[] = [
      ["it", "PRON"],
      ["is", "AUX"],
      ["identified", "VERB"],
      ["in", "ADP"],
      ["the", "DET"],
      ["Procedures", "PROPN"],
      ["Guide", "VERB"],
    ];
    assert.equal(predicateIn(words, "ed in the Procedures Guide"), false);
  });

  it("valid: 固有名詞の種類（NameType）を持つ語も名前", () => {
    const words: Word[] = [
      ["訪れる", "VERB"],
      ["の", "ADP"],
      ["は", "ADP"],
      ["下田", "NOUN", "Geo"],
    ];
    assert.equal(predicateIn(words, "るのは下田", "char"), false);
  });

  it("valid: 名詞の前の英語の動詞は飾りの語（the upcoming fiscal year）", () => {
    const words: Word[] = [
      ["the", "DET"],
      ["upcoming", "VERB"],
      ["fiscal", "ADJ"],
      ["year", "NOUN"],
    ];
    assert.equal(predicateIn(words, "the upcoming fiscal year"), false);
  });

  it("valid: 窓の外の動詞は数えない", () => {
    const words: Word[] = [
      ["We", "PRON"],
      ["filed", "VERB"],
      ["the", "DET"],
      ["state", "NOUN"],
      ["and", "CCONJ"],
      ["local", "ADJ"],
      ["tax", "NOUN"],
    ];
    assert.equal(predicateIn(words, "the state and local tax"), false);
  });

  it("valid: 語が無ければ述語も無い", () => {
    assert.equal(hasPredicateIn([], { start: 0, end: 10 }, "word"), false);
  });
});

describe("isNamePart", () => {
  const tokensOf = (words: readonly Word[]): Token[] => sentenceOf(words).tokens;

  it("文の途中の大文字の語が、文の途中の大文字の語と並ぶ", () => {
    const tokens = tokensOf(NSF);
    assert.equal(isNamePart(tokens, 12), true);
    assert.equal(isNamePart(tokens, 6), true);
  });

  it("& や括弧を挟んでも並びは切れない（Learning & Development）", () => {
    const tokens = tokensOf([
      ["The", "DET"],
      ["Learning", "VERB"],
      ["&", "CCONJ"],
      ["Development", "PROPN"],
      ["team", "NOUN"],
    ]);
    assert.equal(isNamePart(tokens, 1), true);
  });

  it("文頭の語は名前の一部とも、名前の隣とも読まない", () => {
    const tokens = tokensOf([
      ["Select", "VERB"],
      ["Save", "VERB"],
      ["now", "ADV"],
    ]);
    assert.equal(isNamePart(tokens, 0), false);
    assert.equal(isNamePart(tokens, 1), false);
  });

  it("小文字の語、隣が小文字の大文字の語、文字の無い語は名前の一部でない", () => {
    const tokens = tokensOf([
      ["We", "PRON"],
      ["use", "VERB"],
      ["Rust", "PROPN"],
      ["daily", "ADV"],
      ["&", "CCONJ"],
    ]);
    assert.equal(isNamePart(tokens, 1), false);
    assert.equal(isNamePart(tokens, 2), false);
    assert.equal(isNamePart(tokens, 4), false);
    assert.equal(isNamePart(tokens, 99), false);
  });
});
