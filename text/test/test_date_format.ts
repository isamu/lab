import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { dateGroups, dateMinority, datesIn, opensLine, type WrittenDate } from "../packages/chaff/src/date-format.ts";

// 日付の書き方の揃い（date-format-consistency）。例文はすべて自作。

const mixed = (source: string, adapter = ja): readonly string[] => namedRuleRun("date-format-consistency", `${source}\n`, adapter).findings;

const WORDS = { months: ["October", "Oct"], eras: ["令和"] };
const stylesIn = (text: string): string[] => datesIn(text, WORDS).map((date) => `${date.style}:${date.written}`);

describe("date-format-consistency: 日付の書き方の揃い", () => {
  it("少ないほうの書き方の日付を指す", () => {
    assert.deepEqual(mixed("申込は2026年10月2日に始まり、2026年10月9日に締め切ります。結果は2026/10/16に通知します。"), [
      "日付「2026/10/16」の書き方が、この文書のほかの日付（「2026年10月2日」など 2 箇所）と違います",
    ]);
    assert.deepEqual(mixed("Registration opens on October 2, 2026 and closes on October 9, 2026. Results are sent on 10/16/2026.", en), [
      'The date "10/16/2026" is written differently from 2 other dates in the document (such as "October 2, 2026")',
    ]);
  });

  it("一つの書き方、同数、使い分け（少ないほうが三分の一を超える）は指さない", () => {
    assert.deepEqual(mixed("申込は2026年10月2日に始まり、2026年10月9日に締め切ります。"), []);
    assert.deepEqual(mixed("申込は2026年10月2日に始まり、2026/10/9に締め切ります。"), []);
    assert.deepEqual(mixed("2026年10月2日、2026年10月3日、2026/10/4、2026/10/5、2026年10月6日。"), []);
  });

  it("予定表の行の頭の日付と、文の中の日付は別に比べる", () => {
    const minutes = [
      "The next meeting is on 21 October 2026. We met on 14 October 2026.",
      "",
      "- 2026-10-16: Ito shares the plan.",
      "- 2026-10-21: Suzuki sends the draft.",
      "- 2026-10-28: Takahashi books the room.",
    ].join("\n");
    assert.deepEqual(mixed(minutes, en), []);
    assert.equal(mixed(`${minutes}\n- October 30, 2026: Sato reviews.\n- 2026-11-04: Ito reports.`, en).length, 1);
  });

  it("URL とコードの中の日付は数えない", () => {
    assert.deepEqual(mixed("記事は https://example.com/2026/10/02/ にあります。2026年10月2日と2026年10月3日に更新しました。"), []);
    assert.deepEqual(mixed("2026年10月2日と2026年10月3日に、`2026-10-04` の版を出しました。"), []);
  });
});

describe("datesIn: 日付と書き方", () => {
  it("reads each style with a year, a month and a day", () => {
    assert.deepEqual(stylesIn("2026-10-02, 2026/10/2, 2026.10.02, 10/2/2026, 25/12/2026, 2026年10月2日, ２０２６年１０月２日, 令和8年10月2日"), [
      "iso:2026-10-02",
      "year-slash:2026/10/2",
      "year-dot:2026.10.02",
      "slash-year-last:10/2/2026",
      "slash-year-last:25/12/2026",
      "nen-gappi:2026年10月2日",
      "nen-gappi:２０２６年１０月２日",
      "era:令和8年10月2日",
    ]);
    assert.deepEqual(stylesIn("２０２６-１０-０２ と ２０２６／１０／０２"), ["iso:２０２６-１０-０２", "year-slash:２０２６／１０／０２"]);
    assert.deepEqual(stylesIn("On Oct. 2, 2026 and 2 October 2026."), ["month-day-year:Oct. 2, 2026", "day-month-year:2 October 2026"]);
  });

  it("not a date: no day, a month or day out of range, a version, a URL, the empty string", () => {
    assert.deepEqual(stylesIn("2026年10月, 10月2日, October 2026, 2026-13-02, 2026.10.45, 1.2026.10.1, /2026/10/02/, may 2, 2026"), []);
    assert.deepEqual(stylesIn(""), []);
    assert.deepEqual(stylesIn("2026-10-02T12:00:00Z, report-2026-10-02.pdf, 2026-10-02.pdf, Oct 99, 2026"), []);
  });
});

describe("dateMinority", () => {
  const date = (style: string, at: number): WrittenDate => ({ offset: at, written: `${style}${String(at)}`, style });

  it("the minority within the limit, with the majority's first date and count", () => {
    const found = dateMinority([date("iso", 0), date("iso", 1), date("slash", 2)], 34);
    assert.deepEqual(found, { odd: [date("slash", 2)], majority: date("iso", 0), count: 2, total: 3 });
  });

  it("a minority exactly at the limit is reported", () => {
    assert.equal(dateMinority([date("iso", 0), date("iso", 1), date("iso", 2), date("slash", 3)], 25)?.odd.length, 1);
  });

  it("nothing on a tie, a single style, or a minority over the limit", () => {
    assert.equal(dateMinority([date("iso", 0), date("slash", 1)], 50), undefined);
    assert.equal(dateMinority([date("iso", 0), date("iso", 1)], 34), undefined);
    assert.equal(dateMinority([date("iso", 0), date("slash", 1), date("dot", 2)], 100), undefined);
    assert.equal(dateMinority([date("iso", 0), date("iso", 1), date("slash", 2)], 33), undefined);
    assert.equal(dateMinority([], 34), undefined);
    assert.equal(dateMinority([date("iso", 0), date("iso", 1), date("slash", 2), date("slash", 3)], 100), undefined);
  });
});

describe("opensLine and dateGroups", () => {
  it("a date at the head of a list item, a numbered item, a table cell or a line", () => {
    const text = "- 2026-10-16 a\n1. 2026-10-17 b\n| 2026-10-18 | c |\n2026-10-19 d\nOn 2026-10-20 e";
    const heads = datesIn(text, WORDS).map((date) => opensLine(text, date.offset));
    assert.deepEqual(heads, [true, true, true, true, false]);
    assert.deepEqual(
      dateGroups(text, datesIn(text, WORDS)).map((group) => group.length),
      [4, 1],
    );
    assert.deepEqual(dateGroups("", []), []);
  });
});
