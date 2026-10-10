import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { datesOutOfOrder, pairedDatesOutOfOrder, periodEndOf, type OrderLabel } from "../packages/chaff/src/structure/labelled-date-order.ts";

// 前後の決まった日付の組（due-before-issue の order）。物件の案内の入居可能日と掲載日、求人の応募締切と掲載日。例文はすべて自作。

const RULE = "due-before-issue";

const findingsOf = (source: string, adapter = ja): readonly string[] => namedRuleRun(RULE, source, adapter).findings;

const listingJa = (listed: string, moveIn: string): string =>
  `# 賃貸マンション 架空荘 101号室\n\n掲載日：${listed}\n\n| 項目 | 内容 |\n| --- | --- |\n| 所在地 | 架空市一丁目1番1号 |\n| 入居可能日 | ${moveIn} |\n`;

const listingEn = (listed: string, moveIn: string): string =>
  `# Flat to Let: 1 Example Road\n\nListed: ${listed}\n\n| Item | Details |\n| --- | --- |\n| Address | 1 Example Road |\n| Available from | ${moveIn} |\n`;

const postingJa = (postedLabel: string, posted: string, deadlineLabel: string, deadline: string): string =>
  `# 求人票 架空商事株式会社 一般事務\n\n${postedLabel}：${posted}\n\n${deadlineLabel}：${deadline}\n\n## 仕事内容\n\n1. 書類の作成\n2. 電話の応対\n`;

const postingEn = (postedLabel: string, posted: string, deadlineLabel: string, deadline: string): string =>
  `# Job Posting: Office Assistant, Example Trading\n\n${postedLabel}: ${posted}\n\n${deadlineLabel}: ${deadline}\n\n## Duties\n\n1. Prepare documents\n2. Answer the phone\n`;

const LABELS: readonly OrderLabel[] = [
  { pattern: "掲載日", group: "listing", position: "before" },
  { pattern: "入居可能日", group: "listing", position: "after" },
];

