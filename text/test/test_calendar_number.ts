import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { latinSpacing } from "./rule-run.ts";
import { calendarRuns, type CalendarUnits } from "../packages/chaff/src/calendar-number.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";

// 日付・時刻の数（9月、2026年、10時5分）は詰めて書く決まりで、空け方の好みではない。latin-spacing の票に入れない。
// 期間（3ヶ月、3 時間、5日で）は数量で、これまでどおり数える。

const patternList = (id: string): string[] => (ja.lexicons[id] ?? []).map((entry) => entry.pattern);
const listOf = (id: string): ReadonlySet<string> => new Set(patternList(id));

const UNITS: CalendarUnits = { chained: patternList("date-time-unit"), positional: listOf("calendar-unit"), year: listOf("calendar-year-unit") };

/** 文ごとの日付の数を、書いたとおりの字と位置（first か inner）で。 */
const calendarOf = (text: string): string[] =>
  buildDocument("a.md", `${text}\n`, ja).sentences.flatMap((sentence) =>
    calendarRuns(sentence.text, sentence.tokens, sentence.span.start, UNITS).map(({ run, place }) => `${sentence.text.slice(run.start, run.end)}:${place}`),
  );

describe("calendarRuns", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const cases: readonly (readonly [string, string, readonly string[]])[] = [
    ["a month names a position", "9月の問い合わせ", ["9:first"]],
    ["a month written with a space", "9 月の問い合わせ", ["9:first"]],
    ["a length of months is another word", "3ヶ月と3か月", []],
    ["an hour of the clock", "会議は3時に始まる", ["3:first"]],
    ["half past the hour", "3時半に始まる", ["3:first"]],
    ["a length of hours is another word", "3時間と3 時間", []],
    ["year, month and day, the later parts inside the date", "2026年9月30日", ["2026:first", "9:inner", "30:inner"]],
    ["a spaced date too", "2026 年 9 月 30 日", ["2026:first", "9:inner", "30:inner"]],
    ["month and day", "10月1日から", ["10:first", "1:inner"]],
    ["a day anchored by a clock after it", "1日10時に", ["1:first", "10:inner"]],
    ["hour, minute and second", "15時30分10秒", ["15:first", "30:inner", "10:inner"]],
    ["a year of four digits", "2026年の計画と2026年度", ["2026:first", "2026:first"]],
    ["a year of fewer digits is a length", "3年で終わる", []],
    ["a day alone may be a length", "5日で終わる", []],
    ["minutes alone are a length", "5分で終わる", []],
    ["minutes and seconds with no hour are a length", "5分30秒", []],
    ["minutes after a length of hours are a length", "1時間30分", []],
    ["years before a length of months are a length", "3年5ヶ月", []],
    ["two months apart are two dates", "9月、8月", ["9:first", "8:first"]],
    ["a length of years after a year is not part of it", "2025年 3年ぶりに開く", ["2025:first"]],
    ["the same unit again starts another thing", "9月 3月", ["9:first", "3:first"]],
    ["a larger unit after a smaller one starts another thing", "10時 3日", ["10:first"]],
    ["no unit follows one outside the order", "3時半 5分待つ", ["3:first"]],
    ["a count", "412 件と6.2 時間", []],
  ];
  cases.forEach(([name, text, expected]) => {
    it(`${name}: ${text}`, () => assert.deepEqual(calendarOf(text), expected));
  });

  it("does not decide without parts of speech", () => {
    assert.deepEqual(calendarRuns("9月の問い合わせ", undefined, 0, UNITS), []);
  });

  it("reads no date with no units", () => {
    const none: CalendarUnits = { chained: [], positional: new Set(), year: new Set() };
    const [sentence] = buildDocument("a.md", "2026年9月30日\n", ja).sentences;
    assert.deepEqual(calendarRuns(sentence?.text ?? "", sentence?.tokens, sentence?.span.start ?? 0, none), []);
  });
});

