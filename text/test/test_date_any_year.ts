import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { anyYearDate, opensSpan, type AnyYearMarker, type DateSpan } from "../packages/chaff/src/detectors/date-any-year.ts";
import { headingNamesYear, yearLabelOf, type HeadingYearWords } from "../packages/chaff/src/detectors/date-heading-year.ts";
import { wholeYear } from "../packages/chaff/src/detectors/date-year.ts";

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

describe("date-any-year: 例の続き、決算日", () => {
  const EXAMPLES: readonly AnyYearMarker[] = [
    { word: "for example", reach: "example" },
    { word: "if", reach: "continues" },
    { word: "例えば", reach: "example" },
    { word: "もし", reach: "continues" },
    { word: "fiscal year end", reach: "near" },
    { word: "決算日", reach: "near" },
  ];

  it("例の語は、同じ箇条書きの項目の終わりまでかかり、項目の外にはかからない", () => {
    const item = "- For example, a form sent on May 4 is late. Its reply is due on May 18.\n";
    assert.ok(covered(item, "May 18", EXAMPLES));
    assert.ok(!covered("For example, a form sent on May 4 is late. Its reply is due on May 18.\n", "May 18", EXAMPLES));
    assert.ok(!covered(`${item}- The office closed on May 20.\n`, "May 20", EXAMPLES));
  });

  it("例の項目のすぐ次で if に始まる項目は、例の続きと読む", () => {
    const list =
      "- For example, a form sent on May 4 is due on May 18.\n- If it is instead sent on May 6, it is due on May 20.\n- If that is late too, it is due on May 27.\n";
    assert.ok(covered(list, "May 6", EXAMPLES));
    assert.ok(covered(list, "May 27", EXAMPLES));
    assert.ok(covered("- 例えば5月4日に届いた場合。\n- もし5月6日に届いたなら、期限は5月20日。\n", "5月6日", EXAMPLES));
  });

  it("例の無い項目のあと、空行のあと、深さの違う項目、文の if は、例の続きと読まない", () => {
    assert.ok(!covered("- Forms are checked weekly.\n- If one arrived on May 6, it was late.\n", "May 6", EXAMPLES));
    assert.ok(!covered("- For example, a form sent on May 4.\n\n- If it arrived on May 6, it was late.\n", "May 6", EXAMPLES));
    assert.ok(!covered("- For example, a form sent on May 4.\n    - If it arrived on May 6, it was late.\n", "May 6", EXAMPLES));
    assert.ok(!covered("- For example, a form sent on May 4.\n- Iffy forms arrived on May 6.\n", "May 6", EXAMPLES));
    assert.ok(!covered("For example, a form sent on May 4.\nIf it arrived on May 6, it was late.\n", "May 6", EXAMPLES));
    assert.ok(!covered("- If it arrived on May 6, it was late.\n", "May 6", EXAMPLES));
  });

  it("決算日・fiscal year end のすぐ後ろの日付を読み、離れた日付と ended の日付は読まない", () => {
    assert.ok(covered("子会社の決算日は、12月31日であります。", "12月31日", EXAMPLES));
    assert.ok(covered("Our fiscal year end is March 31.", "March 31", EXAMPLES));
    assert.ok(!covered("決算日の翌々日の3月5日に開いた。", "3月5日", EXAMPLES));
    assert.ok(!covered("For the fiscal year ended March 31, sales rose.", "March 31", EXAMPLES));
  });
});

describe("wholeYear: 一年まるごとの期間", () => {
  it("終わりが始めの前の日なら一年", () => {
    assert.ok(wholeYear("01-01", "12-31"));
    assert.ok(wholeYear("04-01", "03-31"));
    assert.ok(wholeYear("03-01", "02-28"));
  });

  it("一年でない期間、年のある日付、形の違う値は一年と読まない", () => {
    assert.ok(!wholeYear("12-29", "01-03"));
    assert.ok(!wholeYear("01-01", "12-30"));
    assert.ok(!wholeYear("01-01", "01-01"));
    assert.ok(!wholeYear("2026-01-01", "12-31"));
    assert.ok(!wholeYear("", "12-31"));
    assert.ok(!wholeYear("01-01", "garbage"));
  });
});

