import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { numberWordCounts } from "../packages/chaff/src/derived/number-word-counts.ts";
import { isRangeLength, type RangeText } from "../packages/chaff/src/derived/durations.ts";

// 始まり + 期間 ≠ 終わり（duration-mismatch）と、起点の年から数えた年数（elapsed-years-mismatch）。

const RULES = { "duration-mismatch": "normal", "elapsed-years-mismatch": "normal" } as const;

const run = (rule: string, source: string, adapter: LanguageAdapter, language: string): Record<string, unknown>[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === rule)
    .map((finding) => finding.values);

const durationJa = (text: string): string[] =>
  run("duration-mismatch", `# 案内\n\n${text}\n`, ja, "ja").map((values) => `${String(values["end"])}→${String(values["expected"])}`);
const durationEn = (text: string): string[] =>
  run("duration-mismatch", `# Notice\n\n${text}\n`, en, "en").map((values) => `${String(values["end"])}→${String(values["expected"])}`);

const elapsedJa = (...lines: string[]): string[] =>
  run("elapsed-years-mismatch", ["# 会社案内", "", "2026年4月1日", "", ...lines].join("\n"), ja, "ja").map(
    (values) => `${String(values["written"])}/${String(values["expected"])}`,
  );
const elapsedEn = (...lines: string[]): string[] =>
  run("elapsed-years-mismatch", ["# About", "", "April 1, 2026", "", ...lines].join("\n"), en, "en").map(
    (values) => `${String(values["written"])}/${String(values["expected"])}`,
  );

