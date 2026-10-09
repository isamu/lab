import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { hyphenatedCounts } from "../packages/chaff/src/derived/hyphenated-counts.ts";

const UNITS = ["day", "days", "month", "months", "night", "nights"];

const read = (text: string, units: readonly string[] = UNITS): string[] =>
  hyphenatedCounts(text, units).map((count) => `${text.slice(count.start, count.end)}=${String(count.amount)}${count.unit}`);

describe("hyphenatedCounts", () => {
  it("reads a figure joined to its unit by a hyphen", () => {
    assert.deepEqual(read("a 3-month trial"), ["3-month=3month"]);
    assert.deepEqual(read("a 2-night, 4-day tour"), ["2-night=2night", "4-day=4day"]);
    assert.deepEqual(read("a 2‐night stay"), ["2‐night=2night"]);
    assert.deepEqual(read("a 12-Month plan"), ["12-Month=12month"]);
    assert.deepEqual(read("(3-day)"), ["3-day=3day"]);
  });

  it("reads the longest unit the text writes", () => {
    assert.deepEqual(read("for 3-days"), ["3-days=3days"]);
  });

  it("does not read a figure the unit does not end, or that sits inside a longer number or word", () => {
    assert.deepEqual(read("a 3-month-old account"), []);
    assert.deepEqual(read("3-monthly reports"), []);
    assert.deepEqual(read("3-dayz"), []);
    assert.deepEqual(read("version v2-day"), []);
    assert.deepEqual(read("2026-04-3-day"), []);
    assert.deepEqual(read("1.5-day"), []);
    assert.deepEqual(read("3 months, 3month, 3 - month"), []);
    assert.deepEqual(read("24-hour support"), []);
  });

  it("reads nothing with no units, empty units or empty text", () => {
    assert.deepEqual(read("a 3-month trial", []), []);
    assert.deepEqual(read("a 3-month trial", [""]), []);
    assert.deepEqual(read(""), []);
  });

  it("treats the unit list as literal words", () => {
    assert.deepEqual(read("a 3-d.y trial", ["d.y"]), ["3-d.y=3d.y"]);
    assert.deepEqual(read("a 3-day trial", ["d.y"]), []);
  });
});