describe("due-before-issue (order): 入居可能日や応募締切が掲載日より前", () => {
  it("掲載日より前の入居可能日を指す", () => {
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "2025年11月1日")), ["「入居可能日」の 2025-11-01 が、「掲載日」の 2026-10-01 より前です"]);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "August 1, 2026"), en), ['"Available from" 2026-08-01 is before "Listed" 2026-10-01']);
  });

  it("情報公開日と掲載日の後の入居可能日は言わない", () => {
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "2026年11月1日")), []);
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "2026年10月1日")), []);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "November 1, 2026"), en), []);
    assert.deepEqual(findingsOf("# 物件\n\n情報公開日：2026年10月1日\n\n- 入居時期：2026年9月1日\n"), [
      "「入居時期」の 2026-09-01 が、「情報公開日」の 2026-10-01 より前です",
    ]);
  });

  it("日付の無い入居可能日、年の無い日付、即入居の行は比べない", () => {
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "即入居可")), []);
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "9月1日")), []);
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "即入居可（2026年9月1日から空室）")), []);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "Now"), en), []);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "September 1"), en), []);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "Immediately (vacant since September 1, 2026)"), en), []);
  });

  it("行の頭に語の無い日付と、掲載日の無い文書は比べない", () => {
    assert.deepEqual(findingsOf("# 物件\n\n掲載日：2026年10月1日\n\n2026年9月1日から入居できます。\n"), []);
    assert.deepEqual(findingsOf("# 物件\n\n| 入居可能日 | 2025年11月1日 |\n"), []);
    assert.deepEqual(findingsOf("# Notes\n\nListed: October 1, 2026\n\nAvailable courses started on September 1, 2026.\n", en), []);
    assert.deepEqual(findingsOf("# Release notes\n\nPosted: October 1, 2026\n\nAvailable: September 1, 2026\n", en), []);
  });

  it("掲載日から40行以上離れた日付は比べない", () => {
    const listing = (rowCount: number): string => {
      const rows = Array.from({ length: rowCount }, (_, index) => `| 項目${String(index + 1)} | 内容 |`).join("\n");
      return `# 物件\n\n掲載日：2026年10月1日\n\n| 項目 | 内容 |\n| --- | --- |\n${rows}\n| 入居可能日 | 2026年9月1日 |\n`;
    };
    assert.deepEqual(findingsOf(listing(40)), []);
    assert.equal(findingsOf(listing(30)).length, 1);
  });

  it("求人の応募締切が掲載日より前なら指す", () => {
    assert.deepEqual(findingsOf(postingJa("掲載日", "2026年10月1日", "応募締切", "2026年9月30日")), [
      "「応募締切」の 2026-09-30 が、「掲載日」の 2026-10-01 より前です",
    ]);
    assert.deepEqual(findingsOf(postingJa("募集開始日", "2026年10月1日", "応募期限", "2026年9月1日")), [
      "「応募期限」の 2026-09-01 が、「募集開始日」の 2026-10-01 より前です",
    ]);
    assert.deepEqual(findingsOf(postingEn("Posted", "October 1, 2026", "Application deadline", "September 30, 2026"), en), [
      '"Application deadline" 2026-09-30 is before "Posted" 2026-10-01',
    ]);
    assert.deepEqual(findingsOf(postingEn("Posted on", "2026-10-01", "Application closing date", "2026-09-15"), en), [
      '"Application closing date" 2026-09-15 is before "Posted on" 2026-10-01',
    ]);
  });

  it("掲載日より後の応募締切、年の無い日付、随時や採用まで続く締切は言わない", () => {
    assert.deepEqual(findingsOf(postingJa("掲載日", "2026年10月1日", "応募締切", "2026年10月31日")), []);
    assert.deepEqual(findingsOf(postingJa("掲載日", "2026年10月1日", "応募締切", "9月30日")), []);
    assert.deepEqual(findingsOf(postingJa("掲載日", "2026年10月1日", "応募締切", "随時（採用が決まり次第終了）")), []);
    assert.deepEqual(findingsOf(postingEn("Posted", "October 1, 2026", "Application deadline", "October 31, 2026"), en), []);
    assert.deepEqual(findingsOf(postingEn("Posted", "October 1, 2026", "Application deadline", "September 30"), en), []);
    assert.deepEqual(findingsOf(postingEn("Posted", "October 1, 2026", "Application deadline", "Open until filled"), en), []);
  });

  it("Posted は応募締切とだけ組み、ブログや更新履歴の日付とは組まない", () => {
    assert.deepEqual(findingsOf("# Release notes\n\nPosted: October 1, 2026\n\nAvailable from: September 1, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Sold\n\nPosted: October 1, 2026\n\nClosing date: September 15, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Weekly update\n\nPosted on: October 1, 2026\n\nDue date: September 1, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Blog\n\nPosted: October 1, 2026\n\nThe application deadline was September 30, 2026.\n", en), []);
    assert.deepEqual(findingsOf("# 求人\n\n掲載日：2026年10月1日\n\n応募者数：2026年9月1日時点で3名\n"), []);
  });

  it("組の片方しか語の無い語彙表、組の名の無い語、空の入力", () => {
    const dates = [
      { offset: 4, value: "2026-10-01" },
      { offset: 22, value: "2025-11-01" },
    ];
    const source = "掲載日：2026年10月1日\n入居可能日：2025年11月1日";
    assert.equal(pairedDatesOutOfOrder(source, dates, LABELS, [], 40).length, 1);
    assert.deepEqual(pairedDatesOutOfOrder(source, dates, [{ pattern: "掲載日", group: "listing", position: "before" }], [], 40), []);
    assert.deepEqual(pairedDatesOutOfOrder(source, dates, [{ pattern: "掲載日" }, { pattern: "入居可能日" }], [], 40), []);
    assert.deepEqual(pairedDatesOutOfOrder(source, dates, LABELS, ["入居"], 40), []);
    assert.deepEqual(pairedDatesOutOfOrder("", [], LABELS, [], 40), []);
    assert.deepEqual(datesOutOfOrder(source, dates, { earlier: [], later: ["入居可能日"], passed: [], maxLineGap: 40 }), []);
    assert.deepEqual(datesOutOfOrder(source, dates, { earlier: ["掲載日"], later: ["入居可能日"], passed: [], maxLineGap: 1 }), []);
  });

  it("値に両方の語と日付を添える", () => {
    const dates = [
      { offset: 4, value: "2026-10-01" },
      { offset: 22, value: "2025-11-01" },
    ];
    assert.deepEqual(pairedDatesOutOfOrder("掲載日：2026年10月1日\n入居可能日：2025年11月1日", dates, LABELS, [], 40), [
      { offset: 22, values: { later: "2025-11-01", earlier: "2026-10-01", later_label: "入居可能日", earlier_label: "掲載日" }, period: false },
    ]);
  });
});

const earningsJa = (period: string, call: string, callLabel = "決算説明会"): string =>
  `# 2026年3月期 決算短信\n\n架空電子株式会社\n\n対象期間：${period}\n\n${callLabel}：${call}\n\n## 1 当期の業績\n\n売上高は1,320百万円でした。\n`;

const earningsEn = (period: string, call: string, callLabel = "Earnings call"): string =>
  `# Financial Results for FY2026\n\nExample Instruments Inc.\n\nReporting period: ${period}\n\n${callLabel}: ${call}\n\n## 1 Results\n\nNet sales were $1,320 million.\n`;