describe("duration-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("a start plus months that does not reach the end (ja)", () => {
    assert.deepEqual(durationJa("期間は4月1日から3か月間（7月31日まで）です。"), ["7月31日→6月30日"]);
    assert.deepEqual(durationJa("期間は4月1日から3か月間（6月30日まで）です。"), []);
    assert.deepEqual(durationJa("期間は4月1日から3か月間（7月1日まで）です。"), []);
    assert.deepEqual(durationJa("到達日の4月1日から2週間が経過した日（4月16日）以降となる。"), []);
    assert.deepEqual(durationJa("到達日の4月1日から2週間が経過した日（4月17日）以降となる。"), ["4月17日→4月14日"]);
  });

  it("days and weeks, with years written (ja)", () => {
    assert.deepEqual(durationJa("2026年5月1日から10日間（2026年5月15日まで）。"), ["2026年5月15日→2026年5月10日"]);
    assert.deepEqual(durationJa("2026年5月1日から10日間（2026年5月10日まで）。"), []);
    assert.deepEqual(durationJa("2026年5月1日から2週間（2026年5月14日まで）。"), []);
  });

  it("a start plus a length that does not reach the end (en)", () => {
    assert.deepEqual(durationEn("The trial runs for 3 months from April 1, 2026 (until July 31, 2026)."), ["July 31, 2026→June 30, 2026"]);
    assert.deepEqual(durationEn("The trial runs for 3 months from April 1, 2026 (until June 30, 2026)."), []);
    assert.deepEqual(durationEn("The trial lasts 10 days, from May 1, 2026 to May 10, 2026."), []);
  });

  it("the computed end is written day first in a document that writes its dates day first (en)", () => {
    assert.deepEqual(durationEn("The trial runs for 3 months from 1 April 2026 (until 31 July 2026)."), ["31 July 2026→30 June 2026"]);
  });

  it("a length written in words with the figure in brackets (en)", () => {
    const source = "This Agreement starts on April 1, 2026 and continues for six (6) months, until March 31, 2027.";
    assert.deepEqual(durationEn(source), ["March 31, 2027→September 30, 2026"]);
    assert.deepEqual(
      run("duration-mismatch", `# Notice\n\n${source}\n`, en, "en").map((values) => values["duration"]),
      ["six (6) months"],
    );
    assert.deepEqual(durationEn("This Agreement starts on April 1, 2026 and continues for twelve (12) months, until March 31, 2027."), []);
    assert.deepEqual(durationEn("This Agreement starts on April 1, 2026 and continues for thirty (30) days, until April 30, 2026."), []);
    assert.deepEqual(durationEn("Section (6) months starts on April 1, 2026 and ends on March 31, 2027."), []);
  });

  it("the end of a month: one month after January 31 is the last day of February", () => {
    assert.deepEqual(durationEn("It runs for 1 month from January 31, 2026 to February 28, 2026."), []);
  });

  it("a rough length, or a sentence with more dates or lengths, is not judged", () => {
    assert.deepEqual(durationJa("期間は4月1日から約3か月（7月31日まで）です。"), []);
    assert.deepEqual(durationEn("It runs for about 3 months from April 1, 2026 (until July 31, 2026)."), []);
    assert.deepEqual(durationJa("4月1日から3か月間、6月1日から7月31日までは休みです。"), []);
    assert.deepEqual(durationJa("4月1日から3か月間と2週間（7月31日まで）。"), []);
  });

  it("three dates in a sentence: the date marked as the start and the date marked as the end are read", () => {
    const ja13 = "お買い上げ日が2026年7月1日の場合、保証期間は2026年7月1日から12か月（2027年7月31日まで）です。";
    assert.deepEqual(durationJa(ja13), ["2027年7月31日→2027年6月30日"]);
    assert.deepEqual(durationJa("お買い上げ日が2026年7月1日の場合、保証期間は2026年7月1日から12か月（2027年6月30日まで）です。"), []);
    assert.deepEqual(durationJa("購入日が2026年7月1日の場合、2026年7月1日からの12か月（2027年7月31日まで）が保証期間です。"), ["2027年7月31日→2027年6月30日"]);
    assert.deepEqual(durationJa("ご購入日が2026年7月1日なら、保証期間は2026年7月1日から12か月（2027年8月31日）です。"), ["2027年8月31日→2027年6月30日"]);
    const en13 = "If you bought the product on July 1, 2026, the warranty runs for 12 months from July 1, 2026 (until July 31, 2027).";
    assert.deepEqual(durationEn(en13), ["July 31, 2027→June 30, 2027"]);
    assert.deepEqual(durationEn("If you bought the product on July 1, 2026, your warranty runs from July 1, 2026 for 12 months (until June 30, 2027)."), []);
    assert.deepEqual(durationEn("Bought on July 1, 2026, it is covered for 12 months from Wednesday, July 1, 2026 to June 30, 2027."), []);
  });

  it("three dates without one marked start and one marked end are not judged", () => {
    assert.deepEqual(durationJa("2026年7月1日に購入し、保証期間は12か月、2026年8月1日に登録し、2027年9月30日に満了します。"), []);
    assert.deepEqual(durationJa("2026年4月1日から3か月間、2026年6月1日から2026年9月30日までは休みです。"), []);
    assert.deepEqual(durationEn("Bought on July 1, 2026 and registered on August 1, 2026, it is covered for 12 months until September 30, 2027."), []);
    assert.deepEqual(durationEn("It runs for 3 months from April 1, 2026 to May 1, 2026 and from June 1, 2026 to July 31, 2026."), []);
    assert.deepEqual(durationEn("After the January 5, 2026 notice, the 3-month trial was moved from April 1, 2026 to May 1, 2026."), []);
    assert.deepEqual(durationEn("Bought on July 1, 2026, it is covered from July 1, 2026 for 12 months (August 15, 2026 recall excluded)."), []);
    assert.deepEqual(durationEn("Bought on July 1, 2026, it is covered for 12 months from July 1, 2026 until June 30, 2026."), []);
  });

  it("the earlier of two dates with years is the start, whichever is written first", () => {
    assert.deepEqual(durationEn("The trial runs until July 1, 2026, for 3 months from April 1, 2026."), []);
    assert.deepEqual(durationEn("The trial runs until July 31, 2026, for 3 months from April 1, 2026."), ["July 31, 2026→June 30, 2026"]);
  });

  it("a date with a year and one without are not paired", () => {
    assert.deepEqual(durationJa("2026年4月1日から3か月間（7月31日まで）です。"), []);
  });

  it("a length written before its noun (a 3-month trial)", () => {
    assert.deepEqual(durationEn("The 3-month trial starts April 1, 2026 and ends June 15, 2026."), ["June 15, 2026→June 30, 2026"]);
    assert.deepEqual(durationEn("The 3-month trial starts April 1, 2026 and ends June 30, 2026."), []);
    assert.deepEqual(durationEn("A 10-day course runs from May 1, 2026 to May 15, 2026."), ["May 15, 2026→May 10, 2026"]);
    assert.deepEqual(durationEn("A 2-week course runs from May 1, 2026 to May 14, 2026."), []);
    assert.deepEqual(durationJa("2026年4月1日から3ヶ月間の試行は2026年6月15日に終わる。"), ["2026年6月15日→2026年6月30日"]);
  });

  it("a length before its noun beside dates far more than twice as far apart is another length", () => {
    assert.deepEqual(durationEn("Our 7-day returns window applies to orders placed April 1, 2026 through June 15, 2026."), []);
    assert.deepEqual(durationEn("The 30-day guarantee covers purchases from January 1, 2026 to December 31, 2026."), []);
    assert.deepEqual(durationEn("Our 24-hour support desk opens April 1, 2026 and closes June 15, 2026."), []);
    assert.deepEqual(durationEn("The 3-month-old program started April 1, 2026 and ends June 15, 2026."), []);
  });

  it("a length in brackets right after a range counts the range, never the day after it elapses", () => {
    assert.deepEqual(durationEn("Billing period: July 1, 2026 – August 31, 2026 (60 days)"), ["August 31, 2026→August 29, 2026"]);
    assert.deepEqual(durationEn("Billing period: July 1, 2026 – August 31, 2026 (62 days)"), []);
    assert.deepEqual(durationEn("Rental: July 1, 2026 – July 4, 2026 (3 days)"), []);
    assert.deepEqual(durationJa("検針期間：9月1日〜10月31日（59日間）"), ["10月31日→10月29日"]);
    assert.deepEqual(durationJa("検針期間：2026年9月1日（火）〜2026年10月31日（土）（59日間）"), ["2026年10月31日→2026年10月29日"]);
    assert.deepEqual(durationEn("Billing period: July 1, 2026 – September 2, 2026 (Wednesday) (62 days)."), ["September 2, 2026→August 31, 2026"]);
    assert.deepEqual(durationJa("検針期間：2026年9月1日〜2026年10月31日（61日間）"), []);
    assert.deepEqual(durationJa("検針期間：2026年9月1日〜2026年10月31日（60日間）"), []);
  });

  it("a length outside brackets, or after two dates that are not a range, still takes the day after it elapses", () => {
    assert.deepEqual(durationJa("到達日の4月1日から2週間が経過した日（4月16日）以降となる。"), []);
    assert.deepEqual(durationEn("The notice of July 1, 2026 takes effect 60 days later, on August 31, 2026."), []);
    assert.deepEqual(durationEn("The notice of July 1, 2026 takes effect on September 2, 2026 (62 days)."), []);
  });

  it("a rough mark before the article of a length before its noun", () => {
    assert.deepEqual(durationEn("It is about a 3-day course from May 1, 2026 to May 6, 2026."), []);
    assert.deepEqual(durationEn("It is a 3-day course from May 1, 2026 to May 6, 2026."), ["May 6, 2026→May 3, 2026"]);
  });
});

