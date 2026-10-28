import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { isCitationString } from "../packages/chaff/src/detectors/citation-string.ts";
import { colonQuotationParts, flattenedTableParts, isGrammarBlock, labelLineParts } from "../packages/chaff/src/detectors/sentence-parts.ts";
import { isReferenceLine, remarkAfterTitle } from "../packages/chaff/src/detectors/sentence-title.ts";

// max-sentence-length and the text a splitter hands over as one sentence although nobody wrote it as one: label lines,
// a grammar, a flattened table, a quotation after a colon, a citation string, a title with a remark, a reference line.
// Each is measured part by part or not at all; a real long sentence beside it is still reported. Self-written text.

before(async () => {
  await en.prepare?.({ pos: true });
});

const RULE = "max-sentence-length";
const enFindings = (source: string, genre: string, path = "a.md"): readonly string[] => namedRuleRun(RULE, `${source}\n`, en, path, genre).findings;
const jaFindings = (source: string): readonly string[] => namedRuleRun(RULE, `${source}\n`, ja, "a.md", "business/report").findings;
const EMAIL = "business/email";
const SIGNALS = ["see", "see also", "cf."];

const LABEL_LINES = [
  "When: Friday at half past twelve, after the weekly review",
  "Where: the cafe on Main Street, next to the old bank",
  "Who: everyone on the team, guests welcome",
].join("\n");
const WRAPPED_PROSE = [
  "Note: the cafe on Main Street is closed on Friday for repairs to the kitchen, so we",
  "will meet at the bakery next door instead and walk over together after the review.",
].join("\n");

describe("label lines", () => {
  it("reads lines of a label and its value, none closed by a stop, as one part each", () => {
    assert.deepEqual(labelLineParts(LABEL_LINES), LABEL_LINES.split("\n"));
    assert.deepEqual(enFindings(`# Lunch\n\n${LABEL_LINES}`, EMAIL), []);
  });

  it("still reports one label line that is too long by itself", () => {
    const long = `${LABEL_LINES}\nWhat: lunch for the whole team, with a vegetarian dish, a gluten-free dish, soft drinks, coffee and a cake for the two people leaving`;
    assert.deepEqual(enFindings(`# Lunch\n\n${long}`, EMAIL), ["This sentence runs 24 words (limit 18)"]);
  });

  it("does not read wrapped prose, or a single line, as label lines", () => {
    assert.equal(labelLineParts(WRAPPED_PROSE), undefined);
    assert.equal(labelLineParts("When: Friday"), undefined);
    assert.equal(enFindings(WRAPPED_PROSE, EMAIL).length, 1);
  });
});

const GRAMMAR = [
  "record     =  name SP value CRLF ; one record on each line",
  "name       =  1*ALPHA ; letters only",
  'value      =  1*( ALPHA / DIGIT / "-" ) ; letters, digits and hyphens',
  "             ; a value may not be empty",
].join("\n");

describe("a grammar in a plain-text specification", () => {
  it("is code, not a sentence", () => {
    assert.equal(isGrammarBlock(GRAMMAR), true);
    assert.deepEqual(enFindings(GRAMMAR, "technical/spec", "a.txt"), []);
  });

  it("does not take prose with one assignment in it for a grammar", () => {
    const prose = [
      "When the reader sees a line such as",
      "x = 5 in the example, it should read the value as a whole number and",
      "keep it until the next line sets it again, as every earlier version did.",
    ].join("\n");
    assert.equal(isGrammarBlock(prose), false);
    assert.equal(isGrammarBlock(""), false);
  });
});

const FLATTENED_NUMBERS =
  "・地域別売上高(単位：百万円)日本海外合計前年同期比(％)調理家電39,0439,67748,720△0.6生活家電4,0429675,00910.5その他1,5704832,05311.9構成比(％)62.722.99.713.41.0100.0当社グループは家庭用品の製造と販売を営んでおり、家庭用品以外の事業の重要性が乏しいため、事業の区分ごとの記載は省いております。";
const CHRONOLOGY =
  "２【沿革】1950年４月東京都に資本金100万円で家庭用品の製造を目的として設立1955年７月大阪府に工場を建設し、生産を始める1962年10月東京証券取引所の市場第二部に株式を上場1970年３月本社を現在地に移転1985年６月米国に販売会社を設立1990年１月欧州に販売会社を設立";

describe("a table a converter flattened into one sentence (ja)", () => {
  it("cuts the cells at glued numbers and at each row's date", () => {
    assert.equal(flattenedTableParts(FLATTENED_NUMBERS)?.at(-1)?.startsWith("当社グループは"), true);
    assert.equal(flattenedTableParts(CHRONOLOGY)?.length, 6);
    assert.deepEqual(jaFindings(FLATTENED_NUMBERS), []);
    assert.deepEqual(jaFindings(CHRONOLOGY), []);
  });

  it("leaves well-formed numbers, section numbers and a date or two alone", () => {
    [
      "連結売上高は83,494百万円、営業利益は5,000百万円となりました。",
      "See Section 3.5.3 and the address 192.168.1.1 for the details.",
      "当社は1950年４月に設立し、1955年７月に工場を建設しました。",
      "当社は1950年４月東京都で設立し、1955年７月大阪府に工場を建てました。",
    ].forEach((text) => assert.equal(flattenedTableParts(text), undefined, text));
  });

  it("still reports a long sentence that only names dates and amounts", () => {
    const long =
      "当連結会計年度は、2023年４月から2024年３月までの期間において、原材料価格の高騰や為替の変動、物流費の上昇などの影響を受けながらも、国内外の販売が堅調に推移したことにより、連結売上高は83,494百万円となり、前連結会計年度と比較して1,000百万円の増加となりましたが、営業利益は販売費及び一般管理費の増加により前連結会計年度を下回る結果となりました。";
    assert.equal(jaFindings(long).length, 1);
  });
});

