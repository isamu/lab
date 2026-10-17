import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { openingDateOf, type DatedSpan } from "../packages/chaff/src/detectors/opening-date.ts";

// The document's own date in its title block, and the yearless dates it places in one year. All text is self-written.

const RULE = "date-without-year";

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
    assert.deepEqual(namedRuleRun(RULE, minutes("The autumn show was held on November 8th."), en, "a.txt").findings, []);
    assert.deepEqual(namedRuleRun(RULE, minutes("The next work day is March 7."), en, "a.txt").findings, []);
  });

  it("a day further from it is still unclear", () => {
    assert.deepEqual(namedRuleRun(RULE, minutes("The pond was dug on August 3."), en, "a.txt").findings, [
      '"August 3" has no year, and the document\'s dates run from 2019 to 2026, so the year is unclear',
    ]);
  });

  it("without the date in the title block, the near day is reported as before", () => {
    const untitled = minutes("The autumn show was held on November 8th.").replace("January 14, 2026", "Winter meeting");
    assert.equal(namedRuleRun(RULE, untitled, en, "a.txt").findings.length, 1);
  });

  it("in Japanese too: 議事録の日付の近くの月日はその年", () => {
    const ja1 = "# 理事会議事録\n\n2026年1月14日\n\n倉庫の契約は2019年3月2日に結び、2025年6月30日に更新した。\n\n秋の品評会は11月8日に開いた。\n";
    assert.deepEqual(namedRuleRun(RULE, ja1, ja).findings, []);
    assert.equal(namedRuleRun(RULE, ja1.replace("11月8日", "8月3日"), ja).findings.length, 1);
  });
});