const stayFindings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), RULES, false, "business/report")
    .findings.filter((finding) => finding.rule === "duration-mismatch")
    .map((finding) => {
      const { values } = finding;
      const written = finding.variant === "nights-days" ? values["days"] : values["nights"];
      return `${String(finding.variant)}:${String(written)}→${String(values["expected"])}`;
    });
const stayJa = (...lines: string[]): string[] => stayFindings(["# 旅程", "", ...lines, ""].join("\n"), ja, "ja");
const stayEn = (...lines: string[]): string[] => stayFindings(["# Itinerary", "", ...lines, ""].join("\n"), en, "en");

describe("isRangeLength: a length written in brackets right after a range", () => {
  const words = { joiners: ["〜", "–", "to", "から"], weekdays: ["Wednesday", "火曜日", "水曜日"] };
  const textOf = (source: string): RangeText => ({ source, ...words });
  const spanOf = (source: string, part: string, from = 0): { start: number; end: number } => {
    const start = source.indexOf(part, from);
    return { start, end: start + part.length };
  };
  const check = (source: string, first: string, end: string, length: string): boolean => {
    const firstSpan = spanOf(source, first);
    const endSpan = spanOf(source, end, firstSpan.end);
    return isRangeLength(textOf(source), [firstSpan, endSpan], spanOf(source, length, endSpan.end));
  };

  it("two dates joined by a range word, the length alone in the bracket right after", () => {
    assert.equal(check("July 1 – August 31 (62 days)", "July 1", "August 31", "62 days"), true);
    assert.equal(check("from July 1 TO August 31 ( 62 days )", "July 1", "August 31", "62 days"), true);
    assert.equal(check("9月1日〜9月30日（30日間）", "9月1日", "9月30日", "30日間"), true);
    assert.equal(check("9月1日（火）〜9月30日（水）（30日間）", "9月1日", "9月30日", "30日間"), true);
    assert.equal(check("July 1 (Wed) – August 31 (Wednesday) (62 days)", "July 1", "August 31", "62 days"), true);
  });

  it("no range word, no bracket, more in the bracket, or another bracket between", () => {
    assert.equal(check("July 1, effective August 31 (62 days)", "July 1", "August 31", "62 days"), false);
    assert.equal(check("July 1 and August 31 (62 days)", "July 1", "August 31", "62 days"), false);
    assert.equal(check("July 1 – August 31, 62 days", "July 1", "August 31", "62 days"), false);
    assert.equal(check("July 1 – August 31 (total 62 days)", "July 1", "August 31", "62 days"), false);
    assert.equal(check("July 1 – August 31 (62 days of service)", "July 1", "August 31", "62 days"), false);
    assert.equal(check("July 1 – August 31 (the second period) (62 days)", "July 1", "August 31", "62 days"), false);
    assert.equal(check("July 1 – August 31 () (62 days)", "July 1", "August 31", "62 days"), false);
  });

  it("spans out of order are not a range", () => {
    const outOfOrder = (source: string, first: number, end: number, length: number): boolean =>
      isRangeLength(
        textOf(source),
        [
          { start: first, end: first + 1 },
          { start: end, end: end + 1 },
        ],
        { start: length, end: length + 1 },
      );
    assert.equal(outOfOrder("(62 days) July 1 – August 31", 10, 19, 1), false);
    assert.equal(outOfOrder("", 5, 0, 7), false);
  });
});

