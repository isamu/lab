import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dayOrderOf, readableDate, type DateWords } from "../packages/chaff/src/derived/readable-date.ts";

// A date chaff computed or read into a value (2026-06-30), written for a message: 2026年6月30日, June 30, 2026, 30 June 2026.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const MONTH_WORDS = [...MONTHS, "Jan", "Feb", "Mar", "Apr", "Jun", "Jul", "Aug", "Sept", "Sep", "Oct", "Nov", "Dec"];

const en: DateWords = { language: "en", months: MONTHS, order: "month-first" };
const enDayFirst: DateWords = { ...en, order: "day-first" };
const ja: DateWords = { language: "ja", months: MONTHS, order: "month-first" };

describe("readableDate", () => {
  it("writes a full date with the month's name, month first or day first", () => {
    assert.equal(readableDate("2026-06-30", en), "June 30, 2026");
    assert.equal(readableDate("2026-06-30", enDayFirst), "30 June 2026");
  });

  it("names every month, January first", () => {
    const names = MONTHS.map((_, index) => readableDate(`2026-${String(index + 1).padStart(2, "0")}-15`, en));
    assert.deepEqual(
      names,
      MONTHS.map((name) => `${name} 15, 2026`),
    );
  });

  it("writes a single-digit day and month without the zero", () => {
    assert.equal(readableDate("2026-03-05", en), "March 5, 2026");
    assert.equal(readableDate("2026-03-05", enDayFirst), "5 March 2026");
    assert.equal(readableDate("2026-03-05", ja), "2026年3月5日");
  });

  it("writes a leap day", () => {
    assert.equal(readableDate("2028-02-29", en), "February 29, 2028");
    assert.equal(readableDate("2028-02-29", ja), "2028年2月29日");
    assert.equal(readableDate("02-29", ja), "2月29日");
  });

  it("writes a date without its year without one", () => {
    assert.equal(readableDate("10-05", en), "October 5");
    assert.equal(readableDate("10-05", enDayFirst), "5 October");
    assert.equal(readableDate("10-05", ja), "10月5日");
  });

  it("writes a year and month without a day", () => {
    assert.equal(readableDate("2026-04", en), "April 2026");
    assert.equal(readableDate("2026-04", enDayFirst), "April 2026");
    assert.equal(readableDate("2026-04", ja), "2026年4月");
  });

  it("writes Japanese in 年月日 whatever the month names and the order", () => {
    assert.equal(readableDate("2026-12-31", { language: "ja", months: [], order: "day-first" }), "2026年12月31日");
  });

  it("keeps a value that is not a date of these shapes as it is", () => {
    ["", "2026", "2026-6-30", "2026/06/30", "June 30, 2026", "2026-06-30T00:00", "abcd-ef-gh", " 2026-06-30"].forEach((value) => {
      assert.equal(readableDate(value, en), value);
      assert.equal(readableDate(value, ja), value);
    });
  });

  it("keeps a value whose month or day is out of range", () => {
    ["2026-00-10", "2026-13-01", "2026-04-00", "2026-04-32", "13-01", "2026-00"].forEach((value) => {
      assert.equal(readableDate(value, en), value);
      assert.equal(readableDate(value, ja), value);
    });
  });

  it("keeps the value in a language without twelve month names", () => {
    assert.equal(readableDate("2026-06-30", { language: "en", months: [], order: "month-first" }), "2026-06-30");
    assert.equal(readableDate("2026-06-30", { language: "en", months: MONTHS.slice(0, 11), order: "month-first" }), "2026-06-30");
  });
});

describe("dayOrderOf", () => {
  it("is day first when more written dates put the day first", () => {
    assert.equal(dayOrderOf(["1 April 2026", "31 July 2026", "April 1, 2026"], MONTH_WORDS), "day-first");
    assert.equal(dayOrderOf(["3rd March 2026"], MONTH_WORDS), "day-first");
  });

  it("is month first when more dates, or as many, put the month first", () => {
    assert.equal(dayOrderOf(["April 1, 2026", "Sept. 30, 2026", "1 April 2026"], MONTH_WORDS), "month-first");
    assert.equal(dayOrderOf(["April 1, 2026", "1 April 2026"], MONTH_WORDS), "month-first");
    assert.equal(dayOrderOf(["Friday, October 1, 2026"], MONTH_WORDS), "month-first");
  });

  it("is month first with no English date to go by", () => {
    assert.equal(dayOrderOf([], MONTH_WORDS), "month-first");
    assert.equal(dayOrderOf(["2026-04-01", "2026年4月1日", "4/1/2026", "June 2026"], MONTH_WORDS), "month-first");
    assert.equal(dayOrderOf(["1 April 2026"], []), "month-first");
  });

  it("does not read a year after the month as its day", () => {
    assert.equal(dayOrderOf(["June 2026", "1 June 2026"], MONTH_WORDS), "day-first");
  });
});
