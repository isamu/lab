import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { bandSlips, headingOf, parseBand, type Band, type PlacedBand, type UnitKind } from "../packages/chaff/src/structure/range-bands.ts";
import { bandWordsOf } from "../packages/chaff/src/detectors/range-band.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { loadLexicons as loadJaLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { loadLexicons as loadEnLexicons } from "../packages/lang-en/src/lexicons.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// range-band-mismatch: neighbouring bands of a table column or a list that overlap or leave a gap. Self-written text.

const JA = bandWordsOf(loadJaLexicons());
const EN = bandWordsOf(loadEnLexicons());

/** A band as "low..high" with [ ] for an included end, ( ) for an excluded one, ~ for a range mark, and the unit. */
const shown = (band: Band | undefined): string => {
  if (band === undefined) return "none";
  const mark = { inclusive: "[", exclusive: "(", loose: "~" };
  const close = { inclusive: "]", exclusive: ")", loose: "~" };
  const low = band.low === undefined ? "-" : `${mark[band.low.kind]}${band.low.value}`;
  const high = band.high === undefined ? "-" : `${band.high.value}${close[band.high.kind]}`;
  return `${low}..${high} ${band.unit}`.trim();
};

describe("parseBand", () => {
  it("reads the Japanese words of an end", () => {
    assert.equal(shown(parseBand("7〜11歳", JA)), "~7..11~ 歳");
    assert.equal(shown(parseBand("7歳～11歳", JA)), "~7..11~ 歳");
    assert.equal(shown(parseBand("15歳以上", JA)), "[15..- 歳");
    assert.equal(shown(parseBand("7歳未満", JA)), "-..7) 歳");
    assert.equal(shown(parseBand("6歳以下", JA)), "-..6] 歳");
    assert.equal(shown(parseBand("100万円超", JA)), "(100..- 万円");
    assert.equal(shown(parseBand("100万円を超え300万円以下", JA)), "(100..300] 万円");
    assert.equal(shown(parseBand("60kg以上70kg未満", JA)), "[60..70) kg");
    assert.equal(shown(parseBand("12歳〜", JA)), "~12..- 歳");
    assert.equal(shown(parseBand("〜6歳", JA)), "-..6~ 歳");
    assert.equal(shown(parseBand("**１２〜１４歳**", JA)), "~12..14~ 歳");
    assert.equal(shown(parseBand("7〜11", JA)), "~7..11~");
  });

  it("reads the English words of an end, before or after the number", () => {
    assert.equal(shown(parseBand("7 to 11", EN)), "~7..11~");
    assert.equal(shown(parseBand("Ages 6–11", EN)), "~6..11~");
    assert.equal(shown(parseBand("1 to 6 years", EN)), "~1..6~ year");
    assert.equal(shown(parseBand("8 years and over", EN)), "[8..- year");
    assert.equal(shown(parseBand("13 and over", EN)), "[13..-");
    assert.equal(shown(parseBand("Under 7", EN)), "-..7)");
    assert.equal(shown(parseBand("over 65", EN)), "(65..-");
    assert.equal(shown(parseBand("65+", EN)), "[65..-");
    assert.equal(shown(parseBand("3 or more nights", EN)), "[3..- night");
    assert.equal(shown(parseBand("up to $50,000", EN)), "-..50000] $");
    assert.equal(shown(parseBand("$50,000.01 to $100,000", EN)), "~50000.01..100000~ $");
    assert.equal(shown(parseBand("between $100,000 and $250,000", EN)), "~100000..250000~ $");
    assert.equal(shown(parseBand("from $50 to $99", EN)), "~50..99~ $");
    assert.equal(shown(parseBand("from 15", EN)), "[15..-");
  });

  it("does not read a hyphen before a lone number as the upper end (a bullet or a minus)", () => {
    assert.equal(shown(parseBand("- 1521", EN)), "none");
    assert.equal(shown(parseBand("-6歳", JA)), "none");
  });

  it("does not read a single value, a time, a date, two units, a reversed range or words around the band", () => {
    assert.equal(shown(parseBand("3", JA)), "none");
    assert.equal(shown(parseBand("2錠", JA)), "none");
    assert.equal(shown(parseBand("9:00〜12:00", JA)), "none");
    assert.equal(shown(parseBand("4月1日〜4月3日", JA)), "none");
    assert.equal(shown(parseBand("2020〜2022年度", JA)), "none");
    assert.equal(shown(parseBand("2020〜2022年", JA)), "none");
    assert.equal(shown(parseBand("-10〜0℃", JA)), "none");
    assert.equal(shown(parseBand("7歳〜11kg", JA)), "none");
    assert.equal(shown(parseBand("12〜7歳", JA)), "none");
    assert.equal(shown(parseBand("小学生（7〜12歳）", JA)), "none");
    assert.equal(shown(parseBand("Articles 1 to 5", EN)), "none");
    assert.equal(shown(parseBand("total", EN)), "none");
    assert.equal(shown(parseBand("", EN)), "none");
  });

  it("drops a note in brackets at the end of the cell", () => {
    assert.equal(shown(parseBand("15歳以上（成人）", JA)), "[15..- 歳");
  });
});