describe("duration-mismatch: nights of a stay", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("nights against the days between two dates in a sentence (ja)", () => {
    assert.deepEqual(stayJa("10月12日（月）〜10月14日（水）　3泊"), ["nights:3泊→2"]);
    assert.deepEqual(stayJa("10月12日（月）〜10月14日（水）　2泊"), []);
    assert.deepEqual(stayJa("ホテルに2027年2月8日（月）から2027年2月11日（木）まで4泊します。"), ["nights:4泊→3"]);
    assert.deepEqual(stayJa("ホテルに2027年2月8日（月）から2027年2月11日（木）まで3泊します。"), []);
  });

  it("nights against the days between two dates in a sentence (en)", () => {
    assert.deepEqual(stayEn("Check-in Oct 12, check-out Oct 14 (3 nights)."), ["nights:3 nights→2"]);
    assert.deepEqual(stayEn("Check-in Oct 12, check-out Oct 14 (2 nights)."), []);
    assert.deepEqual(stayEn("I will stay four nights from February 8, 2027 to February 11, 2027."), ["nights:four nights→3"]);
    assert.deepEqual(stayEn("I will stay three nights from February 8, 2027 to February 11, 2027."), []);
  });

  it("a stay over the new year, written without years", () => {
    assert.deepEqual(stayJa("12月30日〜1月2日　3泊"), []);
    assert.deepEqual(stayEn("Check-in Dec 30, check-out Jan 2 (4 nights)."), ["nights:4 nights→3"]);
  });

  it("two dates without years written check-out first are the nearer way round", () => {
    assert.deepEqual(stayEn("Check-out Oct 14; check-in Oct 12; 2 nights."), []);
    assert.deepEqual(stayEn("Check-out Oct 14; check-in Oct 12; 3 nights."), ["nights:3 nights→2"]);
  });

  it("nights inside a link address or code are not read", () => {
    assert.deepEqual(stayEn("Book [the offer](https://x.example/stay/3nights?in=2026-10-12&out=2026-10-14) for Oct 12 to Oct 14."), []);
    assert.deepEqual(stayEn("Set `stay=3 nights` for Oct 12 to Oct 14."), []);
  });

  it("nights plus one is the days (N泊M日, N nights M days)", () => {
    assert.deepEqual(stayJa("京都・奈良 1泊2日の旅行です。"), []);
    assert.deepEqual(stayJa("京都・奈良 2泊2日の旅行です。"), ["nights-days:2日→3"]);
    assert.deepEqual(stayEn("A trip of 2 days, 1 night to York."), []);
    assert.deepEqual(stayEn("A trip of 3 days and 1 night to York."), ["nights-days:3 days→2"]);
  });

  it("nights and days written before their noun (a 2-night, 4-day tour)", () => {
    assert.deepEqual(stayEn("We run a 2-night, 4-day tour."), ["nights-days:4-day→3"]);
    assert.deepEqual(stayEn("We run a 2-night, 3-day tour."), []);
    assert.deepEqual(stayEn("Join our 3-day/2-night tour."), []);
    assert.deepEqual(stayEn("We stay 3-night from Oct 12 to Oct 14."), ["nights:3-night→2"]);
    assert.deepEqual(stayJa("2泊4日の旅行です。"), ["nights-days:4日→3"]);
  });

  it("nights before their noun beside a much longer span are the length of an offer", () => {
    assert.deepEqual(stayEn("Our 2-night spa package is available October 1, 2026 to December 20, 2026."), []);
    assert.deepEqual(stayEn("Our 2-night spa package runs October 1, 2026 to October 4, 2026."), ["nights:2-night→3"]);
    assert.deepEqual(stayEn("Guests may book up to a 3-night stay between Oct 1 and Oct 6."), []);
    assert.deepEqual(stayEn("Guests may book a 3-night stay between Oct 1 and Oct 6."), ["nights:3-night→5"]);
  });

  it("N泊M日 beside two dates is judged by its nights, once", () => {
    assert.deepEqual(stayJa("10月12日〜10月14日、2泊3日の旅行です。"), []);
    assert.deepEqual(stayJa("10月12日〜10月20日、2泊3日の旅行です。"), ["nights:2泊→8"]);
  });

  it("a table with check-in, check-out and nights columns (ja)", () => {
    const table = (nights: string): string[] =>
      stayJa(
        "| ホテル | チェックイン | チェックアウト | 泊数 |",
        "| --- | --- | --- | --- |",
        `| 駅前ホテル | 2026年11月10日（火） | 2026年11月12日（木） | ${nights} |`,
      );
    assert.deepEqual(table("3泊"), ["nights:3泊→2"]);
    assert.deepEqual(table("2泊"), []);
    assert.deepEqual(table("2"), []);
  });

  it("a table with check-in, check-out and nights columns (en)", () => {
    const table = (nights: string): string[] =>
      stayEn("| Hotel | Check-in | Check-out | Nights |", "| --- | --- | --- | --- |", `| Garden Hotel | November 10, 2026 | November 12, 2026 | ${nights} |`);
    assert.deepEqual(table("3"), ["nights:3→2"]);
    assert.deepEqual(table("2"), []);
    assert.deepEqual(table("2 nights"), []);
    assert.deepEqual(table("see note"), []);
  });

  it("a table without all three columns is not read", () => {
    assert.deepEqual(stayEn("| Flight | Depart | Arrive |", "| --- | --- | --- |", "| AA 100 | Oct 12 | Oct 14 |"), []);
    assert.deepEqual(stayEn("| Hotel | Check-in | Nights |", "| --- | --- | --- |", "| Garden Hotel | Oct 12 | 3 |"), []);
  });

  it("nights with no dates, a rough number of nights, or more dates are not judged", () => {
    assert.deepEqual(stayJa("宿泊費（3泊）は33,000円です。"), []);
    assert.deepEqual(stayEn("The hotel (3 nights) costs $630."), []);
    assert.deepEqual(stayJa("10月1日から10月31日までの間、最大3泊できます。"), []);
    assert.deepEqual(stayEn("Between Oct 1 and Oct 31, you may stay up to 3 nights."), []);
    assert.deepEqual(stayJa("10月12日〜10月14日に2泊、10月14日〜10月16日に3泊します。"), []);
  });
});

