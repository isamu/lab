import { before, describe, it } from "node:test";
import assert from "node:assert/strict";
import { namedRuleRun } from "./rule-run.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { repeatsDatedDay } from "../packages/chaff/src/detectors/date-repeated-day.ts";

// date-without-year and a yearless date that names again a day the text gave with its year earlier. Every text here is
// self-written.

before(async () => {
  await en.prepare?.({ pos: true });
});

describe("repeatsDatedDay", () => {
  it("reads a month and day given with one year before it", () => {
    assert.equal(repeatsDatedDay({ offset: 90, value: "01-16" }, [{ offset: 10, value: "2027-01-16" }]), true);
    assert.equal(
      repeatsDatedDay({ offset: 90, value: "01-16" }, [
        { offset: 10, value: "2027-01-16" },
        { offset: 40, value: "2027-01-16" },
      ]),
      true,
    );
  });

  it("does not read a day given in two years, only after it, or not at all", () => {
    const twoYears = [
      { offset: 10, value: "2026-01-16" },
      { offset: 40, value: "2027-01-16" },
    ];
    assert.equal(repeatsDatedDay({ offset: 90, value: "01-16" }, twoYears), false);
    assert.equal(repeatsDatedDay({ offset: 5, value: "01-16" }, [{ offset: 10, value: "2027-01-16" }]), false);
    assert.equal(repeatsDatedDay({ offset: 90, value: "01-17" }, [{ offset: 10, value: "2027-01-16" }]), false);
    assert.equal(repeatsDatedDay({ offset: 90, value: "01-16" }, []), false);
    assert.equal(repeatsDatedDay({ offset: 90, value: "01-16" }, [{ offset: 10, value: "2027-01" }]), false);
  });
});

const RULE = "date-without-year";
const findingsOf = (source: string): number => namedRuleRun(RULE, `${source}\n`, en, "a.md", "business/press-release").findings.length;

const OPENING = "Released November 24, 2026. The museum will open the show on Saturday, January 16, 2027. It runs through May 31, 2027.";

describe("date-without-year and a day named again", () => {
  it("does not report a yearless date that repeats a dated day", () => {
    assert.equal(findingsOf(`${OPENING}\n\n## Opening Day\n\nThe show opens at 10 a.m. on Saturday, January 16.`), 0);
  });

  it("still reports a yearless date that names another day", () => {
    assert.equal(findingsOf(`${OPENING}\n\n## Opening Day\n\nA preview is held on January 9.`), 1);
  });
});
