import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { reportedAcronyms } from "./rule-run.ts";
import { placeholderSpans } from "../packages/chaff/src/detectors/placeholder.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 日付・時刻の数字の代わりに置く同じ大文字の繰り返し（令和YY年MM月DD日 HH：MM、MM/DD/YYYY）は略語ではない。例文は自作。
// e-Tax の送信メールの定型文で、YY・MM・DD・HH が説明の無い略語として報告されていた。

const UNITS = (ja.lexicons["date-time-unit"] ?? []).map((entry) => entry.pattern);

/** 範囲にまるごと覆われた、大文字だけの語。 */
const covered = (text: string, units: readonly string[] = UNITS): string[] =>
  [...text.matchAll(/(?<![A-Za-z])[A-Z]+(?![A-Za-z])/gu)]
    .filter((match) => placeholderSpans(text, units).some((span) => span.start <= match.index && match.index + match[0].length <= span.end))
    .map((match) => match[0]);

describe("placeholderSpans", () => {
  [
    ["単位の前（年・月・日）", "有効期限は令和YY年MM月DD日です", ["YY", "MM", "DD"]],
    ["単位の前（時・分・秒）", "HH時MM分SS秒に送ります", ["HH", "MM", "SS"]],
    ["全角のコロンで繋ぐ時刻", "期限は HH：MM となります", ["HH", "MM"]],
    ["半角のコロンで繋ぐ時刻と秒", "at HH:MM:SS today", ["HH", "MM", "SS"]],
    ["スラッシュで繋ぐ日付", "enter MM/DD/YYYY here", ["MM", "DD", "YYYY"]],
    ["ハイフンで繋ぐ日付", "use YYYY-MM-DD dates", ["YYYY", "MM", "DD"]],
    ["ドットで繋ぐ日付", "use DD.MM.YYYY dates", ["DD", "MM", "YYYY"]],
    ["数字と繋ぐ", "due 2026/MM/DD and 10:MM", ["MM", "DD", "MM"]],
    ["全角のスラッシュ", "YYYY／MM／DD", ["YYYY", "MM", "DD"]],
    ["一つの文に 2 度置いた短い空欄", "ただし OO で OO な方は登録できます", ["OO", "OO"]],
    ["一つの文に 3 度置いた X の空欄", "XX が XX に XX を送る", ["XX", "XX", "XX"]],
  ].forEach(([form, text, words]) => {
    it(`valid: ${String(form)}`, () => assert.deepEqual(covered(String(text)), words));
  });

  [
    ["同じ文字の繰り返しでない略語が単位の前", "AI時代の働き方とEU日本代表部"],
    ["同じ文字の繰り返しでない略語どうしを区切りで繋ぐ", "the CI/CD pipeline and TCP/IP"],
    ["繰り返しでない略語が混ざる並び", "MM/CD and HH:TOP"],
    ["繰り返しでも単位でも区切りでもない所", "SS内での活動、the AA meeting"],
    ["区切りのあとに空白", "CC: the team, MM / DD"],
    ["語の一部", "COMM/DD, MMX/DD, the XHH:MMY"],
    ["1 文字", "M/D/Y and H:M"],
    ["数字だけ", "2026/01/31 12:30"],
    ["一つだけの短い繰り返し", "I am OOO today, ask the OO team"],
    ["違う形の短い繰り返し", "OO and OOO, XX and XXX"],
    ["O と X 以外の短い繰り返し", "AA and AA, the BB and BB"],
  ].forEach(([form, text]) => {
    it(`invalid: ${String(form)}`, () => assert.deepEqual(covered(String(text)), []));
  });

  it("単位の語彙表が空なら、単位の前は外さず、区切りの形だけを外す", () => {
    assert.deepEqual(covered("令和YY年 and MM/DD", []), ["MM", "DD"]);
  });

  it("異常な入力: 空文字、区切りだけ", () => {
    assert.deepEqual(placeholderSpans("", UNITS), []);
    assert.deepEqual(placeholderSpans("/:-.", UNITS), []);
    assert.deepEqual(placeholderSpans("年月日", UNITS), []);
  });
});

describe("undefined-acronym と日付・時刻の書式", () => {
  it("ja: 定型文の YY・MM・DD・HH は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\n有効期限は令和YY年MM月DD日 HH：MMとなります。SREも見ます。\n"), ["SRE"]);
  });

  it("en: MM/DD/YYYY と HH:MM は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nWrite the date as MM/DD/YYYY and the time as HH:MM. The SRE joins.\n"), ["SRE"]);
  });

  it("ja: 語彙表から単位を抜けば、単位の前の繰り返しは数える", () => {
    const withoutUnits: LanguageAdapter = { ...ja, lexicons: { ...ja.lexicons, "date-time-unit": [] } };
    assert.deepEqual(reportedAcronyms(withoutUnits, "# 手引き\n\n有効期限は令和YY年です。SREも見ます。\n"), ["YY", "SRE"]);
  });

  it("ja: 一つの文に 2 度置いた空欄の OO は数えず、SRE は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\nただし OO で OO な方は登録できます。SREも見ます。\n"), ["SRE"]);
  });

  it("en: 一つだけの OOO は数える", () => {
    assert.deepEqual(reportedAcronyms(en, "# Notes\n\nThe lead is OOO this week.\n"), ["OOO"]);
  });

  it("ja: 単位の前でも、同じ文字の繰り返しでない略語は数える", () => {
    assert.deepEqual(reportedAcronyms(ja, "# 手引き\n\nRPA時代にSREも見ます。\n"), ["RPA", "SRE"]);
  });
});