describe("elapsed-years-mismatch", () => {
  it("a founding year and the years since founding (ja)", () => {
    assert.deepEqual(elapsedJa("当社は2015年に創業し、今年で創業5年を迎えます。"), ["5年/11"]);
    assert.deepEqual(elapsedJa("当社は2015年に創業し、今年で創業11年を迎えます。"), []);
    assert.deepEqual(elapsedJa("当社は2015年に創業し、今年で創業10年を迎えます。"), []);
  });

  it("the founding year from another sentence, when the document gives one", () => {
    assert.deepEqual(elapsedJa("2015年設立。", "", "設立から20年になります。"), ["20年/11"]);
    assert.deepEqual(elapsedJa("2015年設立。", "", "2018年設立の子会社があります。", "", "設立から20年になります。"), []);
  });

  it("a count not attached to the origin word is not a count since founding", () => {
    assert.deepEqual(elapsedJa("2015年に創業し、創業後3年で上場しました。"), []);
  });

  it("an age against a year of birth in the same sentence", () => {
    assert.deepEqual(elapsedJa("山田（1980年生まれ、30歳）が担当します。"), ["30歳/46"]);
    assert.deepEqual(elapsedJa("山田（1980年生まれ、45歳）が担当します。"), []);
    assert.deepEqual(elapsedJa("山田（1980年生まれ、30歳）と佐藤（46歳）が担当します。"), []);
    assert.deepEqual(elapsedEn("Jane Doe (born in 1980, aged 30) leads the team."), ["30/46"]);
    assert.deepEqual(elapsedEn("Jane Doe (born in 1980, aged 46) leads the team."), []);
    assert.deepEqual(elapsedEn("Jane Doe, born in 1980, is 30 years old."), ["30 years/46"]);
  });

  it("an age written as aged N years is one age", () => {
    assert.deepEqual(elapsedEn("Jane Doe (born in 1980, aged 30 years) leads the team."), ["30 years/46"]);
  });

  it("a number far from the origin word is not its year", () => {
    assert.deepEqual(elapsedEn("After its founding, Acme shipped the Model 2015 radio.", "", "We mark 20 years since its founding."), []);
  });

  it("years since founding (en)", () => {
    assert.deepEqual(elapsedEn("Acme was founded in 2015.", "", "We mark 20 years since its founding."), ["20 years/11"]);
    assert.deepEqual(elapsedEn("Acme was founded in 2015.", "", "We mark 11 years since its founding."), []);
  });

  it("a count of years written as a word", () => {
    assert.deepEqual(elapsedEn("Acme was founded in 2010.", "", "Twelve years since its founding, we have 25 people."), ["Twelve years/16"]);
    assert.deepEqual(elapsedEn("In the twelve years since our founding in 2016, the team has grown."), ["twelve years/10"]);
    assert.deepEqual(elapsedEn("In the ten years since our founding in 2016, the team has grown."), []);
  });

  it("a number word that is an age, or not attached to the origin word, is not a count since founding", () => {
    assert.deepEqual(elapsedEn("Jane Doe, born in 1980, is ten years old."), []);
    assert.deepEqual(elapsedEn("Acme was founded in 2014.", "", "Ten years old machines are still in use since its founding."), []);
    assert.deepEqual(elapsedEn("Acme was founded in 2014.", "", "For ten years we waited."), []);
    assert.deepEqual(elapsedEn("Acme was founded in 2005.", "", "We mark twenty-one years since its founding."), []);
  });

  it("a document with no date of its own is not checked", () => {
    const source = ["# 会社案内", "", "当社は2015年に創業し、今年で創業5年を迎えます。"].join("\n");
    assert.deepEqual(run("elapsed-years-mismatch", source, ja, "ja"), []);
  });

  it("the document's own date is not the founding year", () => {
    assert.deepEqual(elapsedJa("2026年4月1日現在、創業5年です。"), []);
  });
});

describe("numberWordCounts: a count written as a word before its unit", () => {
  const WORDS = ["one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
  const UNITS = ["year", "years"];
  const counts = (source: string, words: readonly string[] = WORDS, units: readonly string[] = UNITS): string[] =>
    numberWordCounts(source, words, units).map((count) => `${source.slice(count.start, count.end)}=${String(count.amount)}`);

  it("reads the word's position as its number, in any case", () => {
    assert.deepEqual(counts("Twelve years on, one year later, ELEVEN YEARS"), ["Twelve years=12", "one year=1", "ELEVEN YEARS=11"]);
  });

  it("needs the word to stand alone and the unit right after it", () => {
    assert.deepEqual(counts("fortyten years, tenyears, ten yearsago, ten long years, ten"), []);
    assert.deepEqual(counts("二十年と十年", ["十"], ["年"]), []);
    assert.deepEqual(counts("twenty-one years, thirty–two years"), []);
  });

  it("reads nothing without number words or units", () => {
    assert.deepEqual(counts("ten years", [], UNITS), []);
    assert.deepEqual(counts("ten years", WORDS, []), []);
    assert.deepEqual(counts(""), []);
  });
});
