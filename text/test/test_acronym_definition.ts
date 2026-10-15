import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { statedAcronyms } from "../packages/chaff/src/detectors/acronym-definition.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 括弧の展開の形をとらずに定義した略語（契約書の定義の一覧、当事者の呼び名の並び、名前の後ろの言い換え、名前だけの行）は説明済み。
// 契約書・手引き・英国政府の通知で、説明の無い略語として報告されていた。例文は自作。

const WORDS = {
  statements: (en.lexicons["definition-statement"] ?? []).map((entry) => entry.pattern),
  markers: (en.lexicons["definition-marker"] ?? []).map((entry) => entry.pattern),
};

const stated = (source: string): string[] => [...statedAcronyms(source, WORDS)].toSorted((left, right) => left.localeCompare(right));

describe("statedAcronyms", () => {
  [
    ["定義の一覧の太字の語", '2. **"BAA"** means the cover page.', ["BAA"]],
    ["別の呼び名と並べた語", '13. **"Protected Health Information"** or **"PHI"** has the meaning given to it.', ["PHI"]],
    ["定義の語の前に 1 語", '"SOW" shall mean a statement of work.', ["SOW"]],
    ["曲がった引用符", "“EEA” means the member states.", ["EEA"]],
    ["当事者の呼び名の並び", 'Premier Nutrition Company, LLC ("Buyer" or "PNC"), and the supplier', ["PNC"]],
    ["the を挟んだ呼び名の並び", '(the "Company" and "ACME")', ["ACME"]],
    ["読点と引用符の後ろの言い換え", "Travel is for “temporary duty,” also known as “TDY” travel.", ["TDY"]],
    ["項目名の後ろの名前の行", "# Notice\n\nFrom:\n\nHM Revenue & Customs\n\nTell HMRC first.", ["HMRC"]],
    ["項目名の後ろの強調した名前", "Published by:\n**National Weather Service**\n", ["NWS"]],
  ].forEach(([form, source, expected]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(stated(String(source)), expected));
  });

  [
    ["引用符で囲んでも定義の語が無い", '"SOW" is attached as Exhibit A.'],
    ["引用符の無い略語と定義の語", "the SOW means the plan"],
    ["括弧の中の呼び名が 1 つだけ", 'as described (see "PNC") above'],
    ["繋ぐ語の無い引用の並び", '("ABC" "Unrelated label") and "ABC" "not a name" means it'],
    ["項目名の後ろの見出し", "From:\n## Area Forecast Discussion\n"],
    ["区切りの無い言い換えの語", 'travel to the "TDY" site'],
    ["名前から文字が拾えない言い換え", "the office, also known as “TDY”"],
    ["項目名の無い名前の行", "# Notice\n\nHM Revenue & Customs\n"],
    ["見出しの名前", "## Area Forecast Discussion\n"],
    ["項目名の後ろの大文字だけの行", "From:\nNOTICE OF TERMS\n"],
    ["項目名の後ろの文の行", "Note:\nThe Plan Is Ready.\n"],
    ["項目名の後ろの語の多すぎる行", "From:\nOne Two Three Four Five Six Seven Eight Nine\n"],
    ["項目名の後ろの頭文字が 2 文字の名前", "From:\nAdvance Purchase\n"],
    ["項目名の後ろの略語そのものを含む行", "From:\nNASA website team\n"],
    ["項目名の後ろの、大文字で始まる語が 1 つの行", "From:\nVAT registration number\n"],
  ].forEach(([form, source]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(stated(String(source)), []));
  });

  it("語彙表が空なら、定義の語と言い換えの語の形は読まない", () => {
    const empty = { statements: [], markers: [] };
    assert.deepEqual([...statedAcronyms('"SOW" means work. “temporary duty,” also known as “TDY”', empty)], []);
  });

  it("異常な入力: 空文字、引用符と括弧だけ", () => {
    assert.deepEqual(stated(""), []);
    assert.deepEqual(stated('("" or "")\n""\n**'), []);
  });
});

describe("undefined-acronym と定義の書き方", () => {
  it("en: 定義の一覧で定義する書き手の文書では、定義の無い 1 つも数える", () => {
    const source = [
      "# Terms",
      "The GDPR and the EEA apply, and the HHS reviews. Approval follows the ICO guidance.",
      '1. **"GDPR"** means the regulation.',
      '2. **"European Economic Area"** or **"EEA"** means the member states.',
      '3. **"HHS"** means the department.',
    ].join("\n\n");
    assert.deepEqual(
      runRules(buildDocument("t.md", source, en), loadRules("en"), { "undefined-acronym": "normal" }, true, "legal/contract")
        .findings.filter((finding) => finding.rule === "undefined-acronym")
        .map((finding) => String(finding.values["word"])),
      ["ICO"],
    );
  });

  it("en: 定義した略語は数えず、定義の無い略語は数える", () => {
    const source = [
      "# Terms",
      "The SOW, the PHI and the PNC apply. Travel is “temporary duty,” also known as “TDY” travel. The SRE team signs.",
      '1. **"SOW"** means a statement of work.',
      '2. **"Protected Health Information"** or **"PHI"** has the meaning given to it.',
      'Premier Nutrition Company ("Buyer" or "PNC") buys.',
    ].join("\n\n");
    assert.deepEqual(reportedAcronyms(en, source, "legal/contract"), ["SRE"]);
  });

  it("ja: 当事者の呼び名の並びの略語は説明済みで、ほかの略語は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, '# 契約\n\nプレミア社（"Buyer" or "PNC"）が買う。PNC と SRE が署名する。\n'), ["SRE"]);
  });
});
