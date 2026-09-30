import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { subheadingPieces } from "../packages/chaff/src/subheading-line.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const pieces = (text: string): string[] => subheadingPieces(text).map((span) => text.slice(span.start, span.end));

describe("subheadingPieces: 括弧だけの短い行は、次の文とつながない小見出し", () => {
  it("括弧だけの行の後ろで切る", () => {
    assert.deepEqual(pieces("（経済再生）\n経済を再生します。次です。"), ["（経済再生）", "経済を再生します。次です。"]);
  });

  it("文で終わる行の後ろの、括弧だけの行も切る", () => {
    assert.deepEqual(pieces("前の話です。\n（災害復興）\n復興を進めます。"), ["前の話です。\n（災害復興）", "復興を進めます。"]);
  });

  const bracketPairs: readonly (readonly [string, string])[] = [
    ["（", "）"],
    ["(", ")"],
    ["【", "】"],
    ["〔", "〕"],
    ["［", "］"],
  ];
  bracketPairs.forEach(([open, close]) => {
    it(`${open}${close} の組も小見出し`, () => {
      assert.deepEqual(pieces(`${open}目的${close}\n本文です。`), [`${open}目的${close}`, "本文です。"]);
    });
  });

  it("英語も同じ形なら切る", () => {
    assert.deepEqual(pieces("(Energy security)\nEnergy is key."), ["(Energy security)", "Energy is key."]);
  });

  it("CRLF でも切る。切った片は改行を含まない", () => {
    assert.deepEqual(pieces("（経済再生）\r\n経済を再生します。"), ["（経済再生）", "経済を再生します。"]);
  });

  it("行頭・行末の空白があっても括弧だけの行", () => {
    assert.deepEqual(pieces("　（経済再生） \n経済を再生します。"), ["　（経済再生） ", "経済を再生します。"]);
  });

  it("括弧だけの行が続けば、それぞれの後ろで切る", () => {
    assert.deepEqual(pieces("（一）\n（二）\n本文です。"), ["（一）", "（二）", "本文です。"]);
  });

  const unchanged: readonly (readonly [string, string])[] = [
    ["改行の無い段落", "（経済再生）経済を再生します。"],
    ["括弧の後ろに語が続く行（「（１）はじめに」）", "（１）はじめに\n本文です。"],
    ["括弧の前に語がある行", "注（経済再生）\n本文です。"],
    ["括弧の中で文が終わる行（括弧書きの注記）", "（ただし、例外を除く。）\n本文です。"],
    ["括弧の中が「！」「？」で終わる行", "（本当か？）\n本文です。"],
    ["括弧の中がピリオドで終わる行", "(See the appendix.)\nThe rest follows."],
    ["かぎ括弧だけの行（引用。後ろの文とつながることがある）", "「信以て義を行う」\n国民の皆様から賜った御信任を基礎とします。"],
    ["二重かぎ括弧だけの行", "『書名』\nを読みました。"],
    ["閉じ括弧の組が違う行", "（経済再生】\n本文です。"],
    ["括弧が二組ある行", "（経済）（再生）\n本文です。"],
    ["括弧が入れ子の行", "（経済（再生））\n本文です。"],
    ["中に閉じ括弧だけがある行", "（経済）再生）\n本文です。"],
    ["中に開き括弧だけがある行", "（経済（再生）\n本文です。"],
    ["中身が空の括弧", "（）\n本文です。"],
    ["段落の最後の行（後ろに行が無い）", "本文です。\n（経済再生）"],
    ["後ろの行が空白だけ", "（経済再生）\n　"],
    ["文の途中の行（前の行が文で終わらない）", "この結果は\n（付録を参照）\n次のとおりです。"],
    ["空の段落", ""],
  ];
  unchanged.forEach(([label, text]) => {
    it(`切らない: ${label}`, () => assert.deepEqual(pieces(text), [text]));
  });

  it("中身が長すぎる括弧の行は、小見出しではない（括弧でくくった注記）", () => {
    const long = `（${"あ".repeat(41)}）\n本文です。`;
    assert.deepEqual(pieces(long), [long]);
    const atLimit = `（${"あ".repeat(40)}）\n本文です。`;
    assert.equal(pieces(atLimit).length, 2);
  });

  it("字数は文字で数える（サロゲートペアの漢字も 1 字）", () => {
    const text = `（${"𠮷".repeat(40)}）\n本文です。`;
    assert.equal(pieces(text).length, 2);
  });
});

const sentenceTexts = (source: string, path = "t.md"): string[] => buildDocument(path, source, ja).sentences.map((sentence) => sentence.text.trim());

describe("文書: 括弧だけの小見出しの行は、次の文と別の文になる", () => {
  it("施政方針演説の形: 小見出しの行が次の文の頭に入らない", () => {
    const source = "（エネルギー・資源安全保障）\nエネルギーは、国民生活の基盤です。安定的な供給が不可欠です。";
    assert.deepEqual(sentenceTexts(source), ["（エネルギー・資源安全保障）", "エネルギーは、国民生活の基盤です。", "安定的な供給が不可欠です。"]);
  });

  it("テキストの文書（法令の見出し）でも同じ", () => {
    const source = "（目的）\n第一条　この法律は、手続を定めるものとする。";
    assert.deepEqual(sentenceTexts(source, "t.txt"), ["（目的）", "第一条　この法律は、手続を定めるものとする。"]);
  });

  it("指摘の行が小見出しの行でなく本文の行になる", () => {
    const source = `前置きです。\n\n（経済再生）\n${"経済を再生するために、".repeat(12)}取り組みます。`;
    const doc = buildDocument("t.md", source, ja);
    const long = doc.sentences.find((sentence) => sentence.text.includes("取り組みます"));
    assert.ok(long !== undefined);
    assert.equal(source.slice(0, long.span.start).split("\n").length, 4);
  });

  it("英語の文書でも同じ", () => {
    const texts = buildDocument("t.md", "(Energy security)\nEnergy is key. Supply matters.", en).sentences.map((sentence) => sentence.text.trim());
    assert.deepEqual(texts, ["(Energy security)", "Energy is key.", "Supply matters."]);
  });

  it("括弧で始まって語が続く行（「（１）はじめに」）は、前と同じく次の行とつながる", () => {
    assert.deepEqual(sentenceTexts("（１）はじめに\n本文です。"), ["（１）はじめに\n本文です。"]);
  });
});
