import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { anyYearDate, opensSpan, type AnyYearMarker, type DateSpan } from "../packages/chaff/src/detectors/date-any-year.ts";

// 年の無い日付のうち、どの年のものでもない日付（毎年の日、例の日付）。例文はすべて自作。

const spanOf = (source: string, date: string, from = 0): DateSpan => {
  const offset = source.indexOf(date, from);
  assert.notEqual(offset, -1, `${date} が無い`);
  return { offset, end: offset + date.length };
};

const JA: readonly AnyYearMarker[] = [
  { word: "例えば", reach: "sentence" },
  { word: "例：", reach: "sentence" },
  { word: "毎年", reach: "sentence" },
  { word: "年末年始", reach: "label" },
];
const EN: readonly AnyYearMarker[] = [
  { word: "for example", reach: "sentence" },
  { word: "e.g.", reach: "sentence" },
  { word: "every year", reach: "sentence" },
  { word: "each", reach: "adjacent" },
];

const covered = (source: string, date: string, markers: readonly AnyYearMarker[], from = 0): boolean =>
  anyYearDate(spanOf(source, date, from), source, markers);

describe("date-any-year: どの年のものでもない日付", () => {
  it("例を言う語が同じ文の前にあれば、例の日付と読む", () => {
    const text = "例えば、請求が4月1日に届いた場合、期限は4月16日となる。";
    assert.ok(covered(text, "4月1日", JA));
    assert.ok(covered(text, "4月16日", JA));
    assert.ok(covered("例：4月1日に届いた場合", "4月1日", JA));
    assert.ok(covered("For example, a request received on April 1 is due on April 16.", "April 16", EN));
    assert.ok(covered("A request received e.g. on March 31 is late.", "March 31", EN));
  });

  it("文が切れたあと、かっこが閉じたあとの日付は、例の日付と読まない", () => {
    assert.ok(!covered("例えば請求の場合です。届いたのは4月1日でした。", "4月1日", JA));
    assert.ok(!covered("（例えば請求の場合）、届いたのは4月1日でした。", "4月1日", JA));
    assert.ok(!covered("This is, for example, the rule. It began on April 1.", "April 1", EN));
    assert.ok(!covered("例えば\n4月1日に届いた", "4月1日", JA));
    assert.ok(!covered("The meeting was on April 1.", "April 1", EN));
    assert.ok(!covered("Take this one for example. 10 November was the hearing.", "10 November", EN));
  });

  it("長い語の頭だけが同じなら、その語と読まない", () => {
    assert.ok(!covered("The forms for examples are due April 1.", "April 1", EN));
    assert.ok(!covered("Every yearly report was filed on December 31.", "December 31", EN));
  });

  it("毎年の日と、each のすぐ後ろの日付を読む", () => {
    assert.ok(covered("毎年、4月1日に始まる。", "4月1日", JA));
    assert.ok(covered("Every year the office closes on December 31.", "December 31", EN));
    assert.ok(covered("Accounts close each December 31.", "December 31", EN));
    assert.ok(!covered("We reach December 31 soon.", "December 31", [{ word: "each", reach: "adjacent" }]));
    assert.ok(!covered("Each team reported on December 3.", "December 3", EN));
  });

  it("かっこの前の名前が年末年始なら、かっこの中の日付を読む", () => {
    const text = "土日、祝日又は年末年始閉庁日（12月29日～1月3日）の場合";
    assert.ok(covered(text, "12月29日", JA));
    assert.ok(covered(text, "1月3日", JA));
    assert.ok(!covered("年末年始閉庁日の後、臨時休館日（1月5日）がある", "1月5日", JA));
    assert.ok(!covered("年末年始は休み、臨時休館日（1月5日）がある", "1月5日", JA));
  });

  it("例を言う語で終わる行が導く箇条書きの日付を読む", () => {
    const list = "- we write ranges with 'to' – for example:\n\n- tax year 2011 to 2012\n- 10 November to 21 December\n";
    assert.ok(covered(list, "10 November", EN));
    assert.ok(covered("例：\n- 4月1日\n", "4月1日", JA));
    assert.ok(!covered("- we write ranges with 'to'\n\n- 10 November to 21 December\n", "10 November", EN));
    assert.ok(!covered("例：\n\n本文は4月1日に書いた。\n", "4月1日", JA));
    const long = `例：\n${"- 項目\n".repeat(100)}- 4月1日\n`;
    assert.ok(!covered(long, "4月1日", JA));
    assert.ok(covered(`例：\n${"- 項目\n".repeat(10)}- 4月1日\n`, "4月1日", JA));
  });

  it("空の語、語の無い表は何も読まない", () => {
    assert.ok(!covered("例えば4月1日", "4月1日", [{ word: "", reach: "sentence" }]));
    assert.ok(!covered("例えば4月1日", "4月1日", []));
    assert.ok(!anyYearDate({ offset: 0, end: 0 }, "", JA));
  });

  it("期間の始めの日付は、すぐ後ろにつなぐ語があるときだけ期間を開く", () => {
    const text = "4月1日から翌年3月31日まで";
    assert.ok(opensSpan(spanOf(text, "4月1日"), spanOf(text, "3月31日"), text, ["から"]));
    assert.ok(!opensSpan(spanOf(text, "4月1日"), spanOf(text, "3月31日"), text, []));
    assert.ok(!opensSpan(spanOf(text, "4月1日"), undefined, text, ["から"]));
    const far = "4月1日に始め、そのずっと後の、翌年3月31日まで";
    assert.ok(!opensSpan(spanOf(far, "4月1日"), spanOf(far, "3月31日"), far, ["から"]));
    const english = "April 1 to March 31 of the following year";
    assert.ok(opensSpan(spanOf(english, "April 1"), spanOf(english, "March 31"), english, ["to"]));
    const today = "April 1 today, March 31";
    assert.ok(!opensSpan(spanOf(today, "April 1"), spanOf(today, "March 31"), today, ["to"]));
  });
});

