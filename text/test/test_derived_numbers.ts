import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { numberWordCounts } from "../packages/chaff/src/derived/number-word-counts.ts";

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
    assert.deepEqual(durationJa("期間は4月1日から3か月間（7月31日まで）です。"), ["7月31日→06-30"]);
    assert.deepEqual(durationJa("期間は4月1日から3か月間（6月30日まで）です。"), []);
    assert.deepEqual(durationJa("期間は4月1日から3か月間（7月1日まで）です。"), []);
    assert.deepEqual(durationJa("到達日の4月1日から2週間が経過した日（4月16日）以降となる。"), []);
    assert.deepEqual(durationJa("到達日の4月1日から2週間が経過した日（4月17日）以降となる。"), ["4月17日→04-14"]);
  });

  it("days and weeks, with years written (ja)", () => {
    assert.deepEqual(durationJa("2026年5月1日から10日間（2026年5月15日まで）。"), ["2026年5月15日→2026-05-10"]);
    assert.deepEqual(durationJa("2026年5月1日から10日間（2026年5月10日まで）。"), []);
    assert.deepEqual(durationJa("2026年5月1日から2週間（2026年5月14日まで）。"), []);
  });

  it("a start plus a length that does not reach the end (en)", () => {
    assert.deepEqual(durationEn("The trial runs for 3 months from April 1, 2026 (until July 31, 2026)."), ["July 31, 2026→2026-06-30"]);
    assert.deepEqual(durationEn("The trial runs for 3 months from April 1, 2026 (until June 30, 2026)."), []);
    assert.deepEqual(durationEn("The trial lasts 10 days, from May 1, 2026 to May 10, 2026."), []);
  });

  it("a length written in words with the figure in brackets (en)", () => {
    const source = "This Agreement starts on April 1, 2026 and continues for six (6) months, until March 31, 2027.";
    assert.deepEqual(durationEn(source), ["March 31, 2027→2026-09-30"]);
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

  it("the earlier of two dates with years is the start, whichever is written first", () => {
    assert.deepEqual(durationEn("The trial runs until July 1, 2026, for 3 months from April 1, 2026."), []);
    assert.deepEqual(durationEn("The trial runs until July 31, 2026, for 3 months from April 1, 2026."), ["July 31, 2026→2026-06-30"]);
  });

  it("a date with a year and one without are not paired", () => {
    assert.deepEqual(durationJa("2026年4月1日から3か月間（7月31日まで）です。"), []);
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
