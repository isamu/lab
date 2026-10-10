import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { weekdayOf, withNearestYear } from "../packages/chaff/src/structure/weekday.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 日付と、その横に書いた曜日の食い違い（date-weekday-mismatch）。曜日の読み方は言語パッケージ、暦との比較は core。

const found = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "date-weekday-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "date-weekday-mismatch")
    .map((finding) => `${String(finding.values["date"])}:${String(finding.values["written"])}:${String(finding.values["actual"])}`);

const weekdays = (adapter: LanguageAdapter, text: string): (number | string | undefined)[] =>
  (adapter.structure?.dates?.(text) ?? []).map((mention) => mention.attrs["weekday"]);

describe("weekdayOf", () => {
  const cases: readonly (readonly [string, number | undefined])[] = [
    ["2026-10-01", 4],
    ["2024-02-29", 4],
    ["2000-01-01", 6],
    ["2026-02-30", undefined],
    ["2025-02-29", undefined],
    ["2026-13-01", undefined],
    ["2026-10", undefined],
    ["10-01", undefined],
    ["", undefined],
  ];
  cases.forEach(([value, expected]) => {
    it(`${value || "(empty)"} → ${String(expected)}`, () => assert.equal(weekdayOf(value), expected));
  });
});

describe("日本語: 日付のすぐ後ろの曜日", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("（木）（木曜）（木曜日）と、括弧の無い木曜日を読む", () => {
    assert.deepEqual(weekdays(ja, "2026年10月1日（木）"), [4]);
    assert.deepEqual(weekdays(ja, "2026年10月1日(木曜)"), [4]);
    assert.deepEqual(weekdays(ja, "2026年10月1日（木曜日）"), [4]);
    assert.deepEqual(weekdays(ja, "2026年10月1日 木曜日"), [4]);
  });

  it("元号で書いた日付も西暦にして比べる。年だけの元号は数量のまま", () => {
    assert.deepEqual(
      (ja.structure?.dates?.("令和8年10月1日（木）") ?? []).map((mention) => [mention.attrs["value"], mention.attrs["weekday"]]),
      [["2026-10-01", 4]],
    );
    assert.deepEqual(found("# 旅程\n\n令和8年10月1日（金）に出発する。", ja, "ja"), ["2026年10月1日:金曜日:木曜日"]);
    assert.deepEqual(ja.structure?.dates?.("昭和二十二年法律第四十九号") ?? [], []);
    // 元年は数として読めないので、「元号 + 元年」を 1 年として足す。令和元年10月1日は火曜日。
    assert.deepEqual(found("# 旅程\n\n令和元年10月1日（水）に出発する。", ja, "ja"), ["2019年10月1日:水曜日:火曜日"]);
    assert.deepEqual(found("# 旅程\n\n令和元年10月1日（火）に出発する。", ja, "ja"), []);
  });

  it("曜日でないもの（木村さん、木の机）は読まない", () => {
    assert.deepEqual(weekdays(ja, "2026年10月1日、木村さんが来る"), [undefined]);
    assert.deepEqual(weekdays(ja, "2026年10月1日（木の机を運ぶ）"), [undefined]);
  });

  it("食い違いを言う。曜日の無い日付と、年を書いた日付が文書に無い年の無い日付は見ない", () => {
    assert.deepEqual(found("# 旅程\n\n2026年10月1日（金）に出発する。", ja, "ja"), ["2026年10月1日:金曜日:木曜日"]);
    assert.deepEqual(found("# 旅程\n\n10月1日（金）に出発する。", ja, "ja"), []);
    assert.deepEqual(found("# 旅程\n\n2026年10月1日に出発する。", ja, "ja"), []);
  });

  it("年の無い日付は、年を書いた日付（前にあればそれ、無ければ後ろ）から 5 か月以内の年として比べる", () => {
    const mail = (body: string): string => `件名: 打ち合わせ\n日付: 2026年10月6日\n\n${body}\n`;
    assert.deepEqual(found(mail("10月9日（木）までにご確認ください。"), ja, "ja"), ["2026年10月9日:木曜日:金曜日"]);
    assert.deepEqual(found(mail("10月9日（金）までにご確認ください。"), ja, "ja"), []);
    // 12月の文書の1月は翌年。2027年1月5日は火曜日。
    assert.deepEqual(found("# 予定\n\n2026年12月20日に決めた。次は1月5日（火）に集まる。", ja, "ja"), []);
    assert.deepEqual(found("# 予定\n\n2026年12月20日に決めた。次は1月5日（月）に集まる。", ja, "ja"), ["2027年1月5日:月曜日:火曜日"]);
    // 前に年を書いた日付が無ければ、後ろの最初のもの。
    assert.deepEqual(found("# 旅程\n\n10月1日（金）に出発する。2026年10月1日に着く。", ja, "ja"), ["2026年10月1日:金曜日:木曜日"]);
    // 半年離れた日付は、どちらの年とも読めるので見ない。
    assert.deepEqual(found(mail("4月5日（火）に始めた。"), ja, "ja"), []);
  });

  it("年は同じ節の日付、無ければ文書の日付、無ければ書き出しの日付から決める。別の節の日付からは決めない", () => {
    // 年度ごとの節: 2023年1月24日は火曜日。
    const fiscal = (weekday: string): string =>
      `# 催し\n\n## 今後の予定\n\n2026年11月19日（木）に開く。\n\n## 令和4年度\n\n講習会（2022年11月24日）。1月24日（${weekday}）に講義。\n`;
    assert.deepEqual(found(fiscal("火"), ja, "ja"), []);
    assert.deepEqual(found(fiscal("水"), ja, "ja"), ["2023年1月24日:水曜日:火曜日"]);
    assert.deepEqual(found("# 催し\n\n## 今後の予定\n\n2026年11月19日（木）に開く。\n\n## 令和4年度\n\n1月24日（水）に講義。\n", ja, "ja"), []);
    // 文書の日付は、ほかの節の翌年の日付より先に使う。2026年8月30日は日曜日。
    const notice = (weekday: string): string =>
      `# 採用試験の案内\n\n更新日：2026年07月27日\n\n## 採用予定日\n\n2027年4月1日\n\n## 試験日\n\n8月30日(${weekday}曜日)\n`;
    assert.deepEqual(found(notice("日"), ja, "ja"), []);
    assert.deepEqual(found(notice("月"), ja, "ja"), ["2026年8月30日:月曜日:日曜日"]);
    // 見出しが年を名指す節は、節の中に年を書いた日付が無ければ見ない。2024年10月9日は水曜日。
    assert.deepEqual(found("更新日：2026年10月6日\n\n# 2024年度 学校行事\n\n10月9日（水） 運動会\n", ja, "ja"), []);
    assert.deepEqual(found("更新日：2026年10月6日\n\n# 令和6年度 学校行事\n\n10月9日（水） 運動会\n", ja, "ja"), []);
    // あり得ない日付（2月30日）は年を決めない。文書の日付で読む。
    assert.deepEqual(found("更新日：2026年10月6日\n\n# 提出\n\n下書きの誤り：2026年2月30日\n\n10月9日（木）までに提出してください。\n", ja, "ja"), [
      "2026年10月9日:木曜日:金曜日",
    ]);
    // 議事録の頭の日時は、後ろの節の日付の年を決める。2026年11月30日は月曜日。
    const minutes = "# 定例会 議事録\n\n- 日時: 2026年10月5日（月）10時\n\n## 決定事項\n\n公開日は11月30日（火）とする。\n";
    assert.deepEqual(found(minutes, ja, "ja"), ["2026年11月30日:火曜日:月曜日"]);
  });

  it("旅程の見本: 2 日目の曜日だけが違う", () => {
    const source = readFileSync(new URL("fixtures/dates/itinerary-ja.md", import.meta.url), "utf8");
    assert.deepEqual(found(source, ja, "ja"), ["2026年10月2日:土曜日:金曜日"]);
  });
});

