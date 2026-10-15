import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import {
  capitalPhraseSpans,
  carrierListSpans,
  citationSpans,
  companyNameSpans,
  currencySymbolSpans,
  namePrefixSpans,
  streetSuffixSpans,
} from "../packages/chaff/src/detectors/acronym-name.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 大文字で書いた名前の部品（法人の形、会社名、通貨の印、法令の引用、運送会社、名前を作る語、通りの種類）は展開を待つ略語ではない。
// 契約書・官報・社内規程で、説明の無い略語として報告されていた。例文は自作。

type Span = { readonly start: number; readonly end: number };

const words = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);

const DETERMINERS = words("name-determiner");

/** 範囲にまるごと覆われた、大文字だけの語。 */
const covered = (text: string, spans: readonly Span[]): string[] =>
  [...text.matchAll(/(?<![A-Za-z])[A-Z]{2,}(?![A-Za-z])/gu)]
    .filter((match) => spans.some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
    .map((match) => match[0]);

const cases = (
  name: string,
  spansOf: (text: string) => Span[],
  valid: readonly (readonly [string, string, readonly string[]])[],
  invalid: readonly (readonly [string, string])[],
): void => {
  void describe(name, () => {
    valid.forEach(([form, text, expected]) => {
      it(`valid: ${form}`, () => assert.deepEqual(covered(text, spansOf(text)), expected));
    });
    invalid.forEach(([form, text]) => {
      it(`invalid: ${form}`, () => assert.deepEqual(covered(text, spansOf(text)), []));
    });
  });
};

cases(
  "companyNameSpans",
  (text) => companyNameSpans(text, words("legal-form"), DETERMINERS),
  [
    ["読点の後ろの形と、その前の名前", "made with JVLS, LLC dba Vaccines", ["JVLS", "LLC"]],
    ["名前の語に続く形", "between Acme Medical Consultants LLC and us", ["LLC"]],
    ["大文字の名前と形", "Parent is TRATON SE, a Societas Europaea", ["TRATON", "SE"]],
    ["重ねて書いた形", "GitLab Singapore PTE. LTD. are reimbursed", ["PTE", "LTD"]],
    ["点を付けた形と読点", "Source: FUSE MEDICAL, INC., 10-K", ["FUSE", "MEDICAL", "INC"]],
    ["点と読点で繋いだ形", "SUNCALL TECHNOLOGY VIETNAM CO.,LTD.", ["SUNCALL", "TECHNOLOGY", "VIETNAM", "CO", "LTD"]],
    ["閉じ括弧のすぐ後ろの形", "SUNCALL（Guangzhou）CO.,LTD.", ["CO", "LTD"]],
  ],
  [
    ["形が名前の語の後ろにない", "the LLC and the SE team"],
    ["小文字の語の後ろ", "registered as an LLC under the act"],
    ["形の語を含む別の語", "the SEC and the COBOL code"],
    ["読点で切れた先の略語は名前に入れない", "the SRE, NASA and the plan"],
    ["点の無い CO はコロラド州でもある", "Kansas City, CO 64108"],
    ["限定の語の後ろ", "The SE team and This AB test"],
    ["空白を挟んだ括弧の後ろ", "Section (A) LLC requirements"],
  ],
);

describe("companyNameSpans の名前の長さ", () => {
  it("名前の語は上限までしか遡らない", () => {
    const text = "SRE ONE TWO THREE FOUR FIVE LLC";
    assert.deepEqual(covered(text, companyNameSpans(text, words("legal-form"), DETERMINERS)), ["ONE", "TWO", "THREE", "FOUR", "FIVE", "LLC"]);
  });
});

cases(
  "currencySymbolSpans",
  currencySymbolSpans,
  [
    ["通貨の記号の前のコード", "paid in USD$'s within 45 days", ["USD"]],
    ["国の印と金額", "cover of AU$10 million and US$ 5", ["AU", "US"]],
  ],
  [
    ["記号の無い大文字", "the AU team and USD rates"],
    ["記号の後ろの大文字", "costs $5 SRE time"],
  ],
);

cases(
  "citationSpans",
  (text) => citationSpans(text, words("citation-series")),
  [
    ["巻の番号の後ろ", "codified at 45 CFR Parts 160 and 164", ["CFR"]],
    ["小文字の part の前", "and 47 CFR part 64", ["CFR"]],
    ["§ の前", "under 21 USC §301 et seq and 22 CCR §§ 12801", ["USC", "CCR"]],
    ["Part と番号の前", "see CFR Part 117 today", ["CFR"]],
    ["スラッシュで繋いだ番号の後ろ", "Recommendation 94/820/EC provides", ["EC"]],
  ],
  [
    ["文の中で法令集そのものを言う", "the number of the CFR title and each part"],
    ["引用の形でない", "the EC provides and the USC campus"],
    ["番号の後ろでも条が続かない", "The 2 CFR export was generated"],
  ],
);

cases(
  "carrierListSpans",
  (text) => carrierListSpans(text, words("carrier-name")),
  [["2 社以上を並べた", "by Federal Express, UPS, DHL or courier", ["UPS", "DHL"]]],
  [
    ["1 社だけ", "the UPS in the server room failed"],
    ["同じ社を繰り返しただけ", "UPS batteries and UPS cables"],
  ],
);

cases(
  "namePrefixSpans",
  (text) => namePrefixSpans(text, words("name-prefix")),
  [["大文字で始まる語の前", "issued by HM Revenue & Customs", ["HM"]]],
  [
    ["後ろが大文字で始まる語でない", "HM, when part of a name"],
    ["後ろが大文字だけの語", "the HM SRE team"],
  ],
);

cases(
  "streetSuffixSpans",
  (text) => streetSuffixSpans(text, words("street-suffix")),
  [["番地と通りの名前の後ろ", "of 512 Bayshore DR, suite 201", ["DR"]]],
  [
    ["番地が無い", "the DR plan and Bayshore DR"],
    ["通りの名前が無い", "3 DR sites"],
    ["大文字だけの語は通りの名前ではない", "3 AI CT models"],
  ],
);

cases(
  "capitalPhraseSpans",
  (text) => capitalPhraseSpans(text, words("capital-phrase")),
  [
    ["前文の定型句", "NOW, THEREFORE, in consideration of", ["NOW", "THEREFORE"]],
    ["/ で繋いだ接続詞", "on the day AND/OR the week", ["AND", "OR"]],
  ],
  [
    ["句の片方だけ", "the OR staff and NOW TV"],
    ["句が語の一部", "XAND/ORB and NOW, THEREFOREX"],
  ],
);

describe("語彙表が空", () => {
  it("どの形も何も外さない", () => {
    assert.deepEqual(companyNameSpans("JVLS, LLC", [], DETERMINERS), []);
    assert.deepEqual(citationSpans("45 CFR §1", []), []);
    assert.deepEqual(carrierListSpans("UPS, DHL", []), []);
    assert.deepEqual(namePrefixSpans("HM Treasury", []), []);
    assert.deepEqual(streetSuffixSpans("512 Bayshore DR", []), []);
    assert.deepEqual(capitalPhraseSpans("AND/OR", []), []);
  });

  it("異常な入力: 空文字、記号だけ", () => {
    assert.deepEqual(companyNameSpans("", words("legal-form"), DETERMINERS), []);
    assert.deepEqual(currencySymbolSpans("$$ € £"), []);
    assert.deepEqual(citationSpans("§§ / 94/820/", words("citation-series")), []);
  });
});

describe("undefined-acronym と名前の部品", () => {
  it("en: 名前の部品は数えず、本当の略語は数える", () => {
    const source = [
      "JVLS, LLC of 512 Bayshore DR, Fort Lauderdale FL 33304 signs with TRATON SE.",
      "Notices go by Federal Express, UPS, DHL to HM Revenue & Customs.",
      "Fees are AU$10 plus VAT and GST under 45 CFR §164.524 and 94/820/EC.",
      "NOW, THEREFORE, the parties agree AND/OR consent.",
      "The SRE team owns the plan.",
    ].join("\n\n");
    assert.deepEqual(reportedAcronyms(en, source, "legal/contract"), ["SRE"]);
  });

  it("en: 引用の形でない法令集の名前は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "Give the number of the CFR title and the RIN of each action."), ["CFR", "RIN"]);
  });

  it("ja: 会社名の法人の形は数えず、本当の略語は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "SUNCALL（Guangzhou）CO.,LTD.を設立し、SRE を置いた。"), ["SRE"]);
  });
});
