import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { loneNumeralSpans } from "../packages/chaff/src/detectors/name-numeral.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// ローマ数字と . だけの文（Survey Title. VII. Subtitle の VII.）は、続き物の番号で略語ではない。例文は自作。
// arXiv の抄録の題名（Filter. VII. Water-Bearing Objects、Euclid. II. The VIS Instrument）で報告されていた。

const numeralsIn = (text: string): string[] => loneNumeralSpans(text).map((span) => text.slice(span.start, span.end));

describe("loneNumeralSpans", () => {
  [
    ["数字と . だけの文", "VII.", ["VII"]],
    ["前後の空白", "  XII.  ", ["XII"]],
    ["1 文字", "I.", ["I"]],
    ["文の頭の番号", "II. Background", ["II"]],
    ["文の中の . の後ろ（日本語の文分け）", "A Survey of Cool Stars. VII. The Inner Disk", ["VII"]],
    ["句点の後ろ", "題名。 IV. 副題", ["IV"]],
    ["番号が続く", "Part. I. II. The End", ["I", "II"]],
    ["長い空白の後ろ", `${" ".repeat(100_000)}I. Title`, ["I"]],
  ].forEach(([form, text, numerals]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(numeralsIn(String(text)), numerals));
  });

  [
    [". が無い", "VII"],
    ["ほかの語が前にある", "Give 1 g IV."],
    ["文の終わりの . の後ろに空白が無い", "Stars.VII. The"],
    ["数字の後ろの . に語が続く", "VII.b and Stars. IV.2"],
    ["C・D・L・M を含む数字（略語と重なる）", "CD."],
    ["崩れた書き方", "IIII."],
    ["別の区切り", "VII:"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(numeralsIn(String(text)), []));
  });

  it("異常な入力: 空文字、. だけ", () => {
    assert.deepEqual(numeralsIn(""), []);
    assert.deepEqual(numeralsIn("."), []);
  });
});

describe("undefined-acronym と続き物の番号", () => {
  it("en: 題名の間の番号は数えず、副題の VIS は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Papers\n\nTitle: A Survey of Cool Stars. VII. The Inner Disk\n\nTitle: Euclid. II. The VIS Instrument\n"), [
      "VIS",
    ]);
  });

  it("en: 文の終わりの IV は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nGive 1 g IV. Monitor the patient.\n"), ["IV"]);
  });

  it("en: 括弧の名前の後ろの番号は数える（見送り: (adult dose) IV と見分けられない）", () => {
    assert.deepEqual(reportedAcronyms(en, "# Papers\n\nTitle: Gas Flows (GASFLOW) XII. Rationale and design\n"), ["XII"]);
  });

  it("ja: 題名の間の番号は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 論文\n\nA Survey of Cool Stars. VII. The Inner Disk\n\nSREも見ます。\n"), ["SRE"]);
  });
});
