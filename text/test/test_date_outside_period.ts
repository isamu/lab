import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import { insidePeriod, mentions } from "../packages/chaff/src/structure/date-outside-period.ts";
import { afterLabel, statedPeriod, type PeriodWords } from "../packages/chaff/src/structure/stated-period.ts";

// 書いた期間の外の日付（date-outside-period）。期間の語で始まる一行が期間を書き、その後ろの日程の日付を比べる。

const findings = (source: string, adapter: LanguageAdapter, language: string) =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "date-outside-period": "normal" }, false, "business/proposal").findings.filter(
    (finding) => finding.rule === "date-outside-period",
  );

const foundJa = (source: string): string[] => findings(source, ja, "ja").map((finding) => String(finding.values["date"]));
const foundEn = (source: string): string[] => findings(source, en, "en").map((finding) => String(finding.values["date"]));

const lines = (...rows: string[]): string => rows.join("\n");

describe("date-outside-period: whether a date is inside the period", () => {
  it("dates with years compare as whole dates, ends included", () => {
    const period = { start: "2026-10-12", end: "2026-10-15" };
    assert.equal(insidePeriod("2026-10-12", period), true);
    assert.equal(insidePeriod("2026-10-15", period), true);
    assert.equal(insidePeriod("2026-10-16", period), false);
    assert.equal(insidePeriod("2026-10-11", period), false);
    assert.equal(insidePeriod("2025-10-13", period), false);
  });

  it("a date or a period without a year compares by month and day", () => {
    assert.equal(insidePeriod("10-13", { start: "2026-10-12", end: "2026-10-15" }), true);
    assert.equal(insidePeriod("2027-10-13", { start: "10-12", end: "10-15" }), true);
    assert.equal(insidePeriod("10-17", { start: "10-12", end: "10-15" }), false);
  });

  it("a period whose end comes before its start in the calendar runs into the new year", () => {
    const period = { start: "12-28", end: "01-04" };
    assert.equal(insidePeriod("12-31", period), true);
    assert.equal(insidePeriod("01-02", period), true);
    assert.equal(insidePeriod("01-05", period), false);
    assert.equal(insidePeriod("12-27", period), false);
    assert.equal(insidePeriod("01-02", { start: "2026-12-28", end: "2027-01-04" }), true);
  });
});

const WORDS: PeriodWords = { labels: ["旅行期間", "Trip dates"], connectors: ["〜", "–", "to"], months: ["January", "February"], weekdays: ["Monday"] };

describe("date-outside-period: reading the stated period", () => {
  it("only a line that starts with a period word and a separator states a period", () => {
    assert.equal(afterLabel("旅行期間：10月12日〜15日", WORDS.labels), "旅行期間：".length);
    assert.equal(afterLabel("- **Trip dates**: Oct 12–15", WORDS.labels), "- **Trip dates**: ".length);
    assert.equal(afterLabel("## 旅行期間 10月12日〜15日", WORDS.labels), "## 旅行期間 ".length);
    assert.equal(afterLabel("旅行期間中は10月12日に集合", WORDS.labels), undefined);
    assert.equal(afterLabel("今回の旅行期間：10月12日〜15日", WORDS.labels), undefined);
    assert.equal(afterLabel("", WORDS.labels), undefined);
    assert.equal(afterLabel("旅行期間：", []), undefined);
  });

  it("two dates joined by a range mark, a date with a day-only end, and a month name with a range of days", () => {
    const two = "旅行期間：10月12日〜10月15日";
    assert.deepEqual(
      statedPeriod(
        two,
        0,
        [
          { offset: 5, end: 11, value: "10-12" },
          { offset: 12, end: 18, value: "10-15" },
        ],
        WORDS,
      ),
      { start: "10-12", end: "10-15", written: "10月12日〜10月15日" },
    );
    assert.equal(statedPeriod("旅行期間：10月12日〜15日", 0, [{ offset: 5, end: 11, value: "10-12" }], WORDS)?.end, "10-15");
    assert.deepEqual(statedPeriod("Trip dates: January 3–5, 2027", 0, [], WORDS), { start: "2027-01-03", end: "2027-01-05", written: "January 3–5, 2027" });
  });

  it("a year written on one end only is given to the other, across the new year too", () => {
    const line = "Trip dates: December 28 to January 4, 2027";
    const dates = [
      { offset: 12, end: 23, value: "12-28" },
      { offset: 27, end: 42, value: "2027-01-04" },
    ];
    assert.deepEqual(statedPeriod(line, 0, dates, WORDS), { start: "2026-12-28", end: "2027-01-04", written: "December 28 to January 4, 2027" });
  });

  it("no period: one date alone, two dates with words between, a period that ends before it starts, no label", () => {
    assert.equal(statedPeriod("旅行期間：10月12日", 0, [{ offset: 5, end: 11, value: "10-12" }], WORDS), undefined);
    const apart = [
      { offset: 5, end: 11, value: "10-12" },
      { offset: 14, end: 20, value: "10-15" },
    ];
    assert.equal(statedPeriod("旅行期間：10月12日と、10月15日", 0, apart, WORDS), undefined);
    const reversed = [
      { offset: 5, end: 16, value: "2026-10-15" },
      { offset: 17, end: 28, value: "2026-10-12" },
    ];
    assert.equal(statedPeriod("旅行期間：2026年10月15日〜2026年10月12日", 0, reversed, WORDS), undefined);
    assert.equal(statedPeriod("出発：10月12日〜15日", 0, [{ offset: 3, end: 9, value: "10-12" }], WORDS), undefined);
  });

  it("words that keep a date outside on purpose: Latin words at word boundaries, others anywhere", () => {
    assert.equal(mentions("- Oct 17: post-trip debrief", ["post-trip"]), true);
    assert.equal(mentions("- Oct 17: compost tour", ["post"]), false);
    assert.equal(mentions("- 10月11日 前泊", ["前泊"]), true);
    assert.equal(mentions("", ["前泊"]), false);
  });
});

