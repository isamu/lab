import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { notAcronymSpansOf } from "../packages/chaff/src/detectors/acronym-context.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const listOf = (id: string): string[] => (en.lexicons[id] ?? []).map((entry) => entry.pattern);

const notAcronymSpans = notAcronymSpansOf({
  meridiem: listOf("meridiem"),
  timeZones: listOf("time-zone"),
  currencies: listOf("currency-code"),
  usStates: listOf("us-state-code"),
  emphasis: listOf("emphasis-word"),
  divisions: listOf("numbered-division"),
  honorifics: listOf("honorific"),
  dateTimeUnits: listOf("date-time-unit"),
});

/** 範囲に覆われた大文字の語だけを返す。 */
const covered = (text: string): string[] =>
  [...text.matchAll(/(?<![A-Za-z])[A-Z]{2,6}(?![A-Za-z])/gu)]
    .filter((match) => notAcronymSpans(text).some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
    .map((match) => match[0]);

describe("notAcronymSpans: 時刻", () => {
  [
    ["by 3:30 PM Eastern", ["PM"]],
    ["at 9 AM sharp", ["AM"]],
    ["at 10AM", ["AM"]],
    ["after 2pm ET (1pm CT)", ["ET", "CT"]],
    ["from 10:00 JST", ["JST"]],
    ["until 23:59 UTC", ["UTC"]],
    ["at 12:30pm ET", ["ET"]],
    ["at 3:30  PM  PST", ["PM", "PST"]],
    ["at 3:30\nPM", ["PM"]],
    ["at 3:30 PM PST", ["PM", "PST"]],
    ["at 5 p.m. PT", ["PT"]],
    ["at 5 P.M. PT", ["PT"]],
  ].forEach(([text, words]) => {
    it(`valid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  [
    ["the PM owns it", []],
    ["see Table 5 CT scans", []],
    ["version 1.5 PM", []],
    ["room 12:00 ACT", []],
    ["123 PM", []],
    ["13 PM", []],
    ["99 PM", []],
    ["00 AM", []],
    ["at 10 JST", []],
    ["24:00 UTC", []],
    ["build 123:45 UTC", []],
  ].forEach(([text, words]) => {
    it(`invalid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });
});

describe("notAcronymSpans: 通貨", () => {
  [
    ["up to USD 1,000,000 worth", ["USD"]],
    ["costs 250 EUR today", ["EUR"]],
    ["JPY 3.5 million", ["JPY"]],
    ["a GBP1,200 fee", ["GBP"]],
    ["12,345.50 USD", ["USD"]],
    ["USD $1,000 or $1,000 USD", ["USD", "USD"]],
    ["USD  1,000 and 250\nEUR", ["USD", "EUR"]],
  ].forEach(([text, words]) => {
    it(`valid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  [
    ["prices in USD only", []],
    ["the XYZ 250 fee", []],
    ["RFC 9457 applies", []],
    ["v1.5 USD", []],
    ["item 1, USD applies", []],
    ["send 3 CAD files", []],
    ["see 1,23 USD", []],
    ["1,2345 USD", []],
  ].forEach(([text, words]) => {
    it(`invalid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });
});

describe("notAcronymSpans: 米国の住所", () => {
  [
    ["Kansas City, MO 64108", ["MO"]],
    ["Berkeley, CA 94720-1234", ["CA"]],
    ["Washington, DC 20405", ["DC"]],
    ["Berkeley,\nCA  94720", ["CA"]],
    ["Berkeley,  CA 94720", ["CA"]],
  ].forEach(([text, words]) => {
    it(`valid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  [
    ["the CA signs it", []],
    ["Berkeley, CA 947", []],
    ["Berkeley, CA 947201", []],
    ["Berkeley CA 94720", []],
    ["notes, XX 94720", []],
  ].forEach(([text, words]) => {
    it(`invalid: ${String(text)}`, () => assert.deepEqual(covered(String(text)), words));
  });
});

describe("notAcronymSpans: 略語の読みを持たない機能語", () => {
  it("valid: 単独の NOT と AND", () => assert.deepEqual(covered("should NOT change color AND shape"), ["NOT", "AND"]));

  it("invalid: 語の一部や、略語でもある機能語（OR、IS）は覆わない", () => {
    assert.deepEqual(covered("NOTE and ANDROID, OR, and ISO IS 15408"), []);
  });
});

describe("notAcronymSpans: 異常な入力", () => {
  it("空文字", () => assert.deepEqual(notAcronymSpans(""), []));

  it("数字だけ", () => assert.deepEqual(notAcronymSpans("12:30 1,000 94720"), []));
});

describe("notAcronymSpansOf: 語彙表の形", () => {
  const none = { meridiem: [], timeZones: [], currencies: [], usStates: [], emphasis: [], divisions: [], honorifics: [], dateTimeUnits: [] };

  it("空の語彙表はどこにも当たらない（空の選択肢で文字の間に当たらない）", () => {
    assert.deepEqual(notAcronymSpansOf(none)("at 3:30 PM, USD 1,000, Berkeley, CA 94720, NOT, PART II"), []);
  });

  it("語は字面どおりに照らす。正規表現の記号は記号のまま（NB+ は NBB に当たらない）", () => {
    const spans = notAcronymSpansOf({ ...none, emphasis: ["NB+"] });
    assert.deepEqual(spans("NBB"), []);
    assert.deepEqual(spans("see NB+ here"), [{ start: 4, end: 7 }]);
  });

  it("大文字と小文字を区別する（pm は語彙表の PM ではない）", () => {
    assert.deepEqual(notAcronymSpansOf({ ...none, meridiem: ["PM"] })("at 3:30 pm"), []);
  });
});