describe("headingOf", () => {
  it("reads a heading that names the quantity, or a unit in brackets", () => {
    assert.deepEqual(headingOf("年齢", JA), { unit: "", kind: "integer" });
    assert.deepEqual(headingOf("体重(kg)", JA), { unit: "kg", kind: "continuous" });
    assert.deepEqual(headingOf("Age", EN), { unit: "", kind: "integer" });
    assert.deepEqual(headingOf("Weight (kg)", EN), { unit: "kg", kind: "continuous" });
  });

  it("does not read another heading", () => {
    assert.equal(headingOf("1回量", JA), undefined);
    assert.equal(headingOf("Times a day", EN), undefined);
    assert.equal(headingOf("", EN), undefined);
  });
});

const placed = (words: typeof JA, ...texts: string[]): PlacedBand[] =>
  texts.map((text, index) => {
    const band = parseBand(text, words);
    if (band === undefined) throw new Error(`not a band: ${text}`);
    return { band, start: index * 10, end: index * 10 + text.length, text };
  });

const slips = (kind: UnitKind, words: typeof JA, ...texts: string[]): string[] =>
  bandSlips(placed(words, ...texts), kind).map((slip) => `${slip.kind} ${slip.earlier.text} / ${slip.later.text}`);

describe("bandSlips", () => {
  it("integer bands: contiguous when the next starts one past the end, in either order", () => {
    assert.deepEqual(slips("integer", JA, "7歳未満", "7〜11歳", "12〜14歳", "15歳以上"), []);
    assert.deepEqual(slips("integer", JA, "15歳以上", "12〜14歳", "7〜11歳", "7歳未満"), []);
    assert.deepEqual(slips("integer", EN, "Under 7", "7 to 11", "12 to 14", "15 and over"), []);
    assert.deepEqual(slips("integer", JA, "6歳以下", "7歳以上"), []);
  });

  it("integer bands: an end number written twice overlaps, a missing number is a gap", () => {
    assert.deepEqual(slips("integer", JA, "15歳以上", "12〜14歳", "7〜12歳", "7歳未満"), ["overlap 12〜14歳 / 7〜12歳"]);
    assert.deepEqual(slips("integer", JA, "1〜6歳", "8歳以上"), ["gap 1〜6歳 / 8歳以上"]);
    assert.deepEqual(slips("integer", EN, "Ages 6–11", "13 and over"), ["gap Ages 6–11 / 13 and over"]);
    assert.deepEqual(slips("integer", JA, "7歳未満", "8歳以上"), ["gap 7歳未満 / 8歳以上"]);
    assert.deepEqual(slips("integer", JA, "0〜59点", "60〜79点", "90〜100点"), ["gap 60〜79点 / 90〜100点"]);
  });

  it("continuous bands: a shared end with a range mark, or one written step apart, is contiguous", () => {
    assert.deepEqual(slips("continuous", JA, "50〜60kg", "60〜70kg", "70kg以上"), []);
    assert.deepEqual(slips("continuous", JA, "50〜59kg", "60〜69kg", "70kg以上"), []);
    assert.deepEqual(slips("continuous", JA, "195万円以下", "195万円を超え330万円以下", "330万円超"), []);
    assert.deepEqual(slips("continuous", EN, "up to $49.99", "$50 to $99.99", "$100 or more"), []);
    assert.deepEqual(slips("continuous", JA, "60kg未満", "60kg以上"), []);
    assert.deepEqual(slips("continuous", EN, "less than $100,000", "between $100,000 and $250,000", "over $250,000"), []);
    assert.deepEqual(slips("continuous", JA, "0.7以上", "0.5以上0.7未満", "0.0超0.5未満"), []);
  });

  it("continuous bands: an end written included on both sides overlaps, excluded on both sides or a wider step is a gap", () => {
    assert.deepEqual(slips("continuous", JA, "50kg以下", "50kg以上"), ["overlap 50kg以下 / 50kg以上"]);
    assert.deepEqual(slips("continuous", JA, "50kg未満", "50kg超"), ["gap 50kg未満 / 50kg超"]);
    assert.deepEqual(slips("continuous", JA, "60kg未満", "61kg以上"), ["gap 60kg未満 / 61kg以上"]);
    assert.deepEqual(slips("continuous", JA, "40〜50kg", "52〜60kg", "60kg以上"), ["gap 40〜50kg / 52〜60kg"]);
    assert.deepEqual(slips("continuous", JA, "40〜50kg", "48〜60kg", "60kg以上"), ["overlap 40〜50kg / 48〜60kg"]);
    assert.deepEqual(slips("integer", JA, "0.5〜1歳", "1〜2歳", "2〜3歳"), []);
  });

  it("stays silent on nested tiers, bands out of order, large overlaps and a far-apart pair", () => {
    assert.deepEqual(slips("continuous", JA, "〜100万円", "〜200万円", "〜300万円"), []);
    assert.deepEqual(slips("integer", EN, "5 or more", "10 or more", "20 or more"), []);
    assert.deepEqual(slips("integer", JA, "7〜11歳", "15歳以上", "12〜14歳"), []);
    assert.deepEqual(slips("continuous", JA, "10〜25kg", "15〜40kg", "35〜60kg"), []);
    assert.deepEqual(slips("integer", JA, "1〜6歳", "30歳以上"), []);
    assert.deepEqual(slips("integer", JA, "7〜11歳"), []);
    assert.deepEqual(slips("integer", JA), []);
  });
});

