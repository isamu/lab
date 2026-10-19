import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { continuesDatedRun, RUN_REACH_CHARS } from "../packages/chaff/src/detectors/date-run.ts";

// date-without-year and a yearless date that carries a dated account forward ("April 9, 1952 … On April 21, 1952, … on
// April 30 … May 12"). Every text here is self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

type Point = { readonly offset: number; readonly value: string };

/** continuesDatedRun for the last of the dates, each at the given offset. */
const continues = (...dates: (readonly [number, string])[]): boolean => {
  const points: Point[] = dates.map(([offset, value]) => ({ offset, value }));
  const last = points.at(-1);
  return last !== undefined && continuesDatedRun(last, (point) => points[points.indexOf(point) - 1]);
};

describe("continuesDatedRun", () => {
  it("reads month-and-day dates that go forward from two dated dates of one year close before them", () => {
    assert.equal(continues([0, "1952-04-09"], [80, "1952-04-21"], [500, "04-30"]), true);
    assert.equal(continues([0, "1952-04-09"], [80, "1952-04-21"], [500, "04-30"], [900, "05-03"], [950, "05-12"]), true);
    assert.equal(continues([0, "1952-04-09"], [5, "1952-04-21"], [10, "04-21"]), true);
  });

  it("does not read a date that goes back, crosses a year, is far off, or follows dated dates of different years", () => {
    assert.equal(continues([0, "1952-04-09"], [80, "1952-04-21"], [500, "04-10"]), false);
    assert.equal(continues([0, "1952-04-09"], [80, "1952-04-21"], [500, "05-03"], [900, "04-30"]), false);
    assert.equal(continues([0, "1951-12-01"], [80, "1951-12-18"], [500, "01-05"]), false);
    assert.equal(continues([0, "1952-01-01"], [80, "1952-01-02"], [500, "11-30"]), false);
    assert.equal(continues([0, "1952-04-09"], [80, "1952-04-21"], [RUN_REACH_CHARS + 81, "04-30"]), false);
    assert.equal(continues([0, "1951-04-09"], [80, "1952-04-21"], [500, "04-30"]), false);
    assert.equal(continues([0, "1952-04-21"], [500, "04-30"]), false);
    assert.equal(continues([0, "04-21"], [500, "04-30"]), false);
    assert.equal(continues([0, "1952-04"], [80, "1952-04-21"], [500, "04-30"]), false);
    assert.equal(continues([0, "1952-04-21"]), false);
  });
});

const RULE = "date-without-year";
const findingsOf = (source: string): number => namedRuleRun(RULE, `${source}\n`, en, "a.md", "legal/judgment").findings.length;

const EARLIER = "The board met on March 3, 1950, and again on June 9, 1951, and wrote its report on October 2, 1951.";
const OPENS = "The union gave notice on April 9, 1952. On April 21, 1952, the mill closed.";

describe("date-without-year and a dated account", () => {
  it("does not report the dates that carry the account forward", () => {
    assert.equal(findingsOf(`${EARLIER}\n\n${OPENS}\n\nThe court ruled on April 30, and the appeal was heard on May 12.`), 0);
  });

  it("still reports a dated column of a table with one year dropped", () => {
    const table = ["| Date | Item |", "| --- | --- |", "| April 9, 1952 | Notice |", "| April 21, 1952 | Closure |", "| April 30 | Ruling |"].join("\n");
    assert.equal(findingsOf(`${EARLIER}\n\n${table}`), 1);
  });

  it("still reports a yearless date that goes back before the dated one", () => {
    assert.equal(findingsOf(`${EARLIER}\n\n${OPENS}\n\nThe court had ruled on April 2, before the strike.`), 1);
  });
});
