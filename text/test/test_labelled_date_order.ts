import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { datesOutOfOrder, pairedDatesOutOfOrder, type OrderLabel } from "../packages/chaff/src/structure/labelled-date-order.ts";

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
      { offset: 22, values: { later: "2025-11-01", earlier: "2026-10-01", later_label: "入居可能日", earlier_label: "掲載日" } },
    ]);
  });
});