describe("latin-spacing leaves dates out", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  const spacing = (source: string): string[] => latinSpacing(ja, source, "business/report");

  // isamu/lab#290 の報告に書き手が添えた文書。
  const REPORT = [
    "# 9月の問い合わせ対応についての報告",
    "",
    "## 背景",
    "",
    "近年、お客様からの問い合わせはますます多様化しており、私たちサポートチームとしてもその変化にしっかりと対応していくことが求められているという状況であると考えられます。",
    "",
    "## 9月の状況",
    "",
    "9月の問い合わせは 412 件で、8月の 356 件から増えました。**特に**、請求に関する問い合わせが **大きく** 増えており、その多くは新しい料金プランへの切り替えに伴って、請求書の見方が分からないというものであったため、対応に時間がかかる場面が多く見られました。",
    "",
    "一次回答までの時間は平均 6.2 時間で、目標の 4 時間を超えました。",
    "",
    "## 対応",
    "",
    "請求の問い合わせについて、よくある質問のページを更新することが検討されています。また、担当者の増員についても検討を進めることが必要であると考えられます。",
    "",
    "## まとめ",
    "",
    "以上のように、9月は問い合わせが増え、一次回答までの時間も目標を超えました。今後も引き続き改善に努めてまいります。",
    "",
  ].join("\n");

  it("does not count 9月 and 8月 against a report that spaces its counts", () => {
    assert.deepEqual(spacing(REPORT), []);
  });

  it("does not count a date for or against either habit", () => {
    assert.deepEqual(spacing("# 報告\n\n対応は 412 件、残りは 12 件で、開始は 2026年9月30日です。\n"), []);
    assert.deepEqual(spacing("# 報告\n\n対応は412件、残りは12件で、開始は2026 年 9 月です。\n"), []);
  });

  it("reads a clock time as a date and a length of hours as a count", () => {
    assert.deepEqual(spacing("# 報告\n\n作業は 3 時間、確認は 2 時間で、会議は 3時に始める。\n"), []);
    assert.deepEqual(spacing("# 報告\n\n作業は 3 時間、確認は 2 時間で、会議は 3時間続く。\n"), ["前の数字:詰めています"]);
  });

  it("reads a clock's minutes as a date and minutes alone as a count", () => {
    assert.deepEqual(spacing("# 報告\n\n対応は 412 件、残りは 12 件で、開始は 10時5分です。\n"), []);
    assert.deepEqual(spacing("# 報告\n\n対応は 412 件、残りは 12 件で、待ちは 5分です。\n"), ["前の数字:詰めています"]);
  });

  it("reads a month as a date and a length of months as a count", () => {
    assert.deepEqual(spacing("# 報告\n\n期間は 3 ヶ月、準備は 2 週間で、開始は 9月です。\n"), []);
    assert.deepEqual(spacing("# 報告\n\n期間は 3 ヶ月、準備は 2 週間で、延長は 9ヶ月です。\n"), ["前の数字:詰めています"]);
  });

  it("reads a day after its month as a date and a day alone as a count", () => {
    assert.deepEqual(spacing("# 報告\n\n準備は 3 週間、確認は 2 週間で、開始は 10月1日です。\n"), []);
    assert.deepEqual(spacing("# 報告\n\n準備は 3 週間、確認は 2 週間で、延長は 5日です。\n"), ["前の数字:詰めています"]);
  });

  it("reads a year of four digits as a date and a shorter one as a count", () => {
    assert.deepEqual(spacing("# 報告\n\n対応は 412 件、残りは 12 件で、開始は 2026年です。\n"), []);
    assert.deepEqual(spacing("# 報告\n\n対応は 412 件、残りは 12 件で、期間は 3年です。\n"), ["前の数字:詰めています"]);
  });

  it("still counts a length of years written after a year", () => {
    assert.deepEqual(spacing("# 報告\n\n対応は412件、残りは12件で、2025年 3年ぶりに開く。\n"), ["後ろの数字:空けています"]);
  });

  it("still counts the space before a date, which is the writer's habit before any number", () => {
    assert.deepEqual(spacing("# 報告\n\n対応は 412 件、残りは 12 件で、開始は9月です。\n"), ["後ろの数字:詰めています"]);
  });
});
