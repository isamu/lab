import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { deadlineDate, deadlineVerdict, type DeadlineMarks } from "../packages/chaff/src/structure/term-deadline.ts";

// 文書の仕事の期間（開講期間、Term）と締め切りの日付を比べた結果。語の有無は呼ぶ側が読む。

const ACROSS_YEARS = { start: "2026-10-06", end: "2027-02-05" };
const ONE_YEAR = { start: "2026-04-08", end: "2026-07-28" };
const NO_YEAR = { start: "10-06", end: "02-05" };
const DEADLINE: DeadlineMarks = { deadline: true, aside: false, afterTerm: false };

describe("term deadline: the deadline's date", () => {
  it("a date with a year is kept as it is", () => {
    assert.equal(deadlineDate("2027-02-12", ACROSS_YEARS), "2027-02-12");
    assert.equal(deadlineDate("2027-02-12", NO_YEAR), "2027-02-12");
  });

  it("a date without a year takes the year of a term that lies within one year", () => {
    assert.equal(deadlineDate("08-10", ONE_YEAR), "2026-08-10");
    assert.equal(deadlineDate("03-20", ONE_YEAR), "2026-03-20");
  });

  it("no year for a term across two years, a term without a year, or a value that is not a day", () => {
    assert.equal(deadlineDate("02-12", ACROSS_YEARS), undefined);
    assert.equal(deadlineDate("02-12", NO_YEAR), undefined);
    assert.equal(deadlineDate("2027-02", ACROSS_YEARS), undefined);
    assert.equal(deadlineDate("", ONE_YEAR), undefined);
    assert.equal(deadlineDate("08-10", { start: "2026-04-08", end: "" }), undefined);
  });
});

describe("term deadline: the verdict", () => {
  it("late: a deadline after the term's end, with a year or the term's one year", () => {
    assert.equal(deadlineVerdict("2027-02-12", ACROSS_YEARS, DEADLINE), "late");
    assert.equal(deadlineVerdict("2027-02-06", ACROSS_YEARS, DEADLINE), "late");
    assert.equal(deadlineVerdict("08-10", ONE_YEAR, DEADLINE), "late");
  });

  it("within the term, its ends included, and before it starts", () => {
    assert.equal(deadlineVerdict("2027-01-29", ACROSS_YEARS, DEADLINE), "within");
    assert.equal(deadlineVerdict("2027-02-05", ACROSS_YEARS, DEADLINE), "within");
    assert.equal(deadlineVerdict("2026-10-06", ACROSS_YEARS, DEADLINE), "within");
    assert.equal(deadlineVerdict("2026-09-30", ACROSS_YEARS, DEADLINE), "before");
    assert.equal(deadlineVerdict("03-20", ONE_YEAR, DEADLINE), "before");
  });

  it("no year to compare: a date without a year in a term across two years, or a term without a year", () => {
    assert.equal(deadlineVerdict("02-12", ACROSS_YEARS, DEADLINE), "no-year");
    assert.equal(deadlineVerdict("2027-03-01", NO_YEAR, DEADLINE), "no-year");
  });

  it("not a deadline, work that may fall after the term (grades released, resits), and a date kept outside on purpose", () => {
    assert.equal(deadlineVerdict("2027-03-10", ACROSS_YEARS, { ...DEADLINE, deadline: false }), "not-deadline");
    assert.equal(deadlineVerdict("2027-03-10", ACROSS_YEARS, { ...DEADLINE, afterTerm: true }), "after-term");
    assert.equal(deadlineVerdict("2027-03-10", ACROSS_YEARS, { ...DEADLINE, aside: true }), "aside");
    assert.equal(deadlineVerdict("2027-03-10", ACROSS_YEARS, { deadline: false, aside: true, afterTerm: true }), "not-deadline");
  });
});
