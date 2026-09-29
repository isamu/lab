import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notAcronymSpansOf, type NotationWords } from "../packages/chaff/src/detectors/acronym-context.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

// 議事録・速記録は発言者の姓を大文字で書く（Mr. HAWLEY.、Mrs. CAPITO.）。敬称のすぐ後ろの大文字の語は名前で、略語ではない。例文はすべて自作。

const listOf = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);

const NONE: NotationWords = { meridiem: [], timeZones: [], currencies: [], usStates: [], emphasis: [], divisions: [], honorifics: [] };
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
