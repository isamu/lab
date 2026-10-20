import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isRevisionDate, revisionAnchors, revisionDatesToSkip, type DateSpan } from "../packages/chaff/src/detectors/revision-date.ts";

// ページの改定日（「更新日 2026年6月10日」）は、ページを直した日。記録が語る出来事（2025年11月の会議）より後に直したなら、
// 年の無い日付（11月5日（水曜日））の年をそこから決めない。区の会議録のページ（chaff-corpus #55）の形を写した自作の文。

/** `date` as the tree reads it: from its first character for `length` characters, with its value. */
const at = (text: string, date: string, length: number, value = ""): DateSpan => {
  const offset = text.indexOf(date);
  return { offset, end: offset + length, value };
};

const LABELS = ["更新日", "最終更新日", "Last updated", "Revised"];

describe("isRevisionDate", () => {
  [
    ["ページ番号1064222　 更新日 2026年6月10日", "2026年6月10日"],
    ["最終更新日：2026年6月10日", "2026年6月10日"],
    ["Last updated: June 10, 2026.", "June 10, 2026"],
  ].forEach(([line, date]) => {
    it(`valid: ${String(line)}`, () => assert.equal(isRevisionDate(String(line), at(String(line), String(date), String(date).length), LABELS), true));
  });

  [
    ["a date with no label", "令和7年11月11日（火曜日）午前9時", "令和7年11月11日"],
    ["a label earlier on the line, then other words", "更新日の後に、2026年6月10日に会議を開いた", "2026年6月10日"],
    ["a label on the line before", "更新日\n2026年6月10日", "2026年6月10日"],
    ["a sentence going on after the date", "The policy was Revised October 1, 2025, and takes effect later.", "October 1, 2025"],
    ["the label inside a longer word", "未更新日 2026年6月10日", "2026年6月10日"],
    ["an English label inside a word", "Unrevised 2026-06-10", "2026-06-10"],
  ].forEach(([form, text, date]) => {
    it(`invalid: ${String(form)}`, () => assert.equal(isRevisionDate(String(text), at(String(text), String(date), String(date).length), LABELS), false));
  });

  it("abnormal input: empty text, a date at the start, no labels", () => {
    assert.equal(isRevisionDate("", { offset: 0, end: 0, value: "" }, LABELS), false);
    assert.equal(isRevisionDate("2026年6月10日", { offset: 0, end: 10, value: "2026-06-10" }, LABELS), false);
    assert.equal(isRevisionDate("更新日 2026年6月10日", { offset: 4, end: 14, value: "2026-06-10" }, []), false);
  });
});

describe("revisionDatesToSkip and revisionAnchors", () => {
  const source = "更新日 2026年6月10日\n令和7年11月11日（火曜日）\n";
  const revision = at(source, "2026年", "2026年6月10日".length, "2026-06-10");
  const meeting = at(source, "令和", "令和7年11月11日".length, "2025-11-11");
  const ENTRIES = [{ pattern: "更新日", group: "updated" }];

  it("skips a revision later than every date the text writes", () => {
    assert.deepEqual([...revisionDatesToSkip(source, [revision, meeting], LABELS)], [revision.offset]);
  });

  it("keeps a revision earlier than a date the text writes (a notice announcing a later date)", () => {
    assert.deepEqual([...revisionDatesToSkip(source, [revision, { ...meeting, value: "2027-04-01" }], LABELS)], []);
  });

  it("keeps the revision date when it is the only year the page gives", () => {
    assert.deepEqual([...revisionDatesToSkip(source, [revision], LABELS)], []);
  });

  it("drops the document's date when it is the skipped revision date, and keeps any other", () => {
    assert.equal(revisionAnchors(source, [revision, meeting], ENTRIES, "2026-06-10").stamp, undefined);
    assert.equal(revisionAnchors(source, [revision, meeting], ENTRIES, "2025-11-11").stamp, "2025-11-11");
    assert.equal(revisionAnchors(source, [revision, meeting], [{ pattern: "更新日", group: "established" }], "2026-06-10").stamp, "2026-06-10");
  });
});

const MINUTES = [
  "# 令和7年度第19回連絡調整会議",
  "",
  "ページ番号1064222　 更新日 2026年6月10日",
  "",
  "## 日時",
  "",
  "令和7年11月11日（火曜日）午前9時00分から10時35分",
  "",
  "## 区長発言",
  "",
  "11月5日（水曜日）に、消防署の方々と区内の飛行調査を行った。",
  "",
  "## 資料",
  "",
  "令和7年11月18日（火曜日）資料配信",
  "",
].join("\n");

describe("date rules and a page's revision date", () => {
  it("valid: a later revision does not give the body's yearless date its weekday's year", () => {
    assert.deepEqual(namedRuleRun("date-weekday-mismatch", MINUTES, ja, "a.md", "business/meeting-notes").findings, []);
  });

  it("valid: a later revision in another year does not make the body's year unclear", () => {
    assert.deepEqual(namedRuleRun("date-without-year", MINUTES, ja, "a.md", "business/meeting-notes").findings, []);
  });

  it("invalid: dates of two years in the body still make a yearless date unclear", () => {
    const twoYears = MINUTES.replace("令和7年11月18日", "令和8年1月18日");
    assert.equal(namedRuleRun("date-without-year", twoYears, ja, "a.md", "business/meeting-notes").findings.length > 0, true);
  });

  it("invalid: a weekday wrong in the year of a revision before the text's dates is still reported", () => {
    const notice = "# 採用試験の案内\n\n更新日：2026年07月27日\n\n## 採用予定日\n\n2027年4月1日\n\n## 試験日\n\n8月30日(月曜日)\n";
    assert.equal(namedRuleRun("date-weekday-mismatch", notice, ja).findings.length, 1);
  });

  it("valid in English: a Last updated line a year after the meeting", () => {
    const page =
      "# Minutes\n\nLast updated: June 10, 2026\n\n## Date\n\nNovember 11, 2025.\n\n## Remarks\n\nOn November 5 (Wednesday), we met the fire service.\n\n## Papers\n\nSent November 18, 2025.\n";
    assert.deepEqual(namedRuleRun("date-without-year", page, en, "a.md", "business/meeting-notes").findings, []);
  });
});