describe("date-outside-period: Japanese", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
  });

  it("a day in the plan after the trip's end is reported, with the date and the period in the message", () => {
    const source = lines("# 旅程", "", "旅行期間：2026年10月12日〜2026年10月15日", "", "- 10月12日 成田を出発", "- 10月14日 市内視察", "- 10月17日 成田に帰着");
    const [finding] = findings(source, ja, "ja");
    const rule = loadRules("ja").find((candidate) => candidate.id === "date-outside-period");
    assert.ok(finding !== undefined && rule !== undefined);
    assert.equal(finding.values["date"], "10月17日");
    assert.equal(messageOf(rule, finding, "ja"), "「10月17日」が、書いた期間「2026年10月12日〜2026年10月15日」の外です");
  });

  it("day headings and table rows, and a period written with a day-only end or から…まで", () => {
    assert.deepEqual(foundJa(lines("# 研修", "", "会期：5月3日～5日", "", "## 5月3日（月）", "", "開会", "", "## 5月6日（木）", "", "閉会")), ["5月6日"]);
    const table = lines(
      "# 出張",
      "",
      "出張期間：2027年2月8日から2027年2月11日まで",
      "",
      "| 日付 | 内容 |",
      "| --- | --- |",
      "| 2月8日 | 移動 |",
      "| 2月12日 | 帰着 |",
    );
    assert.deepEqual(foundJa(table), ["2月12日"]);
  });

  it("a date without a year in running text is compared; one with a year is not", () => {
    assert.deepEqual(foundJa(lines("# 出張", "", "出張期間：2027年2月8日〜2027年2月11日", "", "2月12日（金）の午前は研究室を訪問します。")), ["2月12日"]);
    assert.deepEqual(foundJa(lines("# 学会", "", "会期：2027年2月8日〜2027年2月11日", "", "第1回は2010年2月5日に開かれました。")), []);
  });

  it("no stated period, or a date marked as before or after the period, a deadline or a booking: nothing is said", () => {
    assert.deepEqual(foundJa(lines("# 旅程", "", "- 10月12日 出発", "- 10月17日 帰着")), []);
    const marked = lines(
      "# 旅程",
      "",
      "旅行期間：2026年10月12日〜2026年10月15日",
      "",
      "- 10月11日 前泊（成田）",
      "- 9月30日 申込締切",
      "- 9月1日 ホテルを予約",
      "- 10月20日 事後の報告会",
    );
    assert.deepEqual(foundJa(marked), []);
    assert.deepEqual(foundJa(lines("# 大会", "", "会期：2026年5月3日〜5日", "", "## 過去の大会", "", "- 2025年5月4日 第10回")), []);
  });

  it("a period without a year that runs into the new year, and dates in another section of the same depth", () => {
    assert.deepEqual(foundJa(lines("# 年末年始", "", "期間：12月28日〜1月4日", "", "- 12月29日 出発", "- 1月2日 初詣", "- 1月3日 帰着")), []);
    const sections = lines("# 計画", "", "## 冬の旅行", "", "旅行期間：12月1日〜12月3日", "", "- 12月2日 観光", "", "## 春の旅行", "", "- 4月5日 出発");
    assert.deepEqual(foundJa(sections), []);
  });
});

