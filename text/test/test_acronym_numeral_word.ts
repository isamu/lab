import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { numeralWordSpans } from "../packages/chaff/src/detectors/numeral-word.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// I だけのローマ数字（II、III）、名前に - で繋いだ数字（Association-IV）、X を並べた伏せ字（XXX）は略語ではない。例文はすべて自作。

const coveredIn = (text: string): string[] => numeralWordSpans(text).map((span) => text.slice(span.start, span.end));

describe("numeralWordSpans", () => {
  [
    ["姓の後ろの世代の番号", "Smith, J. A., III, 2001: Storm notes.", ["III"]],
    ["題名の中の部の番号", "“Storm Ada, 1964: II Structure of the eye”", ["II"]],
    ["小文字の語の後ろ", "the results of reactions I and II were kept", ["II"]],
    ["名前に - で繋いだ数字", "the Regional Association-IV and Region-XII", ["IV", "XII"]],
    ["伏せ字", "The Minister for XXX and form XXXX.", ["XXX", "XXXX"]],
    ["日本語の語の前", "XXX症候群とXXXX症候群", ["XXX", "XXXX"]],
  ].forEach(([form, text, words]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(coveredIn(String(text)), words));
  });

  [
    ["V・X を含む数字は名前の後ろでなければ略語（静脈注射）", "Give IV fluids and the VI editor"],
    ["I が 4 つ以上", "IIII"],
    ["語の一部", "IIIa, AII, XXXL, XXXY"],
    ["X が 2 つ", "XX"],
    ["ほかの字の繰り返し", "KKK, WWW, AAA"],
    ["小文字の語に - で繋ぐ", "post-IV care"],
    ["全部大文字の語に - で繋ぐ", "HIV-IV and G-IV"],
    ["空の文字列", ""],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(coveredIn(String(text)), []));
  });
});

describe("undefined-acronym: 番号と伏せ字", () => {
  it("en: 番号と伏せ字は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nSmith, J. A., III, 2001. The Minister for XXX met. The SRE joins.\n"), ["SRE"]);
  });

  it("en: 名前の後ろでない IV は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nStart IV fluids. The SRE joins.\n"), ["IV", "SRE"]);
  });

  it("ja: 染色体の型の X は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\nXXX症候群を含みます。SREも見ます。\n"), ["SRE"]);
  });
});
