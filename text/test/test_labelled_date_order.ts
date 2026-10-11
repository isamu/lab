import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { datesOutOfOrder, pairedDatesOutOfOrder, periodEndOf, type OrderLabel } from "../packages/chaff/src/structure/labelled-date-order.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";

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
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "2025年11月1日")), ["「入居可能日」（2025年11月1日）が、「掲載日」（2026年10月1日）より前です"]);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "August 1, 2026"), en), ['"Available from" August 1, 2026 is before "Listed" October 1, 2026']);
  });

  it("情報公開日と掲載日の後の入居可能日は言わない", () => {
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "2026年11月1日")), []);
    assert.deepEqual(findingsOf(listingJa("2026年10月1日", "2026年10月1日")), []);
    assert.deepEqual(findingsOf(listingEn("October 1, 2026", "November 1, 2026"), en), []);
    assert.deepEqual(findingsOf("# 物件\n\n情報公開日：2026年10月1日\n\n- 入居時期：2026年9月1日\n"), [
      "「入居時期」（2026年9月1日）が、「情報公開日」（2026年10月1日）より前です",
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
      "「応募締切」（2026年9月30日）が、「掲載日」（2026年10月1日）より前です",
    ]);
    assert.deepEqual(findingsOf(postingJa("募集開始日", "2026年10月1日", "応募期限", "2026年9月1日")), [
      "「応募期限」（2026年9月1日）が、「募集開始日」（2026年10月1日）より前です",
    ]);
    assert.deepEqual(findingsOf(postingEn("Posted", "October 1, 2026", "Application deadline", "September 30, 2026"), en), [
      '"Application deadline" September 30, 2026 is before "Posted" October 1, 2026',
    ]);
    assert.deepEqual(findingsOf(postingEn("Posted on", "2026-10-01", "Application closing date", "2026-09-15"), en), [
      '"Application closing date" September 15, 2026 is before "Posted on" October 1, 2026',
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
      "「決算説明会」の 2026年3月25日 が、「対象期間」の終わり 2026年3月31日 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2025 to March 31, 2026", "March 25, 2026 (online)"), en), [
      '"Earnings call" March 25, 2026 is before the end of the "Reporting period", March 31, 2026',
    ]);
  });

  it("終わりにだけ年を書いた期間、始まりにだけ年を書いた期間も、終わりの日で比べる", () => {
    assert.deepEqual(findingsOf(earningsJa("2026年4月1日〜9月30日（第2四半期累計）", "2026年9月18日")), [
      "「決算説明会」の 2026年9月18日 が、「対象期間」の終わり 2026年9月30日 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsJa("2025年4月1日〜3月31日", "2026年3月25日")), [
      "「決算説明会」の 2026年3月25日 が、「対象期間」の終わり 2026年3月31日 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsEn("April 1 – September 30, 2026", "September 18, 2026"), en), [
      '"Earnings call" September 18, 2026 is before the end of the "Reporting period", September 30, 2026',
    ]);
    assert.deepEqual(findingsOf(earningsEn("April 1, 2026 to September 30, 2026", "September 18, 2026", "Earnings conference call"), en), [
      '"Earnings conference call" September 18, 2026 is before the end of the "Reporting period", September 30, 2026',
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

const earningsTableJa = (rows: readonly string[]): string =>
  ["# 2026年度 第2四半期 決算説明資料", "", "| 項目 | 内容 |", "| --- | --- |", ...rows, "", "## 1 当期の業績", "", "売上高は1,320百万円でした。", ""].join(
    "\n",
  );

const earningsTableEn = (rows: readonly string[]): string =>
  ["# Interim Results for FY2026", "", "| Item | Detail |", "| --- | --- |", ...rows, "", "## 1 Results", "", "Net sales were $1,320 million.", ""].join("\n");

describe("due-before-issue (period): 項目と内容の二列の表に書いた対象期間", () => {
  it("表の一行に書いた対象期間の終わりより前の説明会を指す", () => {
    assert.deepEqual(findingsOf(earningsTableJa(["| 対象期間 | 2026年4月1日〜2026年9月30日 |", "| 決算説明会 | 2026年9月15日 |"])), [
      "「決算説明会」の 2026年9月15日 が、「対象期間」の終わり 2026年9月30日 より前です",
    ]);
    assert.deepEqual(findingsOf(earningsTableEn(["| **Reporting period** | April 1 – September 30, 2026 |", "| Earnings call | September 15, 2026 |"]), en), [
      '"Earnings call" September 15, 2026 is before the end of the "Reporting period", September 30, 2026',
    ]);
  });

  it("期間の終わり以後の説明会、対象期間を何行も並べた表、三列の表は言わない", () => {
    assert.deepEqual(findingsOf(earningsTableJa(["| 対象期間 | 2026年4月1日〜2026年9月30日 |", "| 決算説明会 | 2026年11月12日 |"])), []);
    assert.deepEqual(
      findingsOf(
        earningsTableJa(["| 対象期間 | 2026年4月1日〜2026年9月30日 |", "| 対象期間 | 2025年4月1日〜2025年9月30日 |", "| 決算説明会 | 2026年9月15日 |"]),
      ),
      [],
    );
    assert.deepEqual(findingsOf(earningsTableJa(["| 対象期間 | 2026年4月1日〜2026年9月30日 | 第2四半期 |", "| 決算説明会 | 2026年9月15日 | |"])), []);
    assert.deepEqual(findingsOf(earningsTableEn(["| Reporting period | April 1 – September 30, 2026 |", "| Earnings call | November 12, 2026 |"]), en), []);
    assert.deepEqual(
      findingsOf(
        earningsTableEn([
          "| Reporting period | April 1 – September 30, 2026 |",
          "| Reporting period | April 1 – June 30, 2026 |",
          "| Earnings call | September 15, 2026 |",
        ]),
        en,
      ),
      [],
    );
  });

  it("二つの期間の語（Reporting period と Period covered、対象期間と会計期間）を項目に書いた表も、期間の一覧として言わない", () => {
    assert.deepEqual(
      findingsOf(
        earningsTableEn([
          "| Reporting period | April 1 – September 30, 2026 |",
          "| Period covered | April 1 – June 30, 2026 |",
          "| Earnings call | September 15, 2026 |",
        ]),
        en,
      ),
      [],
    );
    assert.deepEqual(
      findingsOf(
        earningsTableJa(["| 対象期間 | 2026年4月1日〜2026年9月30日 |", "| 会計期間 | 2026年4月1日〜2027年3月31日 |", "| 決算説明会 | 2026年9月15日 |"]),
      ),
      [],
    );
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

const reportJa = (examLabel: string, exam: string, reportLabel: string, report: string): string =>
  `# 健康診断結果報告書\n\n架空クリニック\n\n${examLabel}：${exam}\n\n${reportLabel}：${report}\n\n## 1 所見\n\n特に異常はありません。\n`;

const reportEn = (examLabel: string, exam: string, reportLabel: string, report: string): string =>
  `# Checkup Results\n\nExample Clinic\n\n${examLabel}: ${exam}\n\n${reportLabel}: ${report}\n\n## 1 Findings\n\nNo findings.\n`;

const warrantyJa = (bought: string, deadlineLabel: string, deadline: string): string =>
  `# 保証書 架空電機 電気ケトル\n\nお買い上げ日：${bought}\n\n${deadlineLabel}：${deadline}\n\n保証期間は、お買い上げ日から1年間です。\n`;

const warrantyEn = (boughtLabel: string, bought: string, deadlineLabel: string, deadline: string): string =>
  `# Warranty: Example Kettle\n\n${boughtLabel}: ${bought}\n\n${deadlineLabel}: ${deadline}\n\nThe warranty runs for 1 year from the purchase date.\n`;

const genreFindings = (source: string, genre: string): string[] =>
  runRules(buildDocument("a.md", source, ja), loadRules("ja"), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.rule);

describe("due-before-issue (order): 検査結果の報告日、保証書の登録の締切", () => {
  it("受診日や採血日より前の報告日を指す", () => {
    assert.deepEqual(findingsOf(reportJa("受診日", "2026年10月8日", "報告日", "2026年9月30日")), [
      "「報告日」（2026年9月30日）が、「受診日」（2026年10月8日）より前です",
    ]);
    assert.deepEqual(findingsOf(reportJa("採血日", "2026年9月2日", "報告日", "2026年8月27日")), [
      "「報告日」（2026年8月27日）が、「採血日」（2026年9月2日）より前です",
    ]);
    assert.deepEqual(findingsOf(reportEn("Examination date", "July 15, 2026", "Report date", "June 29, 2026"), en), [
      '"Report date" June 29, 2026 is before "Examination date" July 15, 2026',
    ]);
    assert.deepEqual(findingsOf(reportEn("Collection date", "May 18, 2026", "Date reported", "May 11, 2026"), en), [
      '"Date reported" May 11, 2026 is before "Collection date" May 18, 2026',
    ]);
  });

  it("受診日の後の報告日、年の無い日付は言わない", () => {
    assert.deepEqual(findingsOf(reportJa("受診日", "2026年9月8日", "報告日", "2026年9月30日")), []);
    assert.deepEqual(findingsOf(reportJa("健診日", "2026年9月8日", "報告日", "2026年9月8日")), []);
    assert.deepEqual(findingsOf(reportJa("受診日", "2026年10月8日", "報告日", "9月30日")), []);
    assert.deepEqual(findingsOf(reportEn("Test date", "June 15, 2026", "Report date", "June 29, 2026"), en), []);
    assert.deepEqual(findingsOf(reportEn("Examination date", "July 15, 2026", "Report date", "June 29"), en), []);
  });

  it("受診券や検査の依頼書の発行日、作成日は、受診日や採血日と組まない", () => {
    assert.deepEqual(findingsOf(reportJa("受診日", "2026年10月8日", "発行日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(reportJa("検査日", "2026年10月8日", "作成日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(reportJa("採血日", "2026年10月8日", "発行日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(reportEn("Date collected", "October 8, 2026", "Issue date", "September 1, 2026"), en), []);
    assert.deepEqual(findingsOf(reportEn("Test date", "October 8, 2026", "Issue date", "September 1, 2026"), en), []);
    assert.deepEqual(findingsOf(reportEn("Examination date", "October 8, 2026", "Issue date", "September 1, 2026"), en), []);
  });

  it("お買い上げ日より前の登録の締切を指す", () => {
    assert.deepEqual(findingsOf(warrantyJa("2026年4月10日", "ご愛用者登録の締切", "2026年3月11日")), [
      "「ご愛用者登録の締切」（2026年3月11日）が、「お買い上げ日」（2026年4月10日）より前です",
    ]);
    assert.deepEqual(findingsOf(warrantyJa("2026年4月10日", "登録期限", "2026年3月11日")), [
      "「登録期限」（2026年3月11日）が、「お買い上げ日」（2026年4月10日）より前です",
    ]);
    assert.deepEqual(findingsOf(warrantyEn("Date of purchase", "July 1, 2026", "Registration deadline", "June 15, 2026"), en), [
      '"Registration deadline" June 15, 2026 is before "Date of purchase" July 1, 2026',
    ]);
    assert.deepEqual(findingsOf(warrantyEn("Purchase date", "July 1, 2026", "Register by", "June 15, 2026"), en), [
      '"Register by" June 15, 2026 is before "Purchase date" July 1, 2026',
    ]);
  });

  it("お買い上げ日の後の締切、年の無い日付、日付の無い締切は言わない", () => {
    assert.deepEqual(findingsOf(warrantyJa("2026年4月10日", "登録の締切", "2026年5月11日")), []);
    assert.deepEqual(findingsOf(warrantyJa("2026年4月10日", "登録の締切", "3月11日")), []);
    assert.deepEqual(findingsOf(warrantyJa("2026年4月10日", "登録の締切", "お早めに")), []);
    assert.deepEqual(findingsOf(warrantyEn("Purchase date", "July 1, 2026", "Registration deadline", "August 1, 2026"), en), []);
    assert.deepEqual(findingsOf(warrantyEn("Purchase date", "July 1, 2026", "Registration deadline", "June 15"), en), []);
    assert.deepEqual(findingsOf("# Warranty\n\nPurchase date: July 1, 2026\n\nRegister by June 15, 2026 to extend the warranty.\n", en), []);
  });

  it("別の組の語どうしは組まない", () => {
    assert.deepEqual(findingsOf("# 物件\n\n登録日：2026年10月1日\n\n登録期限：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# 保証書\n\n購入日：2026年10月1日\n\n報告日：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# 求人\n\n掲載日：2026年10月1日\n\n登録の締切：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# 結果\n\n報告日：2026年10月1日\n\n発行日：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# Notes\n\nPosted: October 1, 2026\n\nRegistration deadline: September 1, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Notes\n\nPurchase date: October 1, 2026\n\nReport date: September 1, 2026\n", en), []);
  });

  it("契約と手引きでは動き、法令やよくある質問では止まる", () => {
    const planted = warrantyJa("2026年4月10日", "登録の締切", "2026年3月11日");
    assert.deepEqual(genreFindings(planted, "docs/manual"), [RULE]);
    assert.deepEqual(genreFindings(planted, "legal/contract"), [RULE]);
    assert.deepEqual(genreFindings(planted, "legal/statute"), []);
    assert.deepEqual(genreFindings(planted, "docs/faq"), []);
    const contract = "# 保守契約書\n\n発行日：2026年4月1日\n\n有効期限：2027年3月31日\n\nお買い上げ日：2026年4月10日\n\n登録の締切：2026年5月11日\n";
    assert.deepEqual(genreFindings(contract, "legal/contract"), []);
    assert.deepEqual(genreFindings(contract, "docs/manual"), []);
  });
});

const recallJa = (noticeLabel: string, notice: string, deadlineLabel: string, deadline: string): string =>
  `# 電気ポット 自主回収のお知らせ\n\n架空電機株式会社\n\n${noticeLabel}：${notice}\n\n対象の製品を無償で交換いたします。\n\n${deadlineLabel}：${deadline}\n`;

const recallEn = (noticeLabel: string, notice: string, deadlineLabel: string, deadline: string): string =>
  `# Voluntary Recall: Example Kettle\n\nExample Appliances, Inc.\n\n${noticeLabel}: ${notice}\n\nWe will replace every affected kettle free of charge.\n\n${deadlineLabel}: ${deadline}\n`;

describe("due-before-issue (order): 回収のお知らせの受付期限", () => {
  it("お知らせ日より前の受付期限を指す", () => {
    assert.deepEqual(findingsOf(recallJa("お知らせ日", "2026年9月1日", "無償交換の受付期限", "2026年8月31日")), [
      "「無償交換の受付期限」（2026年8月31日）が、「お知らせ日」（2026年9月1日）より前です",
    ]);
    assert.deepEqual(findingsOf(recallJa("お知らせ日", "2026年9月1日", "交換受付期限", "2026年8月1日")), [
      "「交換受付期限」（2026年8月1日）が、「お知らせ日」（2026年9月1日）より前です",
    ]);
    assert.deepEqual(findingsOf(recallEn("Notice date", "September 1, 2026", "Refund requests accepted until", "August 31, 2026"), en), [
      '"Refund requests accepted until" August 31, 2026 is before "Notice date" September 1, 2026',
    ]);
    assert.deepEqual(findingsOf(recallEn("Date of notice", "September 1, 2026", "Exchange deadline", "August 31, 2026"), en), [
      '"Exchange deadline" August 31, 2026 is before "Date of notice" September 1, 2026',
    ]);
  });

  it("お知らせ日の後の受付期限、年の無い日付は言わない", () => {
    assert.deepEqual(findingsOf(recallJa("お知らせ日", "2026年9月1日", "返金の受付期限", "2027年8月31日")), []);
    assert.deepEqual(findingsOf(recallJa("お知らせ日", "2026年9月1日", "交換の受付期限", "8月31日")), []);
    assert.deepEqual(findingsOf(recallEn("Notice date", "September 1, 2026", "Replacement requests accepted until", "August 31, 2027"), en), []);
    assert.deepEqual(findingsOf(recallEn("Notice date", "September 1, 2026", "Exchange deadline", "August 31"), en), []);
  });

  it("懸賞の発表日や公表日、受付を終えたお知らせの過ぎた締切は言わない", () => {
    assert.deepEqual(findingsOf(recallJa("発表日", "2026年12月15日", "受付締切", "2026年11月30日")), []);
    assert.deepEqual(findingsOf(recallJa("公表日", "2026年12月15日", "受付締切", "2026年11月30日")), []);
    assert.deepEqual(findingsOf(recallJa("お知らせ日", "2026年9月1日", "お申し込み期限", "2026年8月31日")), []);
    assert.deepEqual(findingsOf(recallJa("お知らせ日", "2026年9月1日", "受付期限", "2026年8月31日")), []);
    assert.deepEqual(findingsOf(recallEn("Notice date", "September 1, 2026", "Deadline for requests", "August 31, 2026"), en), []);
    assert.deepEqual(findingsOf(recallEn("Notice date", "September 1, 2026", "Requests accepted until", "August 31, 2026"), en), []);
  });

  it("別の組の語どうしは組まない", () => {
    assert.deepEqual(findingsOf("# お知らせ\n\nお知らせ日：2026年10月1日\n\n応募締切：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# お知らせ\n\n掲載日：2026年10月1日\n\n返金の受付期限：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# お知らせ\n\nお買い上げ日：2026年10月1日\n\n交換受付期限：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# お知らせ\n\nお知らせ日：2026年10月1日\n\n登録期限：2026年9月1日\n"), []);
    assert.deepEqual(findingsOf("# Notice\n\nNotice date: October 1, 2026\n\nApplication deadline: September 1, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Notice\n\nPosted: October 1, 2026\n\nExchange deadline: September 1, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Notice\n\nPurchase date: October 1, 2026\n\nRefund requests accepted until: September 1, 2026\n", en), []);
  });
});

const loanJa = (contractLabel: string, contract: string, firstLabel: string, first: string): string =>
  `# 自動車ローン ご返済予定表\n\n## ご契約内容\n\n- ${contractLabel}：${contract}\n- ${firstLabel}：${first}\n- お支払回数：60回\n`;

const loanEn = (contractLabel: string, contract: string, firstLabel: string, first: string): string =>
  `# Auto Loan Repayment Schedule\n\n## Loan terms\n\n- ${contractLabel}: ${contract}\n- ${firstLabel}: ${first}\n- Number of payments: 48\n`;

describe("due-before-issue (order): ローンの初回お支払日が契約日より前", () => {
  it("ご契約日より前の初回お支払日を指す", () => {
    assert.deepEqual(findingsOf(loanJa("ご契約日", "2026年10月27日", "初回お支払日", "2026年10月20日")), [
      "「初回お支払日」（2026年10月20日）が、「ご契約日」（2026年10月27日）より前です",
    ]);
    assert.deepEqual(findingsOf(loanJa("契約日", "2026年10月27日", "初回返済日", "2026年10月1日")), [
      "「初回返済日」（2026年10月1日）が、「契約日」（2026年10月27日）より前です",
    ]);
    assert.deepEqual(findingsOf(loanJa("契約日", "2026年10月10日", "第１回お支払日", "2026年10月1日")), [
      "「第１回お支払日」（2026年10月1日）が、「契約日」（2026年10月10日）より前です",
    ]);
    assert.deepEqual(findingsOf(loanEn("Contract date", "October 10, 2026", "First payment due date", "October 1, 2026"), en), [
      '"First payment due date" October 1, 2026 is before "Contract date" October 10, 2026',
    ]);
    assert.deepEqual(findingsOf(loanEn("Contract date", "November 16, 2026", "First payment date", "November 6, 2026"), en), [
      '"First payment date" November 6, 2026 is before "Contract date" November 16, 2026',
    ]);
    assert.deepEqual(findingsOf(loanEn("Agreement date", "October 10, 2026", "First installment due", "October 1, 2026"), en), [
      '"First installment due" October 1, 2026 is before "Agreement date" October 10, 2026',
    ]);
  });

  it("契約日の後の初回お支払日、同じ日、年の無い日付は言わない", () => {
    assert.deepEqual(findingsOf(loanJa("ご契約日", "2026年10月27日", "初回お支払日", "2026年11月27日")), []);
    assert.deepEqual(findingsOf(loanJa("ご契約日", "2026年10月27日", "初回お支払日", "2026年10月27日")), []);
    assert.deepEqual(findingsOf(loanJa("ご契約日", "2026年10月27日", "初回お支払日", "10月20日")), []);
    assert.deepEqual(findingsOf(loanEn("Contract date", "November 16, 2026", "First payment date", "December 16, 2026"), en), []);
    assert.deepEqual(findingsOf(loanEn("Contract date", "November 16, 2026", "First payment date", "November 6"), en), []);
  });

  it("ローンの語と別の組の語は組まない", () => {
    assert.deepEqual(findingsOf(loanJa("ご契約日", "2026年10月1日", "登録の締切", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(loanJa("お買い上げ日", "2026年10月1日", "初回お支払日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(loanJa("掲載日", "2026年10月1日", "初回返済日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(loanJa("契約日", "2026年10月1日", "報告日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(loanJa("発行日", "2026年10月1日", "初回お支払日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(loanJa("お申込日", "2026年10月1日", "初回お支払日", "2026年9月1日")), []);
    assert.deepEqual(findingsOf(loanEn("Contract date", "October 1, 2026", "Registration deadline", "September 1, 2026"), en), []);
    assert.deepEqual(findingsOf(loanEn("Purchase date", "October 1, 2026", "First payment date", "September 1, 2026"), en), []);
    assert.deepEqual(findingsOf(loanEn("Issued", "October 1, 2026", "First payment date", "September 1, 2026"), en), []);
  });
});

const hotelJa = (checkIn: string, checkOut: string, cancel: string): string =>
  `# ご宿泊予約確認書\n\n| 項目 | 内容 |\n| --- | --- |\n| チェックイン | ${checkIn} |\n| チェックアウト | ${checkOut} |\n\n## キャンセルについて\n\n無料キャンセル期限：${cancel}\n`;

const hotelEn = (checkIn: string, checkOut: string, cancel: string): string =>
  `# Booking Confirmation\n\n| Item | Details |\n| --- | --- |\n| Check-in | ${checkIn} |\n| Check-out | ${checkOut} |\n\n## Cancellation\n\nFree cancellation until: ${cancel}\n`;

const rentalJa = (pickUpLabel: string, pickUp: string, returnLabel: string, returned: string): string =>
  `# レンタカーご予約確認\n\n${pickUpLabel}：${pickUp}\n\n${returnLabel}：${returned}\n\n車種クラス：コンパクト\n`;

const rentalEn = (pickUpLabel: string, pickUp: string, returnLabel: string, returned: string): string =>
  `# Car Rental Reservation\n\n${pickUpLabel}: ${pickUp}\n\n${returnLabel}: ${returned}\n\nCar class: Compact\n`;

const ruleLines = (source: string, adapter = ja): number[] =>
  runRules(buildDocument("a.md", source, adapter), loadRules(adapter.id), {}, false, "business/proposal")
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

describe("due-before-issue (order): 宿泊とレンタカーの予約、無料キャンセルの期限", () => {
  it("チェックインより前のチェックアウト、貸出より前の返却を指す（表の行も読む）", () => {
    assert.deepEqual(findingsOf(hotelJa("2026年11月20日 15:00から", "2026年11月19日 11:00まで", "2026年11月17日")), [
      "「チェックアウト」（2026年11月19日）が、「チェックイン」（2026年11月20日）より前です",
    ]);
    assert.deepEqual(findingsOf(hotelEn("November 20, 2026, from 3:00 PM", "November 19, 2026, by 11:00 AM", "November 17, 2026"), en), [
      '"Check-out" November 19, 2026 is before "Check-in" November 20, 2026',
    ]);
    assert.deepEqual(findingsOf(rentalJa("貸出日", "2026年12月3日", "返却日", "2026年12月2日")), [
      "「返却日」（2026年12月2日）が、「貸出日」（2026年12月3日）より前です",
    ]);
    assert.deepEqual(findingsOf(rentalJa("貸出日時", "2026年12月3日 10:00", "返却日時", "2026年12月2日 17:00")), [
      "「返却日時」（2026年12月2日）が、「貸出日時」（2026年12月3日）より前です",
    ]);
    assert.deepEqual(findingsOf(rentalEn("Pick-up", "December 3, 2026", "Drop-off", "December 2, 2026"), en), [
      '"Drop-off" December 2, 2026 is before "Pick-up" December 3, 2026',
    ]);
    assert.deepEqual(findingsOf(rentalEn("Pick-up date", "December 3, 2026", "Return date", "December 2, 2026"), en), [
      '"Return date" December 2, 2026 is before "Pick-up date" December 3, 2026',
    ]);
  });

  it("順の合った日付、同じ日、年の無い日付、日付の無い行は言わない", () => {
    assert.deepEqual(findingsOf(hotelJa("2026年11月20日", "2026年11月22日", "2026年11月17日")), []);
    assert.deepEqual(findingsOf(hotelJa("2026年11月20日", "2026年11月20日", "2026年11月20日")), []);
    assert.deepEqual(findingsOf(hotelJa("11月20日", "11月19日", "11月21日")), []);
    assert.deepEqual(findingsOf(hotelJa("15:00から", "11:00まで", "2026年11月21日")), []);
    assert.deepEqual(findingsOf(hotelEn("November 20, 2026", "November 22, 2026", "November 17, 2026"), en), []);
    assert.deepEqual(findingsOf(hotelEn("November 20, 2026", "November 20, 2026", "November 20, 2026"), en), []);
    assert.deepEqual(findingsOf(hotelEn("November 20", "November 19", "November 21"), en), []);
    assert.deepEqual(findingsOf(rentalJa("貸出", "2026年12月3日", "返却", "2026年12月6日")), []);
    assert.deepEqual(findingsOf(rentalEn("Pick-up", "December 3, 2026", "Return date", "December 6, 2026"), en), []);
  });

  it("旅の出発日と書類の返却日、注文の受け取りと返品の期限は組まない", () => {
    assert.deepEqual(findingsOf(rentalJa("出発日", "2026年12月3日", "返却日", "2026年11月20日")), []);
    assert.deepEqual(findingsOf(rentalEn("Pick-up", "December 3, 2026", "Return", "December 1, 2026"), en), []);
  });

  it("チェックインや貸出より後の無料キャンセル期限を、後に書いた期限の行で指す", () => {
    const hotel = hotelJa("2026年11月20日", "2026年11月22日", "2026年11月21日 23:59まで");
    assert.deepEqual(findingsOf(hotel), ["「チェックイン」（2026年11月20日）が、「無料キャンセル期限」（2026年11月21日）より前です"]);
    assert.deepEqual(ruleLines(hotel), [10]);
    const hotelInEnglish = hotelEn("November 20, 2026", "November 22, 2026", "November 21, 2026, 11:59 PM");
    assert.deepEqual(findingsOf(hotelInEnglish, en), ['"Check-in" November 20, 2026 is before "Free cancellation until" November 21, 2026']);
    assert.deepEqual(ruleLines(hotelInEnglish, en), [10]);
    assert.deepEqual(findingsOf("# 予約\n\n貸出：2026年12月3日\n\nキャンセル無料期限：2026年12月4日\n"), [
      "「貸出」（2026年12月3日）が、「キャンセル無料期限」（2026年12月4日）より前です",
    ]);
    assert.deepEqual(findingsOf("# Reservation\n\nPick-up: December 3, 2026\n\nCancel by: December 4, 2026\n", en), [
      '"Pick-up" December 3, 2026 is before "Cancel by" December 4, 2026',
    ]);
  });

  it("後の語の日付が下にあれば、その行で指す", () => {
    assert.deepEqual(ruleLines(listingJa("2026年10月1日", "2025年11月1日")), [8]);
    assert.deepEqual(ruleLines(hotelJa("2026年11月20日", "2026年11月19日", "2026年11月17日")), [6]);
  });

  it("別の組の語どうしは組まない", () => {
    assert.deepEqual(findingsOf("# 予約\n\nチェックアウト：2026年11月22日\n\n無料キャンセル期限：2026年11月25日\n"), []);
    assert.deepEqual(findingsOf("# 予約\n\nチェックイン：2026年11月20日\n\n返却日：2026年11月19日\n"), []);
    assert.deepEqual(findingsOf("# 予約\n\n貸出日：2026年11月20日\n\nチェックアウト：2026年11月19日\n"), []);
    assert.deepEqual(findingsOf("# Booking\n\nCheck-out: November 22, 2026\n\nFree cancellation until: November 25, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Booking\n\nCheck-in: November 20, 2026\n\nDrop-off: November 19, 2026\n", en), []);
    assert.deepEqual(findingsOf("# Booking\n\nPick-up: November 20, 2026\n\nCheck-out: November 19, 2026\n", en), []);
  });
});

const payslipJa = (periodLabel: string, period: string, payDate: string): string =>
  `# 給与明細書（架空商事株式会社）\n\n氏名：架空 太郎 様\n\n${periodLabel}：${period}\n\n支給日：${payDate}\n\n## 支給\n\n| 項目 | 金額 |\n| --- | --- |\n| 基本給 | 250,000円 |\n`;

const payslipEn = (period: string, payDate: string): string =>
  `# Payslip, Example Trading Ltd.\n\nEmployee: Alex Example\n\nPay period: ${period}\n\nPay date: ${payDate}\n\n## Earnings\n\n| Item | Amount |\n| --- | --- |\n| Base salary | $4,000.00 |\n`;

const tripJa = (departLabel: string, depart: string, returnLabel: string, returned: string): string =>
  `# 出張旅費精算書\n\n## 行程\n\n| 区分 | 日時 | 区間 |\n| --- | --- | --- |\n| ${departLabel} | ${depart} | 本社→架空駅 |\n| ${returnLabel} | ${returned} | 架空駅→本社 |\n`;

const tripEn = (departLabel: string, depart: string, returned: string): string =>
  `# Travel Expense Report\n\n## Travel\n\n| Leg | Date and time | Route |\n| --- | --- | --- |\n| ${departLabel} | ${depart} | Office to Example City |\n| Return | ${returned} | Example City to Office |\n`;

describe("due-before-issue (period, order): 給与明細の支給日、出張の帰着", () => {
  it("支給の対象期間が終わる前の支給日を指す", () => {
    assert.deepEqual(findingsOf(payslipJa("支給対象期間", "2026年9月1日〜2026年9月30日", "2026年9月25日")), [
      "「支給日」の 2026年9月25日 が、「支給対象期間」の終わり 2026年9月30日 より前です",
    ]);
    assert.deepEqual(findingsOf(payslipJa("計算期間", "2026年9月16日〜2026年10月15日", "2026年10月5日")), [
      "「支給日」の 2026年10月5日 が、「計算期間」の終わり 2026年10月15日 より前です",
    ]);
    assert.deepEqual(findingsOf(payslipJa("対象期間", "2026年9月1日〜2026年9月30日", "2026年9月25日")), [
      "「支給日」の 2026年9月25日 が、「対象期間」の終わり 2026年9月30日 より前です",
    ]);
    assert.deepEqual(findingsOf(payslipEn("September 1, 2026 – September 30, 2026", "September 25, 2026"), en), [
      '"Pay date" September 25, 2026 is before the end of the "Pay period", September 30, 2026',
    ]);
  });

  it("期間の終わりより後や同じ日の支給日、年の無い日付は言わない", () => {
    assert.deepEqual(findingsOf(payslipJa("支給対象期間", "2026年9月1日〜2026年9月30日", "2026年10月9日")), []);
    assert.deepEqual(findingsOf(payslipJa("計算期間", "2026年9月16日〜2026年10月15日", "2026年10月25日")), []);
    assert.deepEqual(findingsOf(payslipJa("支給対象期間", "2026年9月1日〜2026年9月30日", "2026年9月30日")), []);
    assert.deepEqual(findingsOf(payslipJa("支給対象期間", "9月1日〜9月30日", "9月25日")), []);
    assert.deepEqual(findingsOf(payslipEn("September 1, 2026 – September 30, 2026", "October 9, 2026"), en), []);
    assert.deepEqual(findingsOf(payslipEn("September 1 – September 30", "September 25"), en), []);
  });

  it("出発より前の帰着を指す（表の行も読む）", () => {
    assert.deepEqual(findingsOf(tripJa("出発", "2026年9月14日 8:10", "帰着", "2026年9月12日 19:40")), [
      "「帰着」（2026年9月12日）が、「出発」（2026年9月14日）より前です",
    ]);
    assert.deepEqual(findingsOf(tripJa("出発日", "2026年9月14日", "帰着日", "2026年9月12日")), [
      "「帰着日」（2026年9月12日）が、「出発日」（2026年9月14日）より前です",
    ]);
    assert.deepEqual(findingsOf(tripEn("Departure", "September 14, 2026, 8:10 AM", "September 12, 2026, 7:40 PM"), en), [
      '"Return" September 12, 2026 is before "Departure" September 14, 2026',
    ]);
    assert.deepEqual(findingsOf(tripEn("Departure date", "September 14, 2026", "September 12, 2026"), en), [
      '"Return" September 12, 2026 is before "Departure date" September 14, 2026',
    ]);
  });

  it("出発の後や同じ日（日帰り）の帰着、年の無い日付は言わない", () => {
    assert.deepEqual(findingsOf(tripJa("出発", "2026年9月14日 8:10", "帰着", "2026年9月16日 19:40")), []);
    assert.deepEqual(findingsOf(tripJa("出発", "2026年9月14日 8:10", "帰着", "2026年9月14日 21:00")), []);
    assert.deepEqual(findingsOf(tripJa("出発", "9月14日", "帰着", "9月12日")), []);
    assert.deepEqual(findingsOf(tripEn("Departure", "September 14, 2026, 8:10 AM", "September 16, 2026, 7:40 PM"), en), []);
    assert.deepEqual(findingsOf(tripEn("Departure", "September 14, 2026, 8:10 AM", "September 14, 2026, 9:00 PM"), en), []);
    assert.deepEqual(findingsOf(tripEn("Departure", "September 14", "September 12"), en), []);
  });

  it("書類の返却日と出発日、帰着と支給日のように、別の組の語どうしは組まない", () => {
    assert.deepEqual(findingsOf("# 旅行のご案内\n\n出発日：2026年12月3日\n\n返却日：2026年11月20日\n"), []);
    assert.deepEqual(findingsOf("# Tour Guide\n\nDeparture date: December 3, 2026\n\nReturn date: November 20, 2026\n", en), []);
    assert.deepEqual(findingsOf("# 精算\n\n帰着：2026年9月16日\n\n支給日：2026年9月10日\n"), []);
  });
});

const orderJa = (orderLabel: string, ordered: string, deliveryLabel: string, delivered: string): string =>
  `# 注文書\n\n発注番号：PO-0001\n\n${orderLabel}：${ordered}\n\n発注先：架空工業株式会社 御中\n\n${deliveryLabel}：${delivered}\n\n| 品名 | 数量 |\n| --- | --- |\n| 架空部品A | 10 |\n`;

const orderEn = (orderLabel: string, ordered: string, deliveryLabel: string, delivered: string): string =>
  `# Purchase Order\n\nPO number: PO-0001\n\n${orderLabel}: ${ordered}\n\nSupplier: Example Parts Ltd.\n\n${deliveryLabel}: ${delivered}\n\n| Item | Qty |\n| --- | --- |\n| Example part A | 10 |\n`;

describe("due-before-issue (order): 発注書と納品書の納期", () => {
  it("発注日より前の納期や納品日を指す", () => {
    assert.deepEqual(findingsOf(orderJa("発注日", "2026年9月14日", "納期", "2026年9月8日")), [
      "「納期」（2026年9月8日）が、「発注日」（2026年9月14日）より前です",
    ]);
    assert.deepEqual(findingsOf(orderJa("注文日", "2026年9月14日", "納品日", "2026年9月5日")), [
      "「納品日」（2026年9月5日）が、「注文日」（2026年9月14日）より前です",
    ]);
    assert.deepEqual(findingsOf(orderJa("受注日", "2026年9月14日", "納入日", "2026年9月1日")), [
      "「納入日」（2026年9月1日）が、「受注日」（2026年9月14日）より前です",
    ]);
    assert.deepEqual(findingsOf(orderEn("Order date", "September 14, 2026", "Delivery date", "September 8, 2026"), en), [
      '"Delivery date" September 8, 2026 is before "Order date" September 14, 2026',
    ]);
    assert.deepEqual(findingsOf(orderEn("PO date", "September 14, 2026", "Delivered on", "September 5, 2026"), en), [
      '"Delivered on" September 5, 2026 is before "PO date" September 14, 2026',
    ]);
  });

  it("発注日の後や同じ日の納期、年の無い日付は言わない", () => {
    assert.deepEqual(findingsOf(orderJa("発注日", "2026年9月14日", "納期", "2026年9月28日")), []);
    assert.deepEqual(findingsOf(orderJa("発注日", "2026年9月14日", "納品日", "2026年9月14日")), []);
    assert.deepEqual(findingsOf(orderJa("発注日", "9月14日", "納期", "9月8日")), []);
    assert.deepEqual(findingsOf(orderEn("Order date", "September 14, 2026", "Delivery date", "September 28, 2026"), en), []);
    assert.deepEqual(findingsOf(orderEn("Order date", "September 14", "Delivery date", "September 8"), en), []);
  });

  it("納期限や支払いの Due date は納期と読まず、別の組の語どうしは組まない", () => {
    assert.deepEqual(findingsOf(orderJa("発注日", "2026年9月14日", "納期限", "2026年9月8日")), []);
    assert.deepEqual(findingsOf(orderEn("Order date", "September 14, 2026", "Due date", "September 8, 2026"), en), []);
    assert.deepEqual(findingsOf("# 請求書\n\n納品日：2026年9月25日\n\n発行日：2026年9月30日\n"), []);
    assert.deepEqual(findingsOf("# Invoice\n\nDelivery date: September 25, 2026\n\nInvoice date: September 30, 2026\n", en), []);
    assert.deepEqual(findingsOf("# ご案内\n\n契約日：2026年9月14日\n\n納期：2026年9月8日\n"), []);
  });
});