describe("date-outside-period: English", () => {
  it("a session after the conference's last day, in a list, a table and a heading", () => {
    assert.deepEqual(foundEn(lines("# Plan", "", "Trip dates: Oct 12–15", "", "- Oct 12: fly out", "- Oct 17: return")), ["Oct 17"]);
    const table = lines(
      "# Programme",
      "",
      "Conference: May 3–5, 2026",
      "",
      "| Date | Session |",
      "| --- | --- |",
      "| May 3 | Opening |",
      "| May 7 | Closing |",
    );
    assert.deepEqual(foundEn(table), ["May 7"]);
    assert.deepEqual(foundEn(lines("# Programme", "", "Conference: 3–5 May 2026", "", "## Day 3: 7 May 2026", "", "Closing")), ["7 May 2026"]);
  });

  it("a period written from … to …, and a date without a year in running text", () => {
    const source = lines(
      "# Travel plan",
      "",
      "Trip period: from Monday, February 8, 2027 to Thursday, February 11, 2027",
      "",
      "On the morning of Friday, February 12, I will visit the lab.",
    );
    assert.deepEqual(foundEn(source), ["February 12"]);
  });

  it("silent without a period, for marked items, and for a period that runs into the new year", () => {
    assert.deepEqual(foundEn(lines("# Plan", "", "- Oct 12: fly out", "- Oct 17: return")), []);
    const marked = lines(
      "# Plan",
      "",
      "Trip dates: Oct 12–15",
      "",
      "- Oct 11: pre-trip briefing",
      "- Sep 30: book by this date",
      "- Oct 20: follow-up call",
      "- Sep 1: registration deadline",
    );
    assert.deepEqual(foundEn(marked), []);
    assert.deepEqual(foundEn(lines("# Holiday", "", "Dates: December 28 – January 4", "", "- December 30: Edinburgh", "- January 2: Glasgow")), []);
  });

  it("a period across two months or the new year with the year written once at the end", () => {
    assert.deepEqual(foundEn(lines("# Programme", "", "Conference: May 3–June 5, 2026", "", "- May 4, 2026: workshop", "- June 9, 2026: wrap-up")), [
      "June 9, 2026",
    ]);
    assert.deepEqual(foundEn(lines("# Holiday", "", "Trip dates: Dec 28–Jan 4, 2027", "", "- Dec 30, 2026: Edinburgh", "- Jan 5, 2027: home")), [
      "Jan 5, 2027",
    ]);
  });

  it("not a period: a table of events, a list of events, and a time range on one day", () => {
    const table = lines("# Events", "", "| Event | Dates |", "| --- | --- |", "| Conference | May 3–5, 2026 |", "| Workshop | May 7, 2026 |");
    assert.deepEqual(foundEn(table), []);
    assert.deepEqual(foundEn(lines("# Events", "", "- Conference: May 3–5, 2026", "- Workshop: May 7, 2026")), []);
    assert.deepEqual(foundEn(lines("# Event", "", "Conference: May 3–5pm", "", "- May 6: team dinner")), []);
  });

  it("a date with a year in running text, and an earlier edition, are not compared", () => {
    const source = lines(
      "# Conference",
      "",
      "Conference: May 3–5, 2026",
      "",
      "The first meeting was held on May 4, 2010.",
      "",
      "## Previous meetings",
      "",
      "- May 6, 2025: Denver",
    );
    assert.deepEqual(foundEn(source), []);
  });
});

// 文書の仕事の期間（開講期間、Term）を文書の頭か概要の節で書いたとき、後ろのどの節でも、締め切りの語のある項目や文の、期間の終わりより後の日付。
const syllabusJa = (term: string, deadline: string, overview = "## 1 授業の概要"): string =>
  lines("# シラバス「データ分析入門」", "", overview, "", term, "", "## 2 試験", "", "期末試験は2027年2月2日（火）に行います。", "", "## 3 課題", "", deadline);

