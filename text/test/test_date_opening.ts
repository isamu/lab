import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { openingDateOf, type DatedSpan } from "../packages/chaff/src/detectors/opening-date.ts";
import { datelineBefore, datelines, forwardDatelines } from "../packages/chaff/src/detectors/dateline.ts";

// The document's own date in its title block, and the yearless dates it places in one year. All text is self-written.

const RULE = "date-without-year";
const MINUTES = "business/meeting-notes";

const spanOf = (source: string, text: string, value: string): DatedSpan => {
  const start = source.indexOf(text);
  return { start, end: start + text.length, value };
};

describe("openingDateOf", () => {
  const title = "        Riverside Allotment Society\n\n            Committee Minutes\n\n             March 4, 2026\n\n 1. Opening\n";
  const date = spanOf(title, "March 4, 2026", "2026-03-04");

  it("a date alone on a line of the title block is the document's date", () => {
    assert.equal(openingDateOf(title, [date], []), "2026-03-04");
  });

  it("a labelled date counts; a date inside a sentence does not", () => {
    const labelled = "Committee Minutes\nDate: 2026-03-04\n";
    assert.equal(openingDateOf(labelled, [spanOf(labelled, "2026-03-04", "2026-03-04")], ["Date"]), "2026-03-04");
    const sentence = "The committee met on March 4, 2026 in the hall.\n";
    assert.equal(openingDateOf(sentence, [spanOf(sentence, "March 4, 2026", "2026-03-04")], []), undefined);
  });

  it("a label on a line of its own takes the date below it; front matter is not the title block", () => {
    const split = "Committee Minutes\nDate:\n2026-03-04\n";
    assert.equal(openingDateOf(split, [spanOf(split, "2026-03-04", "2026-03-04")], ["Date"]), "2026-03-04");
    const front = "---\ntitle: Minutes\nauthor: Clerk\nlang: en\n---\n\n# Committee Minutes\n\nMarch 4, 2026\n";
    assert.equal(openingDateOf(front, [spanOf(front, "March 4, 2026", "2026-03-04")], []), "2026-03-04");
  });

  it("a date alone on a line below the title block is not the document's date", () => {
    const late = "One\n\nTwo\n\nThree\n\nFour\n\nFive\n\nMarch 4, 2026\n";
    assert.equal(openingDateOf(late, [spanOf(late, "March 4, 2026", "2026-03-04")], []), undefined);
    assert.equal(openingDateOf("", [], []), undefined);
  });
});

describe("date-without-year: the minutes' own date places a day and month near it", () => {
  const minutes = (body: string): string =>
    [
      "            Riverside Allotment Society",
      "",
      "               Committee Minutes",
      "",
      "                January 14, 2026",
      "",
      " 1. Reports",
      "",
      "    The shed lease, signed on March 2, 2019, was renewed on June 30, 2025.",
      `    ${body}`,
      "",
    ].join("\n");

  it("a day within a few months of the minutes' date takes its year", () => {
    assert.deepEqual(namedRuleRun(RULE, minutes("The autumn show was held on November 8th."), en, "a.txt", MINUTES).findings, []);
    assert.deepEqual(namedRuleRun(RULE, minutes("The next work day is March 7."), en, "a.txt", MINUTES).findings, []);
  });

  it("a day further from it is still unclear", () => {
    assert.deepEqual(namedRuleRun(RULE, minutes("The pond was dug on August 3."), en, "a.txt", MINUTES).findings, [
      '"August 3" has no year, and the document\'s dates run from 2019 to 2026, so the year is unclear',
    ]);
  });

  it("without the date in the title block, the near day is reported as before", () => {
    const untitled = minutes("The autumn show was held on November 8th.").replace("January 14, 2026", "Winter meeting");
    assert.equal(namedRuleRun(RULE, untitled, en, "a.txt", MINUTES).findings.length, 1);
  });

  it("a web page's date at the top is when it was posted: a near day is still reported outside the dated genres", () => {
    const page = minutes("The autumn show was held on November 8th.");
    assert.equal(namedRuleRun(RULE, page, en, "a.txt", "business/report").findings.length, 1);
    assert.deepEqual(namedRuleRun(RULE, page, en, "a.txt", "business/email").findings, []);
  });

  it("in Japanese too: 議事録の日付の近くの月日はその年", () => {
    const ja1 = "# 理事会議事録\n\n2026年1月14日\n\n倉庫の契約は2019年3月2日に結び、2025年6月30日に更新した。\n\n秋の品評会は11月8日に開いた。\n";
    assert.deepEqual(namedRuleRun(RULE, ja1, ja, "a.md", MINUTES).findings, []);
    assert.equal(namedRuleRun(RULE, ja1.replace("11月8日", "8月3日"), ja, "a.md", MINUTES).findings.length, 1);
  });
});