describe("withNearestYear", () => {
  const cases: readonly (readonly [string, string, string | undefined])[] = [
    ["10-09", "2026-10-06", "2026-10-09"],
    ["01-05", "2026-12-20", "2027-01-05"],
    ["12-20", "2027-01-05", "2026-12-20"],
    ["03-01", "2026-10-06", "2027-03-01"],
    ["04-05", "2026-10-06", undefined],
    ["02-29", "2028-01-10", "2028-02-29"],
    ["02-29", "2026-12-01", undefined],
    ["13-01", "2026-10-06", undefined],
    ["10-09", "10-06", undefined],
    ["10-09", "2026-02-30", undefined],
    ["2026-10-09", "2026-10-06", undefined],
    ["", "2026-10-06", undefined],
  ];
  cases.forEach(([monthDay, anchor, expected]) => {
    it(`${monthDay || "(empty)"} near ${anchor} → ${String(expected)}`, () => assert.equal(withNearestYear(monthDay, anchor), expected));
  });
});

describe("English: the weekday beside a date", () => {
  it("before the date, or after it in parentheses; full names and short forms", () => {
    assert.deepEqual(weekdays(en, "Thursday, 1 October 2026"), [4]);
    assert.deepEqual(weekdays(en, "Thu 1 October 2026"), [4]);
    assert.deepEqual(weekdays(en, "1 October 2026 (Thursday)"), [4]);
    assert.deepEqual(weekdays(en, "Thursday, October 1, 2026"), [4]);
  });

  it("not a weekday: a verb, a day word far away, a possessive, the next sentence, a range", () => {
    assert.deepEqual(weekdays(en, "We met on Monday. On 1 October 2026 we left."), [undefined]);
    assert.deepEqual(weekdays(en, "On 2 October 2026, Sat down with the team."), [undefined]);
    assert.deepEqual(weekdays(en, "The fair runs 1-3 October 2026 (Thursday)."), [undefined]);
    assert.deepEqual(weekdays(en, "The fair runs 1 to 3 October 2026 (Thursday)."), [undefined]);
    assert.deepEqual(weekdays(en, "Held on 1st and 3 October 2026 (Thursday)."), [undefined]);
    assert.deepEqual(weekdays(en, "Held 2 October 2026, Tuesday's notes attached."), [undefined]);
    assert.deepEqual(weekdays(en, "May 2026 was busy."), [undefined]);
  });

  it("two full dates joined by a word each keep their own weekday", () => {
    assert.deepEqual(weekdays(en, "We meet 1 October 2026 and 3 October 2026 (Saturday)."), [undefined, 6]);
    assert.deepEqual(weekdays(en, "From 1 October 2026 to 3 October 2026 (Saturday)."), [undefined, 6]);
  });

  it("says which day it really is; a date without its year is not checked when no date gives one", () => {
    assert.deepEqual(found("# Trip\n\nWe leave on Friday, 1 October 2026.", en, "en"), ["1 October 2026:Friday:Thursday"]);
    assert.deepEqual(found("# Trip\n\nWe leave on Friday, 1 October.", en, "en"), []);
  });

  it("a date without its year takes the year of the dated date near it", () => {
    const mail = (body: string): string => `Subject: Meeting\nDate: Tuesday, October 6, 2026\n\n${body}\n`;
    assert.deepEqual(found(mail("Please reply by Thursday, October 9."), en, "en"), ["October 9, 2026:Thursday:Friday"]);
    assert.deepEqual(found(mail("Please reply by Friday, October 9."), en, "en"), []);
    assert.deepEqual(found(mail("We started on Tuesday, April 5."), en, "en"), []);
    // A date quoted alone is an example, and does not give the year.
    assert.deepEqual(
      found('# Manual examples\n\n"Thursday, October 1, 2026" is the example format.\n\nThe page may show Thursday, October 2.\n', en, "en"),
      [],
    );
    assert.deepEqual(found("# 2024 events\n\nThe fair was on Wednesday, October 9.\n", en, "en"), []);
  });

  it("a date quoted alone with its weekday is an example of the mistake, not a date of the document (#621)", () => {
    assert.deepEqual(found('# Mistakes\n\n| A weekday that is wrong | "Monday, December 5, 2026" falls on a Saturday |\n', en, "en"), []);
    assert.deepEqual(found("# 誤り\n\n「2026年12月5日（月）」は土曜日です。\n", ja, "ja"), []);
    assert.deepEqual(found('# Trip\n\n"We leave on Friday, 1 October 2026," she said.\n', en, "en"), ["1 October 2026:Friday:Thursday"]);
    assert.deepEqual(found("# Trip\n\nWe leave on Friday, 1 October 2026.", en, "en"), ["1 October 2026:Friday:Thursday"]);
  });

  it("the sample itinerary: only the second day is wrong", () => {
    const source = readFileSync(new URL("fixtures/dates/itinerary-en.md", import.meta.url), "utf8");
    assert.deepEqual(found(source, en, "en"), ["2 October 2026:Saturday:Friday"]);
  });
});
