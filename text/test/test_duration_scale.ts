import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { scaledDuration } from "../packages/chaff/src/facts/duration-scale.ts";

// 期間を比べられる単位に揃える。年は月に直し、月と日、週と日は直さない。

describe("scaledDuration: years become months, nothing else is converted", () => {
  it("a length in years, in months", () => {
    assert.deepEqual(scaledDuration("1", "year"), { key: "12", unit: "month" });
    assert.deepEqual(scaledDuration("2", "year"), { key: "24", unit: "month" });
    assert.deepEqual(scaledDuration("1.5", "year"), { key: "18", unit: "month" });
    assert.deepEqual(scaledDuration("0.1", "year"), { key: "1.2", unit: "month" });
    assert.deepEqual(scaledDuration("0", "year"), { key: "0", unit: "month" });
  });

  it("months, weeks and days stay as written (a month is not 30 days)", () => {
    assert.deepEqual(scaledDuration("12", "month"), { key: "12", unit: "month" });
    assert.deepEqual(scaledDuration("30", "day"), { key: "30", unit: "day" });
    assert.deepEqual(scaledDuration("4", "week"), { key: "4", unit: "week" });
  });

  it("a key that is not a number is left alone", () => {
    assert.deepEqual(scaledDuration("", "year"), { key: "", unit: "year" });
    assert.deepEqual(scaledDuration("abc", "year"), { key: "abc", unit: "year" });
    assert.deepEqual(scaledDuration("Infinity", "year"), { key: "Infinity", unit: "year" });
  });
});