describe("datelines", () => {
  const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const linesOf = (source: string, dates: readonly DatedSpan[]): string[] => datelines(source, dates, weekdays).map((date) => date.value);

  it("a date alone on its line, after a weekday's name or before a short bracket, is a dateline", () => {
    const source = "WEDNESDAY, MAY 21, 2025\n\nJune 3, 2025\n\n2025年6月4日（水）\n";
    const dates = [spanOf(source, "MAY 21, 2025", "2025-05-21"), spanOf(source, "June 3, 2025", "2025-06-03"), spanOf(source, "2025年6月4日", "2025-06-04")];
    assert.deepEqual(linesOf(source, dates), ["2025-05-21", "2025-06-03", "2025-06-04"]);
  });

  it("a date with other words on its line is not", () => {
    const source = "The board met on May 21, 2025\nMAY 22, 2025 at noon\nHearing, May 23, 2025\n";
    const dates = [spanOf(source, "May 21, 2025", "2025-05-21"), spanOf(source, "MAY 22, 2025", "2025-05-22"), spanOf(source, "May 23, 2025", "2025-05-23")];
    assert.deepEqual(linesOf(source, dates), []);
    assert.deepEqual(linesOf("", []), []);
  });

  it("the last dateline before an offset governs it", () => {
    const lines = [
      { start: 10, end: 20, value: "2025-05-21" },
      { start: 100, end: 110, value: "2025-06-03" },
    ];
    assert.equal(datelineBefore(lines, 5), undefined);
    assert.equal(datelineBefore(lines, 50), "2025-05-21");
    assert.equal(datelineBefore(lines, 200), "2025-06-03");
    assert.equal(datelineBefore([], 200), undefined);
  });

  it("a dateline that goes back before the document's date or the dateline kept before it is not a sitting's", () => {
    const at = (start: number, value: string): DatedSpan => ({ start, end: start + 10, value });
    const lines = [at(10, "2023-04-04"), at(20, "2023-06-21"), at(30, "2021-12-13"), at(40, "2023-07-01")];
    assert.deepEqual(
      forwardDatelines(lines, "2023-06-21").map((line) => line.value),
      ["2023-06-21", "2023-07-01"],
    );
    assert.deepEqual(
      forwardDatelines(lines, undefined).map((line) => line.value),
      ["2023-04-04", "2023-06-21", "2023-07-01"],
    );
    assert.deepEqual(forwardDatelines([], undefined), []);
  });
});

describe("date-without-year: a date-only answer in minutes is not a dateline", () => {
  it("a report's date of last release does not move the minutes' date", () => {
    const minutes = [
      "                Board Meeting Minutes",
      "",
      "                    June 21, 2023",
      "",
      " 1. Reports",
      "",
      "### Date of last release:",
      "",
      "  2021-12-13",
      "",
      "Meetups:",
      "- On June 13th, the community held a meetup.",
      "",
    ].join("\n");
    assert.deepEqual(namedRuleRun(RULE, minutes, en, "a.txt", MINUTES).findings, []);
    assert.equal(namedRuleRun(RULE, minutes.replace("June 13th", "January 9th"), en, "a.txt", MINUTES).findings.length, 1);
  });
});

describe("date-without-year: a hearing record's dateline places a day and month near it", () => {
  const TRANSCRIPT = "speech/transcript";
  const cover = (body: string): string =>
    [
      "[House Hearing]",
      "",
      "OVERSIGHT OF THE HARBOR AUTHORITY",
      "",
      "HEARING",
      "",
      "BEFORE THE",
      "",
      "COMMITTEE ON PORTS",
      "",
      "FEBRUARY 11, 2026",
      "",
      "Serial No. 7",
      "",
      "The authority was founded on March 2, 2019, and its charter was renewed on June 30, 2025.",
      "",
      body,
      "",
    ].join("\n");

  it("a day within a few months of the cover page's date takes its year", () => {
    assert.deepEqual(namedRuleRun(RULE, cover("Mr. Reed. On January 15, I wrote to the authority."), en, "a.txt", TRANSCRIPT).findings, []);
    assert.deepEqual(namedRuleRun(RULE, cover("Mr. Reed. On December 11, the board voted."), en, "a.txt", TRANSCRIPT).findings, []);
  });

  it("a day further from it, or the same record outside the dated genres, is still reported", () => {
    assert.equal(namedRuleRun(RULE, cover("Mr. Reed. On August 3, I wrote to the authority."), en, "a.txt", TRANSCRIPT).findings.length, 1);
    assert.equal(namedRuleRun(RULE, cover("Mr. Reed. On January 15, I wrote to the authority."), en, "a.txt", "business/report").findings.length, 1);
  });

  it("each sitting's dateline governs the days said under it", () => {
    const sittings = cover(
      ["Mr. Reed. On January 15, I wrote to the authority.", "", "TUESDAY, SEPTEMBER 8, 2026", "", "Ms. Lane. On August 3, the board met."].join("\n"),
    );
    assert.deepEqual(namedRuleRun(RULE, sittings, en, "a.txt", TRANSCRIPT).findings, []);
    const before = sittings.replace("Mr. Reed. On January 15", "Mr. Reed. On August 3");
    assert.equal(namedRuleRun(RULE, before, en, "a.txt", TRANSCRIPT).findings.length, 1);
  });
});