describe("a quotation after a colon", () => {
  const frame = "At the meeting last spring, the head of the river towns council told the crowd in the hall:";
  const quote = "Every town on this river needs a new bridge, a new school, and a clinic that stays open late at night for the farmers.";

  it("is measured apart from the writer's words around it", () => {
    assert.deepEqual(colonQuotationParts(`${frame} "${quote}"`), [`${frame.slice(0, -1)}:`, quote]);
    assert.deepEqual(enFindings(`${frame} "${quote}"`, "docs/manual"), []);
    assert.deepEqual(enFindings(`${frame} “${quote}”`, "docs/manual"), []);
  });

  it("still reports the frame or the quotation when one of them is long by itself, and a quotation with no colon", () => {
    const longQuote = `${quote} We have asked for these for twenty years, and every year the answer from the capital has been the same, so this year we will ask again.`;
    assert.deepEqual(enFindings(`${frame} "${longQuote}"`, "docs/manual"), ["This sentence runs 51 words (limit 40)"]);
    assert.equal(colonQuotationParts(`The head of the council said that "${quote}"`), undefined);
  });
});

describe("a citation string in a footnote", () => {
  const legal =
    "See, e.g., 7 C.F.R. §§ 210.10(a) and 220.8(a) (meal requirements for schools and for breakfasts); see also 7 C.F.R. § 226.20 (requirements for meals served in child care centers and day care homes).";
  const series =
    "See River Towns Lending Program Expanded to Three More Counties; FDIC: Agencies Announce Rural Lending Guidance for Small Banks; OCC: Comptroller Issues Statement on Rural Lending.";

  it("reads a legal citation or a series of titles after an opening signal", () => {
    assert.equal(isCitationString(legal, SIGNALS), true);
    assert.equal(isCitationString(series, SIGNALS), true);
    assert.deepEqual(enFindings(`1. ${legal}\n\n2. ${series}`, EMAIL), []);
  });

  it("still measures a signal followed by the writer's words, or a section sign with nothing more", () => {
    const prose = [
      "See also letter 05-9, “Questions About the Lending Program,” for guidance on common questions regarding how small banks should report their loans to farms and ranches.",
      "See § 5 of the lease for the list of everything the tenant must clean, mend or replace before handing back the keys at the end of the lease.",
      "Please see the attached schedule; it lists every room we booked for the training and the times each one is free.",
    ];
    prose.forEach((text) => assert.equal(isCitationString(text, SIGNALS), false, text));
    assert.equal(isCitationString(legal, []), false);
    assert.equal(enFindings(prose.join("\n\n"), EMAIL).length, prose.length);
  });

  it("measures one cited title after a signal without the title's words", () => {
    const title =
      "See River Towns Lending Program Expanded to Three More Counties and Five More Small Banks across the Northern Part of the State in the Spring.";
    assert.equal(isCitationString(title, SIGNALS), false);
    assert.deepEqual(enFindings(title, EMAIL), []);
  });
});

describe("a title line with a remark, and a reference line", () => {
  const titleRemark = "Joint Statement on Rural Lending Programs for Community Banks and Credit Unions (See also the Board's press release of March 3, 2025.)";
  const reference = 'Letter 21-8, "Interagency Statement on Managing the Risk of Models Used in Rural Lending Programs at Small Banks" (April 9, 2021).';

  it("measures only the remark after a title, and not the quoted title of a reference", () => {
    assert.equal(remarkAfterTitle(titleRemark), "See also the Board's press release of March 3, 2025.");
    assert.equal(isReferenceLine(reference), true);
    assert.deepEqual(enFindings(`Attachments:\n\n${titleRemark}\n\n${reference}`, EMAIL), []);
  });

  it("still measures prose that ends with a parenthesis or quotes a title", () => {
    const prose = [
      "We will send the signed copies of the agreement to every branch office before the end of the month (the legal team has the list.)",
      'Every branch should read "Interagency Statement on Managing the Risk of Models" before the training that starts next week in the main office.',
    ];
    assert.equal(remarkAfterTitle(prose[0] ?? ""), undefined);
    assert.equal(isReferenceLine(prose[1] ?? ""), false);
    assert.equal(enFindings(prose.join("\n\n"), EMAIL).length, prose.length);
  });

  it("measures one cited title after a signal without the title's words", () => {
    const title =
      "See River Towns Lending Program Expanded to Three More Counties and Five More Small Banks across the Northern Part of the State in the Spring.";
    assert.equal(isCitationString(title, SIGNALS), false);
    assert.deepEqual(enFindings(title, EMAIL), []);
  });
});