const slipsIn = (adapter: LanguageAdapter, source: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, false, "business/manual")
    .findings.filter((finding) => finding.rule === "range-band-mismatch")
    .map((finding) => `${finding.line} ${String(finding.values["earlier"])} / ${String(finding.values["later"])}${finding.variant === "gap" ? " gap" : ""}`);

before(async () => {
  await ja.prepare?.({ pos: true });
  await en.prepare?.({ pos: true });
});

const table = (heading: string, ...rows: string[]): string =>
  ["# 用法", "", `| ${heading} | 1回量 |`, "| --- | --- |", ...rows.map((row) => `| ${row} | 1錠 |`), ""].join("\n");

describe("range-band-mismatch", () => {
  it("reports an overlap and a gap in a table column, at the later row", () => {
    assert.deepEqual(slipsIn(ja, table("年齢", "15歳以上", "12〜14歳", "7〜12歳", "7歳未満")), ["7 12〜14歳 / 7〜12歳"]);
    assert.deepEqual(slipsIn(ja, table("年齢", "1〜6歳", "8歳以上")), ["6 1〜6歳 / 8歳以上 gap"]);
    assert.deepEqual(slipsIn(en, table("Age", "15 and over", "12 to 14", "7 to 12", "Under 7")), ["7 12 to 14 / 7 to 12"]);
  });

  it("reads bare numbers only under a heading that says what they count", () => {
    assert.deepEqual(slipsIn(ja, table("区分", "15以上", "12〜14", "7〜12")), []);
    assert.deepEqual(slipsIn(en, table("Lessons", "1 to 4", "4 to 8", "9 to 12")), []);
  });

  it("stays silent on a contiguous table and on bands broken by another row", () => {
    assert.deepEqual(slipsIn(ja, table("年齢", "15歳以上", "12〜14歳", "7〜11歳", "7歳未満")), []);
    assert.deepEqual(slipsIn(ja, table("年齢", "12〜14歳", "合計", "7〜12歳")), []);
  });

  it("reads the head of consecutive list items", () => {
    const list = ["# 料金", "", "- 6〜11歳：500円", "- 13歳以上：1,000円", ""].join("\n");
    assert.deepEqual(slipsIn(ja, list), ["4 6〜11歳 / 13歳以上 gap"]);
    const english = ["# Fees", "", "- Ages 6–11: $5", "- 13 and over: $10", ""].join("\n");
    assert.deepEqual(slipsIn(en, english), []);
    const withUnit = ["# Fees", "", "- 6 to 11 years: $5", "- 13 years and over: $10", ""].join("\n");
    assert.deepEqual(slipsIn(en, withUnit), ["4 6 to 11 years / 13 years and over gap"]);
  });

  it("does not read ranges in prose", () => {
    assert.deepEqual(slipsIn(ja, "# 用法\n\n7〜12歳は半錠、12〜14歳は1錠を服用してください。\n"), []);
  });
});