describe("date-without-year: どの年のものでもない日付は言わない", () => {
  const JA_YEARS = "# 手引\n\n2025年10月1日に改め、2026年4月1日に施行した。\n\n";
  const EN_YEARS = "# Guide\n\nRevised on October 1, 2025 and in force from April 1, 2026.\n\n";

  it("日本語で、例の日付、毎年の日、年末年始、年度の区切りを言わず、一度きりの日付は言う", () => {
    const quiet = [
      "例えば、請求が4月1日に届いた場合、期限は4月16日となる。",
      "年末年始閉庁日（12月29日～1月3日）は数えない。",
      "毎年4月1日に見直す。",
      "事業年度は4月1日から翌年3月31日までとする。",
      "例：\n\n- 4月1日に届いた場合\n",
    ].join("\n\n");
    assert.deepEqual(namedRuleRun("date-without-year", `${JA_YEARS}${quiet}\n`, ja).findings, []);
    assert.deepEqual(namedRuleRun("date-without-year", `${JA_YEARS}${quiet}\n\n説明会は10月28日に開いた。\n`, ja).findings, [
      "「10月28日」には年がありません。この文書の日付は 2025年から2026年にわたるので、どの年か決まりません",
    ]);
  });

  it("英語で、例の日付と毎年の日を言わず、一度きりの日付は言う", () => {
    const quiet = [
      "For example, a request received on April 1 is due on April 16.",
      "Accounts close each December 31.",
      "Every year the office closes on December 29.",
      "Dates use 'to' – for example:\n\n- 10 November to 21 December",
    ].join("\n\n");
    assert.deepEqual(namedRuleRun("date-without-year", `${EN_YEARS}${quiet}\n`, en).findings, []);
    assert.deepEqual(namedRuleRun("date-without-year", `${EN_YEARS}${quiet}\n\nThe briefing was held on October 28.\n`, en).findings, [
      '"October 28" has no year, and the document\'s dates run from 2025 to 2026, so the year is unclear',
    ]);
  });
});
