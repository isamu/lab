import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { nameNumeralSpans } from "../packages/chaff/src/detectors/name-numeral.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 大文字で始まる語の後ろの、I・V・X だけのローマ数字（Engineer II、World War II）は名前の番号で、略語ではない。例文は自作。
// FOMC の議事録の出席者一覧（Senior System Engineer II）と連邦議会の議事録（World War II）で II が報告されていた。

const numeralsIn = (text: string): string[] => nameNumeralSpans(text).map((span) => text.slice(span.start, span.end));

/** 検査の側で作る、I・V・X だけのローマ数字（1〜39）。 */
const smallRomanOf = (value: number): string => {
  const units = ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"];
  return "X".repeat(Math.floor(value / 10)) + (units[value % 10] ?? "");
};

const LARGEST_SMALL = 39;

describe("nameNumeralSpans", () => {
  it("valid: I から XXXIX まで、名前の後ろならどの数も覆う", () => {
    const missed = Array.from({ length: LARGEST_SMALL }, (_, index) => smallRomanOf(index + 1)).filter(
      (numeral) => numeralsIn(`the Senior Analyst ${numeral} role`).join() !== numeral,
    );
    assert.deepEqual(missed, []);
  });

  [
    ["肩書きの後ろ、読点の前", "Jose Acosta, Senior System Engineer II, Division", ["II"]],
    ["人名と戦争の名前", "after World War II and Leopold III ruled", ["II", "III"]],
    ["文の終わり", "we reached Phase IV.", ["IV"]],
    ["日本語の文の中", "第2段階（Phase II）に進む", ["II"]],
  ].forEach(([form, text, words]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(numeralsIn(String(text)), words));
  });

  [
    ["文の頭の語（大文字は文頭の書き方）", "Start IV fluids now"],
    ["箇条書きの頭の語", "- Give IV fluids"],
    ["番号の後ろの語（番号は文字ではない）", "1. Give IV fluids"],
    ["C・D・L・M を含む数字（略語と重なる）", "the Audio CD, the Senior MD, Washington DC, the Pipeline CI, the Remix MIX, the Super LX"],
    ["崩れた書き方", "the Senior Analyst IIII and Phase VX and Stage IIV"],
    ["小文字の語の後ろ", "the patient needs IV fluids and the level II data"],
    ["全部大文字の語の後ろ（強調か略語）", "the AES IV and SYSTEM II"],
    ["頭だけでなく途中にも大文字がある語", "the McKinsey IV and iPhone XI"],
    ["数字の後ろに英字・数字・&", "the Phase IIa and Phase II2 and Stage IV&V"],
    ["語と数字の間に別の文字", "the Phase-II and Phase, II"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(numeralsIn(String(text)), []));
  });

  it("異常な入力: 空文字、数字だけ、語だけ", () => {
    assert.deepEqual(numeralsIn(""), []);
    assert.deepEqual(numeralsIn("II"), []);
    assert.deepEqual(numeralsIn("the Engineer"), []);
  });
});

describe("undefined-acronym と名前の番号", () => {
  it("en: 肩書きの番号は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nJose Acosta, Senior System Engineer II, joined. The SRE joins.\n"), ["SRE"]);
  });

  it("en: 文の頭の語の後ろの IV は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nStart IV fluids. The SRE joins.\n"), ["IV", "SRE"]);
  });

  it("ja: 名前の番号は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\n第2段階（Phase II）に進みます。SREも見ます。\n"), ["SRE"]);
  });
});
