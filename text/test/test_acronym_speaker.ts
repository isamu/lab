import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notAcronymSpansOf, type NotationWords } from "../packages/chaff/src/detectors/acronym-context.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { reportedAcronyms } from "./rule-run.ts";

// 議事録・速記録は発言者の姓を大文字で書く（Mr. HAWLEY.、Mrs. CAPITO.）。敬称のすぐ後ろの大文字の語は名前で、略語ではない。例文はすべて自作。

const listOf = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);

const NONE: NotationWords = {
  meridiem: [],
  timeZones: [],
  currencies: [],
  usStates: [],
  emphasis: [],
  divisions: [],
  abbreviatedLabels: [],
  honorifics: [],
  titles: [],
  dateTimeUnits: [],
};
const spans = notAcronymSpansOf({ ...NONE, honorifics: listOf("honorific") });

/** 範囲にまるごと覆われた、大文字だけの語。 */
const covered = (text: string): string[] =>
  [...text.matchAll(/(?<![A-Za-z])[A-Z]{2,}(?![A-Za-z])/gu)]
    .filter((match) => spans(text).some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
    .map((match) => match[0]);

describe("notAcronymSpans: 敬称の後ろの大文字の姓", () => {
  [
    ["Mr. HAWLEY. I ask for the yeas and nays.", ["HAWLEY"]],
    ["Mrs. CAPITO. Mr. President, I rise today.", ["CAPITO"]],
    ["Ms. SMITH of Minnesota. I thank the Senator.", ["SMITH"]],
    ["Mr. THOMPSON of Pennsylvania. Mr. Speaker, I rise.", ["THOMPSON"]],
    ["Madam SPEAKER, the time has expired.", ["SPEAKER"]],
    ["Dr. O'NEIL. The study is sound.", ["NEIL"]],
    ["Mr McDONALD said so.", []],
    ["Mr BLAKE (Sheffield) asked a question.", ["BLAKE"]],
  ].forEach(([text, words]) => {
    it(`valid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  [
    ["The DOJ portal handles uploads.", []],
    ["Mr. Smith read the NATO report.", []],
    ["Mr.HAWLEY spoke.", []],
    ["the MR. HAWLEY file", []],
    ["Summary. HAWLEY asked.", []],
    ["Mrs. C spoke.", []],
    ["MrsX CAPITO spoke.", []],
    ["Mr. HQ2 site is open.", []],
  ].forEach(([text, words]) => {
    it(`invalid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  it("敬称の語彙表が空なら、何も外さない", () => {
    assert.deepEqual(notAcronymSpansOf(NONE)("Mr. HAWLEY. I ask."), []);
  });
});

const acronyms = (source: string): string[] =>
  runRules(buildDocument("record.md", source, en), loadRules("en"), {}, true, "business/meeting-notes")
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

describe("undefined-acronym: 速記録の発言者", () => {
  it("発言者の大文字の姓は数えず、本文の略語は数える", () => {
    const source = ["# Record", "", "Mr. HAWLEY. The LNG terminals were halted by the DOJ.", "", "Mrs. CAPITO. The EPA agreed. I yield the floor.", ""].join(
      "\n",
    );
    assert.deepEqual(
      acronyms(source).toSorted((left, right) => left.localeCompare(right, "en")),
      ["DOJ", "EPA", "LNG"],
    );
  });
});

// 肩書き（Prime Minister、Governor）の後ろの大文字の姓。名前の形のときだけ外す: 発言者の印（Senator HAWLEY.）か、
// 日本政府の英文が「姓 名」の順に書くローマ字の名前（Prime Minister ABE Shinzo）。
describe("undefined-acronym: 肩書きの後ろの大文字の姓", () => {
  const sorted = (body: string): string[] => reportedAcronyms(en, `# Address\n\n${body}\n`).toSorted((left, right) => left.localeCompare(right, "en"));

  [
    ["Ten years ago, former Prime Minister ABE Shinzo spoke there. The DOJ agreed.", ["DOJ"]],
    ["Minister KONO Taro replied. The DOJ agreed.", ["DOJ"]],
    ["Senator HAWLEY. I thank the chair. The DOJ agreed.", ["DOJ"]],
    ["Chairman JORDAN: The committee will come to order. The DOJ agreed.", ["DOJ"]],
  ].forEach(([body, expected]) => {
    it(`数えない: ${String(body)}`, () => assert.deepEqual(sorted(String(body)), expected));
  });

  [
    ["The President NASA memo remains unpublished. The DOJ agreed.", ["DOJ", "NASA"]],
    ["Governor FEMA funding was cut. The DOJ agreed.", ["DOJ", "FEMA"]],
    ["The Secretary GDPR: Article 5 applies. The DOJ agreed.", ["DOJ", "GDPR"]],
    ["It was signed by Governor HOCHUL. The DOJ agreed.", ["DOJ", "HOCHUL"]],
    ["The prime minister ABE Shinzo file is open. The DOJ agreed.", ["ABE", "DOJ"]],
    ["The Prime Minister's GDPR note is open. The DOJ agreed.", ["DOJ", "GDPR"]],
    ["The Minister of the MOFA spoke. The DOJ agreed.", ["DOJ", "MOFA"]],
    ["ABE Shinzo spoke there. The DOJ agreed.", ["ABE", "DOJ"]],
  ].forEach(([body, expected]) => {
    it(`数える: ${String(body)}`, () => assert.deepEqual(sorted(String(body)), expected));
  });
});

// 受け入れた割り切り: 肩書きと大文字の語の後ろの大文字で始まる語は名と読むので、題の書き方（The President NASA Memo）では略語が外れる。
// 名と普通の語は、辞書を引かないと見分けられない。
describe("undefined-acronym: 肩書きの後ろの題の書き方（受け入れた割り切り）", () => {
  it("The President NASA Memo の NASA は数えない", () => {
    assert.deepEqual(reportedAcronyms(en, "# Address\n\nThe President NASA Memo remains unpublished. The DOJ agreed.\n"), ["DOJ"]);
  });
});