const syllabusEn = (term: string, deadline: string, overview = "## 1 Course overview"): string =>
  lines(
    "# Syllabus: Introduction to Data Analysis",
    "",
    overview,
    "",
    term,
    "",
    "## 2 Examination",
    "",
    "The examination is on Tuesday, February 2, 2027.",
    "",
    "## 3 Assignment",
    "",
    deadline,
  );

const TERM_JA = "開講期間：2026年10月6日（火）から2027年2月5日（金）まで";
const TERM_EN = "Term: Tuesday, October 6, 2026 to Friday, February 5, 2027";

describe("date-outside-period: a deadline after the document's term", () => {
  it("a submission deadline in a later section after the term's end is reported, in a sentence and in a list item", () => {
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "課題レポートは、2027年2月12日（金）までに学習支援システムで提出してください。")), ["2027年2月12日"]);
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "- 提出期限：2027年2月19日")), ["2027年2月19日"]);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "Submit the written assignment through the learning system by Friday, February 12, 2027.")), [
      "February 12, 2027",
    ]);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "The final report is due on February 19, 2027.")), ["February 19, 2027"]);
  });

  it("a term line before the first section, under the title only, is the document's term too", () => {
    assert.deepEqual(foundJa(lines("# シラバス", "", TERM_JA, "", "## 課題", "", "レポートの締切は2027年3月1日です。")), ["2027年3月1日"]);
    assert.deepEqual(foundEn(lines("# Syllabus", "", TERM_EN, "", "## Assignment", "", "The deadline for the report is March 1, 2027.")), ["March 1, 2027"]);
  });

  it("silent for a deadline inside the term, or before it starts", () => {
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "課題レポートは、2027年1月29日（金）までに提出してください。")), []);
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "履修登録の締切は2026年9月30日です。")), []);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "Submit the written assignment by Friday, January 29, 2027.")), []);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "The registration deadline is September 30, 2026.")), []);
  });

  it("silent for a later date that is not a deadline, a payment deadline, or a date without a year", () => {
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "成績は2027年3月10日に公開します。")), []);
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "教材費の支払期限は2027年3月1日です。")), []);
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "課題レポートは、2月12日（金）までに提出してください。")), []);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "Grades are published on March 10, 2027.")), []);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "The payment for course materials is due on March 1, 2027.")), []);
  });

  it("another period stated in between does not end the term's reach", () => {
    const en = lines(
      "# Syllabus",
      "",
      TERM_EN,
      "",
      "## Exams",
      "",
      "Period: February 1–3, 2027",
      "",
      "## Assignments",
      "",
      "The final report is due on February 12, 2027.",
    );
    assert.deepEqual(foundEn(en), ["February 12, 2027"]);
  });

  it("a term is compared with deadlines only: a dated item that is not a deadline, and 'due to', stay silent", () => {
    assert.deepEqual(foundEn(lines("# Syllabus", "", TERM_EN, "", "- March 10, 2027: grades are published")), []);
    assert.deepEqual(foundJa(lines("# シラバス", "", TERM_JA, "", "- 2027年3月10日 成績公開")), []);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "Classes may be cancelled due to maintenance on March 1, 2027.")), []);
  });

  it("silent when the term is stated in a later section that is not an overview", () => {
    assert.deepEqual(foundJa(syllabusJa(TERM_JA, "課題レポートは、2027年2月12日（金）までに提出してください。", "## 1 担当教員")), []);
    assert.deepEqual(foundEn(syllabusEn(TERM_EN, "Submit the written assignment by Friday, February 12, 2027.", "## 1 Instructor")), []);
  });

  it("silent for a trip's period: an expense report may be due after the trip", () => {
    const ja = lines(
      "# 出張旅程表",
      "",
      "出張期間：2026年11月10日〜2026年11月12日",
      "",
      "## 精算",
      "",
      "精算書は、2026年11月16日（月）までに経理部へ提出してください。",
    );
    assert.deepEqual(foundJa(ja), []);
    const en = lines(
      "# Itinerary",
      "",
      "Trip period: November 10, 2026 – November 12, 2026",
      "",
      "## Expenses",
      "",
      "Submit the expense report by November 16, 2026.",
    );
    assert.deepEqual(foundEn(en), []);
  });
});
