import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { notAcronymSpansOf, type NotationWords } from "../packages/chaff/src/detectors/acronym-context.ts";
import { nameNumeralSpans } from "../packages/chaff/src/detectors/name-numeral.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 番号を後ろに書く略した名前（Vol. XLIII、FIG. 3、FIGS. 1A-1C）と、ローマ数字の範囲（Reactions II-VI）。
// どれも番号の書き方で、略語ではない。US 4,683,202（パブリックドメイン）で報告されていた。例文は自作か、その特許の抜き書き。

const listOf = (adapter: LanguageAdapter, id: string): string[] => (adapter.lexicons[id] ?? []).map((entry) => entry.pattern);

const NONE: NotationWords = {
  meridiem: [],
  timeZones: [],
  currencies: [],
  usStates: [],
  emphasis: [],
  divisions: [],
  numberLabels: [],
  honorifics: [],
  titles: [],
  dateTimeUnits: [],
};
const spans = notAcronymSpansOf({ ...NONE, divisions: listOf(en, "numbered-division"), numberLabels: listOf(en, "number-label") });

/** 範囲にまるごと覆われた、大文字だけの語（- で繋いだ II-VI は 1 語）。 */
const covered = (text: string): string[] =>
  [...text.matchAll(/(?<![A-Za-z0-9-])[A-Z]+(?:-[A-Z]+)*(?![A-Za-z0-9-])/gu)]
    .filter((match) => spans(text).some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
    .map((match) => match[0]);

describe("番号を後ろに書く略した名前", () => {
  [
    ["巻の番号（L・C・D・M を含む数字も）", "Cold Spring Harbor Symposia on Quantitative Biology, Vol. XLIII (1979)", ["XLIII"]],
    ["全部大文字の名前", "VOL. XLIII, NO. IV", ["VOL", "XLIII", "NO", "IV"]],
    ["部・章", "see Pt. II and Ch. XII", ["II", "XII"]],
    ["特許の図", "FIG. 1 illustrates a 94 base pair length sequence", ["FIG"]],
    ["図の範囲", "FIGS. 4-1-4-3 illustrate in detail the steps", ["FIGS"]],
    ["英字の付いた図の番号と範囲", "as shown in FIGS. 1A-1C and FIG. 10B", ["FIGS", "FIG"]],
    ["番号の後ろの句読点", "FIG. 3, FIG. 4.", ["FIG", "FIG"]],
    ["区切りの名前の後ろのローマ数字の範囲", "see Part II-IV and Section VI–VIII", ["II-IV", "VI", "VIII"]],
  ].forEach(([form, text, words]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  it("valid: 区切りの名前の後ろの短い算用数字（TABLE 1、FIGURE 2A）", () => {
    assert.deepEqual(covered("TABLE 1 and FIGURE 2A"), ["TABLE", "FIGURE"]);
  });

  it("valid: 語彙表のどの名前でも、字面どおりでも全部大文字でも", () => {
    assert.notDeepEqual(listOf(en, "number-label"), []);
    listOf(en, "number-label")
      .flatMap((label) => [label, label.toUpperCase()])
      .forEach((label) => assert.deepEqual(covered(`in ${label} XLIII of it`).at(-1), "XLIII", label));
  });

  [
    ["名前が無い", "the FIG report, the FIGS 3"],
    ["点の無い略した名前（CH 4 はメタン、PT 3 は理学療法）", "FIG 3, CH 4, PT 3, Vol XLIII"],
    ["長い番号（番号ではなく数）", "FIG. 12345"],
    ["番号が無い", "FIG. A and FIG. and FIGS. of it"],
    ["番号の後ろに英字が二つ", "FIG. 3AB"],
    ["名前が語の一部", "CONFIG. 3, SUBFIG. 2"],
    ["崩れたローマ数字の範囲（範囲の後ろ半分は数字でない）", "Vol. II-ROM"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(covered(String(text)), []));
  });

  it("異常な入力: 空文字、名前だけ、空の語彙表", () => {
    assert.deepEqual(spans(""), []);
    assert.deepEqual(spans("FIG. "), []);
    assert.deepEqual(notAcronymSpansOf(NONE)("FIG. 3 and Vol. XLIII"), []);
  });
});

describe("nameNumeralSpans: 名前の後ろのローマ数字の範囲", () => {
  const numeralsIn = (text: string): string[] => nameNumeralSpans(text).map((span) => text.slice(span.start, span.end));

  [
    ["- で繋いだ範囲", "repeated four times for Reactions II-VI.", ["II-VI"]],
    ["– で繋いだ範囲", "the Stages I–III results", ["I–III"]],
  ].forEach(([form, text, words]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(numeralsIn(String(text)), words));
  });

  [
    ["範囲の後ろ半分が崩れている", "the Stages II-IIII results", ["II"]],
    ["範囲の後ろ半分が C・D・L・M を含む", "the Stages II-CD results", ["II"]],
    ["範囲の後ろに英字", "the Stages II-VIa results", ["II"]],
  ].forEach(([form, text, words]) => {
    it(`invalid: ${String(form)}（範囲としては覆わない）`, () => assert.deepEqual(numeralsIn(String(text)), words));
  });
});

const without = (adapter: LanguageAdapter, id: string, word: string): LanguageAdapter => ({
  ...adapter,
  lexicons: { ...adapter.lexicons, [id]: (adapter.lexicons[id] ?? []).filter((entry) => entry.pattern !== word) },
});

describe("undefined-acronym と番号の書き方（en）", () => {
  const doc = (sentence: string): string => `# Notes\n\n${sentence} The SRE joins.\n`;

  it("valid: 特許の図・巻の番号・範囲は数えず、SRE は数える", () => {
    [
      "FIG. 1 illustrates a sequence.",
      "FIGS. 1A-1C show the device.",
      "See Symposia on Biology, Vol. XLIII, page 3.",
      "The cycle was repeated for Reactions II-VI.",
    ].forEach((sentence) => assert.deepEqual(reportedAcronyms(en, doc(sentence)), ["SRE"], sentence));
  });

  it("invalid: 語彙表から抜いた名前の後ろでは数える", () => {
    assert.deepEqual(reportedAcronyms(without(en, "number-label", "Fig."), doc("FIG. 1 illustrates a sequence.")), ["FIG", "SRE"]);
    assert.deepEqual(reportedAcronyms(without(en, "number-label", "Vol."), doc("See Symposia on Biology, Vol. XLIII, page 3.")), ["XLIII", "SRE"]);
  });

  it("invalid: 名前の無い大文字は数える", () => {
    assert.deepEqual(reportedAcronyms(en, doc("The FIG report is due.")), ["FIG", "SRE"]);
  });
});

describe("undefined-acronym と番号の書き方（ja）", () => {
  it("valid: 英語の図の番号は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\n構成は FIG. 3 に示します。SREも見ます。\n"), ["SRE"]);
  });

  it("invalid: 語彙表から抜いた名前の後ろでは数える", () => {
    assert.deepEqual(reportedAcronyms(without(ja, "number-label", "Fig."), "# 手引き\n\n構成は FIG. 3 に示します。SREも見ます。\n"), ["FIG", "SRE"]);
  });
});