describe("headingNamesYear: 年を名指す見出し", () => {
  const WORDS: HeadingYearWords = { eras: ["令和"], labels: [yearLabelOf("FY{y}"), yearLabelOf("fiscal year {y}")].flatMap((label) => label ?? []) };
  const NONE: HeadingYearWords = { eras: [], labels: [] };

  it("数字の年、元号の年、年度の名前を読む", () => {
    assert.ok(headingNamesYear("2026年度の予定", WORDS));
    assert.ok(headingNamesYear("2026年度", NONE));
    assert.ok(headingNamesYear("Events in 2026", WORDS));
    assert.ok(headingNamesYear("令和8年の行事", WORDS));
    assert.ok(headingNamesYear("令和元年度", WORDS));
    assert.ok(headingNamesYear("FY27-Q2 (May 1)", WORDS));
    assert.ok(headingNamesYear("fy2027 plan", WORDS));
    assert.ok(headingNamesYear("Fiscal Year 27", WORDS));
  });

  it("年でない数、語の途中、年の無い名前、語の無い表は読まない", () => {
    assert.ok(!headingNamesYear("Schedule", WORDS));
    assert.ok(!headingNamesYear("Top 300 tasks", WORDS));
    assert.ok(!headingNamesYear("Room 12034", WORDS));
    assert.ok(!headingNamesYear("令和の行事", WORDS));
    assert.ok(!headingNamesYear("SPFY27 code", WORDS));
    assert.ok(!headingNamesYear("FY plan", WORDS));
    assert.ok(!headingNamesYear("FY123 plan", WORDS));
    assert.ok(!headingNamesYear("FY27-Q2", NONE));
    assert.ok(!headingNamesYear("", WORDS));
    assert.equal(yearLabelOf("Q{n}"), undefined);
    assert.equal(yearLabelOf("fiscal year ending {_} {e}"), undefined);
  });
});

describe("date-without-year: 見出しの年、例の続き、毎年の期間", () => {
  const JA_YEARS = "# 手引\n\n2025年10月1日に改め、2026年4月1日に施行した。\n\n";
  const EN_YEARS = "# Guide\n\nRevised on October 1, 2025 and in force from April 1, 2026.\n\n";

  it("年を名指す見出しの下の日付、決算日、一年の期間を言わず、年の無い見出しの下の日付は言う", () => {
    const quiet = [
      "## 令和8年度の予定\n\n- 5月10日：説明会\n- 6月1日：締切",
      "## 決算\n\n子会社の決算日は、12月31日であります。事業年度は4月1日から3月31日までです。",
    ].join("\n\n");
    assert.deepEqual(namedRuleRun("date-without-year", `${JA_YEARS}${quiet}\n`, ja).findings, []);
    assert.deepEqual(namedRuleRun("date-without-year", `${JA_YEARS}${quiet}\n\n## 今後\n\n説明会は10月28日に開く。\n`, ja).findings, [
      "「10月28日」には年がありません。この文書の日付は 2025年から2026年にわたるので、どの年か決まりません",
    ]);
  });

  it("英語で、年度の見出し、例の続き、暦年の期間を言わず、年の無い見出しの下の会議は言う", () => {
    const quiet = [
      "## FY27-Q2 (May 1)\n\n- **Jan 12**: nominations open\n- **May 1**: changes take effect",
      "## Pay changes\n\n- For example, a change made on June 22 takes effect on June 16. The next cut-off is June 23.\n- If the change is instead made on June 25, it takes effect on July 1.",
      "## Allowance\n\nThe allowance resets each calendar year (January 1 to December 31).",
    ].join("\n\n");
    assert.deepEqual(namedRuleRun("date-without-year", `${EN_YEARS}${quiet}\n`, en).findings, []);
    assert.deepEqual(namedRuleRun("date-without-year", `${EN_YEARS}${quiet}\n\n## Meetings\n\nThe board met on March 12.\n`, en).findings, [
      '"March 12" has no year, and the document\'s dates run from 2025 to 2026, so the year is unclear',
    ]);
  });
});
