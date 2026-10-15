import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { japaneseCompanyNameSpans } from "../packages/chaff/src/detectors/acronym-name.ts";
import { loadLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 日本の会社の形の隣の英字（㈱ADEKA の ADEKA）は会社の名前で、説明を待つ略語ではない。例文は自作。
// 有価証券報告書の沿革で、会社の名前が説明の無い略語として報告されていた。

const FORMS = (loadLexicons()["company-form"] ?? []).map((entry) => entry.pattern);
const namesIn = (text: string): string[] => japaneseCompanyNameSpans(text, FORMS).map((span) => text.slice(span.start, span.end));

describe("japaneseCompanyNameSpans", () => {
  [
    ["形のすぐ後ろ", "旭化工㈱（現㈱AOBA）と", ["AOBA"]],
    ["株式会社のすぐ後ろ", "株式会社AOBAと", ["AOBA"]],
    ["形のすぐ前", "AOBA株式会社と", ["AOBA"]],
    ["片仮名を挟んで形の前", "AOBAホールディングス㈱と", ["AOBA"]],
  ].forEach(([form, text, names]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), names));
  });

  [
    ["形から離れた英字", "AOBA株式会社のERPを使う"],
    ["空白を挟んだ英字", "株式会社 は ERP を使う"],
    ["英語の形（Ltd）に続けて見える英字", "the XYPLC board and ABCLtd"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => {
      const names = namesIn(String(text));
      assert.ok(!names.includes("ERP") && !names.includes("XY") && !names.includes("ABC"), names.join(","));
    });
  });

  it("語彙表が空なら何も無い", () => {
    assert.deepEqual(japaneseCompanyNameSpans("㈱AOBA", []), []);
  });
});

describe("undefined-acronym: 会社の名前の中の英字", () => {
  it("日本の会社の形の隣の英字と、英字の会社の形は数えない", () => {
    const text =
      "1969年に旭化工㈱（現㈱AOBA）と、同和工業㈱（現DOWNEホールディングス㈱）と共同で出資しました。2017年にタイ王国に AOBA (THAILAND) CO.,LTD. を、米国に AOBA USA INC. を設立しました。\n";
    assert.deepEqual(reportedAcronyms(ja, `# 沿革\n\n${text}`), []);
  });

  it("日本語の文の中の「，」で区切った形と、点を含む括弧の後ろの形も名前（CO.，LTD.、CO.,（H.K.）LTD.）", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 沿革\n\n子会社 AOBA(THAILAND)CO.，LTD. と、香港の AOBA CO.,（H.K.）LTD. を設立しました。\n"), []);
  });

  it("会社の名前から離れた略語は数える（AOBA株式会社のERP）", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 概要\n\nAOBA株式会社のERPを使います。\n"), ["ERP"]);
  });

  it("英語の文書は変わらない（英字だけの形に続けた語）", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe XYPLC board met.\n"), ["XYPLC"]);
  });
});
