import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { dottedNameSpans } from "../packages/chaff/src/detectors/dotted-name.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// . で空白を挟まずに繋いだ名前（GOV.UK、SAM.gov）の中の大文字は略語ではない。例文は自作。
// GOV.UK の文書で GOV が、CRS の報告書で SAM.gov の SAM が、説明の無い略語として報告されていた。

const namesIn = (text: string): string[] => dottedNameSpans(text).map((span) => text.slice(span.start, span.end));

describe("dottedNameSpans", () => {
  [
    ["ドメイン名（全部大文字）", "publish it on GOV.UK today", ["GOV.UK"]],
    ["ドメイン名（大文字と小文字の部品）", "register at SAM.gov and LOC.gov", ["SAM.gov", "LOC.gov"]],
    ["ファイル名と製品名", "see README.md for ASP.NET", ["README.md", "ASP.NET"]],
    ["3 つ以上の部品とハイフン", "mail NHS-DIGITAL.NHS.UK now", ["NHS-DIGITAL.NHS.UK"]],
    ["文の終わりの . の前", "visit GOV.UK.", ["GOV.UK"]],
    ["日本語の文の中", "GOV.UKでは、", ["GOV.UK"]],
  ].forEach(([form, text, names]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), names));
  });

  [
    ["文の終わりの . と空白", "reported by the IRS. Then the FBI."],
    ["空白を落とした文の境目（頭だけ大文字の部品）", "reported by the IRS.Then and Mr.HAWLEY"],
    ["大文字と小文字が混ざる部品", "the GOV.Uk and Gov.UK site"],
    [". が続く（省略記号）", "the IRS...THE FBI"],
    ["部品の片側が無い", "the .UK and GOV. site"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(namesIn(String(text)), []));
  });

  it("異常な入力: 空文字、. だけ", () => {
    assert.deepEqual(namesIn(""), []);
    assert.deepEqual(namesIn("..."), []);
  });
});

describe("undefined-acronym とドメイン名", () => {
  it("en: GOV.UK の GOV は数えず、文の終わりの略語は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe guidance is on GOV.UK now. It was reported by the IRS. Then it moved.\n"), ["IRS"]);
  });

  it("en: 名前の中で数えなくても、同じ略語が名前の外にあれば数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nRegister at SAM.gov first. The SAM record then opens.\n"), ["SAM"]);
  });

  it("ja: GOV.UK の GOV は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\nGOV.UKで公開します。SREも見ます。\n"), ["SRE"]);
  });
});