describe("due-before-issue (period): 決算説明会が対象期間の終わりより前", () => {
  it("対象期間の終わりより前の説明会を指す", () => {
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜2026年3月31日", "2026年3月25日（オンライン）")), [
      "「決算説明会」の 2026-03-25 が、「対象期間」の終わり 2026-03-31 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2025 to March 31, 2026", "March 25, 2026 (online)"), en), [
      '"Earnings call" 2026-03-25 is before the end of the "Reporting period", 2026-03-31',
    ]);
  });

  it("終わりにだけ年を書いた期間、始まりにだけ年を書いた期間も、終わりの日で比べる", () => {
    assert.deepEqual(findingsOf(earningsJa("2026年4月1日〜9月30日（第2四半期累計）", "2026年9月18日")), [
      "「決算説明会」の 2026-09-18 が、「対象期間」の終わり 2026-09-30 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜3月31日", "2026年3月25日")), [
      "「決算説明会」の 2026-03-25 が、「対象期間」の終わり 2026-03-31 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsEn("April 1 – September 30, 2026", "September 18, 2026"), en), [
      '"Earnings call" 2026-09-18 is before the end of the "Reporting period", 2026-09-30',
    ]);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2026 to September 30, 2026", "September 18, 2026", "Earnings conference call"), en), [
      '"Earnings conference call" 2026-09-18 is before the end of the "Reporting period", 2026-09-30',
    ]);
  });

  it("期間の終わり以後の説明会と決算発表は言わない", () => {
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜2026年3月31日", "2026年5月14日")), []);
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜2026年3月31日", "2026年3月31日")), []);
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜2026年3月31日", "2026年5月12日", "決算発表日")), []);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2025 to March 31, 2026", "May 14, 2026"), en), []);
    assert.deepEqual(findingsOf(earningsEn("April 1 – September 30, 2026", "November 12, 2026"), en), []);
  });

  it("年の無い説明会の日、年の無い期間、期間の行の無い文書、前回の説明会は比べない", () => {
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜2026年3月31日", "3月25日")), []);
    assert.deepEqual(findingsOf(earningsJa("4月1日〜9月30日", "2026年9月18日")), []);
    assert.deepEqual(findingsOf("# 決算短信\n\n決算説明会：2026年3月25日\n"), []);
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜2026年3月31日", "2026年5月14日\n\n前回説明会：2025年11月12日")), []);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2025 to March 31, 2026", "March 25"), en), []);
    assert.deepEqual(findingsOf(earningsEn("April 1 – September 30", "September 18, 2026"), en), []);
    assert.deepEqual(findingsOf("# Results\n\nEarnings call: March 25, 2026\n", en), []);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2025 to March 31, 2026", "May 14, 2026\n\nPrevious call: November 12, 2025"), en), []);
  });

  it("「発表日」「説明会開催日」、Release date、Conference call だけでは期間と組まない", () => {
    assert.deepEqual(findingsOf(earningsJa("2026年3月1日〜2026年3月31日", "2026年3月1日", "発表日")), []);
    assert.deepEqual(findingsOf(earningsJa("2026年4月1日〜2027年3月31日", "2026年5月15日", "説明会開催日")), []);
    assert.deepEqual(findingsOf(earningsEn("March 1, 2026 to March 31, 2026", "March 1, 2026", "Release date"), en), []);
    assert.deepEqual(findingsOf(earningsEn("May 1, 2026 to May 31, 2026", "May 15, 2026", "Conference call"), en), []);
  });
});

describe("periodEndOf: 期間を書いた行の終わりの日", () => {
  const SPANS = { labels: ["対象期間"], connectors: ["〜"], months: [], weekdays: [] };
  const lineOf = (text: string) => ({ text, start: 0, number: 1 });

  it("二つの日付の範囲の終わりを、年とともに返す", () => {
    const text = "対象期間：2025年4月1日〜2026年3月31日";
    const dates = [
      { offset: 5, end: 14, value: "2025-04-01" },
      { offset: 15, end: 25, value: "2026-03-31" },
    ];
    assert.deepEqual(periodEndOf(lineOf(text), "対象期間", dates, SPANS), { offset: 0, value: "2026-03-31" });
  });

  it("範囲でない行、年の無い期間、終わる位置の無い日付、語の無い行は undefined", () => {
    assert.equal(periodEndOf(lineOf("対象期間：2025年4月1日"), "対象期間", [{ offset: 5, end: 14, value: "2025-04-01" }], SPANS), undefined);
    const noYear = [
      { offset: 5, end: 9, value: "04-01" },
      { offset: 10, end: 15, value: "09-30" },
    ];
    assert.equal(periodEndOf(lineOf("対象期間：4月1日〜9月30日"), "対象期間", noYear, SPANS), undefined);
    assert.equal(
      periodEndOf(
        lineOf("対象期間：2025年4月1日〜2026年3月31日"),
        "対象期間",
        [
          { offset: 5, value: "2025-04-01" },
          { offset: 15, value: "2026-03-31" },
        ],
        SPANS,
      ),
      undefined,
    );
    assert.equal(periodEndOf(lineOf("期間：2025年4月1日〜2026年3月31日"), "対象期間", [], SPANS), undefined);
    assert.equal(periodEndOf(lineOf(""), "対象期間", [], SPANS), undefined);
  });
});
