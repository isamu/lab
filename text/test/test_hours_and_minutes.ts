import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { hoursAndMinutes } from "../packages/chaff/src/derived/hours-and-minutes.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { namedRuleRun } from "./rule-run.ts";

// A computed length in a duration message is written in hours and minutes (4時間15分, 4 hours 15 minutes), not as 4.25.

describe("hoursAndMinutes", () => {
  it("hours and minutes, whole hours, under an hour", () => {
    assert.deepEqual(hoursAndMinutes(255), { hours: 4, minutes: 15, shape: "hours-minutes" });
    assert.deepEqual(hoursAndMinutes(420), { hours: 7, minutes: 0, shape: "hours" });
    assert.deepEqual(hoursAndMinutes(45), { hours: 0, minutes: 45, shape: "minutes" });
    assert.deepEqual(hoursAndMinutes(60), { hours: 1, minutes: 0, shape: "hours" });
    assert.deepEqual(hoursAndMinutes(1350), { hours: 22, minutes: 30, shape: "hours-minutes" });
  });

  it("0 minutes is written as minutes", () => {
    assert.deepEqual(hoursAndMinutes(0), { hours: 0, minutes: 0, shape: "minutes" });
  });

  it("a part of a minute is rounded to the nearest minute, half up", () => {
    assert.deepEqual(hoursAndMinutes(19.8), { hours: 0, minutes: 20, shape: "minutes" });
    assert.deepEqual(hoursAndMinutes(90.4), { hours: 1, minutes: 30, shape: "hours-minutes" });
    assert.deepEqual(hoursAndMinutes(90.5), { hours: 1, minutes: 31, shape: "hours-minutes" });
    assert.deepEqual(hoursAndMinutes(59.5), { hours: 1, minutes: 0, shape: "hours" });
    assert.deepEqual(hoursAndMinutes(0.4), { hours: 0, minutes: 0, shape: "minutes" });
  });

  it("a length that cannot be written is undefined", () => {
    assert.equal(hoursAndMinutes(-1), undefined);
    assert.equal(hoursAndMinutes(Number.NaN), undefined);
    assert.equal(hoursAndMinutes(Number.POSITIVE_INFINITY), undefined);
  });
});

const workJa = (line: string): readonly string[] => namedRuleRun("duration-mismatch", `# 募集要項\n\n${line}\n`, ja).findings;
const workEn = (line: string): readonly string[] => namedRuleRun("duration-mismatch", `# Job posting\n\n${line}\n`, en).findings;
const sessionsJa = (line: string): readonly string[] => namedRuleRun("duration-product-mismatch", `# シラバス\n\n${line}\n`, ja).findings;
const sessionsEn = (line: string): readonly string[] => namedRuleRun("duration-product-mismatch", `# Syllabus\n\n${line}\n`, en).findings;

describe("duration messages write the computed length in hours and minutes", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("working hours (ja)", () => {
    assert.deepEqual(workJa("| 勤務時間 | 10:00〜15:00（休憩45分）実働4時間45分 |"), ["10:00から15:00まで、休憩45分を除くと4時間15分のはずですが、4時間45分と書かれています"]);
    assert.deepEqual(workJa("勤務時間：9:00〜18:00（休憩60分）実働7時間"), ["9:00から18:00まで、休憩60分を除くと8時間のはずですが、7時間と書かれています"]);
    assert.deepEqual(workJa("勤務時間：9:00〜9:50（休憩15分）実働1時間"), ["9:00から9:50まで、休憩15分を除くと35分のはずですが、1時間と書かれています"]);
  });

  it("working hours (en): an adjectival break reads as a quote, and 1 is singular", () => {
    assert.deepEqual(workEn("Hours: 10:00–15:00 with a 45-minute break, 4 hours 45 minutes a day"), [
      "10:00 to 15:00 less the break (45-minute) makes 4 hours 15 minutes, but 4 hours 45 minutes is written",
    ]);
    assert.deepEqual(workEn("Hours: 9:00–18:00 with a 60-minute break, 7 hours a day"), [
      "9:00 to 18:00 less the break (60-minute) makes 8 hours, but 7 hours is written",
    ]);
    assert.deepEqual(workEn("Hours: 9:00–10:31 with a break of 30 minutes, 2 hours a day"), [
      "9:00 to 10:31 less the break (30 minutes) makes 1 hour 1 minute, but 2 hours is written",
    ]);
    assert.deepEqual(workEn("Hours: 9:00–9:50 with a 15-minute break, 1 hour a day"), ["9:00 to 9:50 less the break (15-minute) makes 35 minutes, but 1 hour is written"]);
  });

  it("sessions times a length", () => {
    assert.deepEqual(sessionsJa("講座は90分×15回（計24時間）です。"), ["90分×15回なら合計は22時間30分のはずですが、24時間と書かれています"]);
    assert.deepEqual(sessionsJa("講座は15分×3回（計1時間）です。"), ["15分×3回なら合計は45分のはずですが、1時間と書かれています"]);
    assert.deepEqual(sessionsEn("The course runs 15 sessions of 90 minutes (24 hours in total)."), [
      "15 sessions of 90 minutes make 22 hours 30 minutes, but the total is given as 24 hours",
    ]);
    assert.deepEqual(sessionsEn("4 sessions of 15 minutes (2 hours in total)."), ["4 sessions of 15 minutes make 1 hour, but the total is given as 2 hours"]);
  });

  it("hours that add up stay silent", () => {
    assert.deepEqual(workJa("勤務時間：10:00〜15:00（休憩45分）実働4時間15分"), []);
    assert.deepEqual(workEn("Hours: 10:00–15:00 with a 45-minute break, 4 hours 15 minutes a day"), []);
  });
});
