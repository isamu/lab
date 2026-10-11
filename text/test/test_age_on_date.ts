import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  ageMismatches,
  ageOn,
  agesIn,
  labelAfter,
  labelBefore,
  type AgeWords,
  type LabelledBirth,
  type LabelledReference,
} from "../packages/chaff/src/derived/age-on-date.ts";

describe("ageOn: the exact age on a date", () => {
  it("is one less until the birthday and the full age from the birthday on", () => {
    assert.equal(ageOn("1978-04-12", "2026-04-11"), 47);
    assert.equal(ageOn("1978-04-12", "2026-04-12"), 48);
    assert.equal(ageOn("1978-04-12", "2026-12-31"), 48);
    assert.equal(ageOn("1978-12-31", "2026-01-01"), 47);
    assert.equal(ageOn("2026-04-12", "2026-04-12"), 0);
  });

  it("counts a 29 February birth from 1 March in a common year and is undecided on 28 February", () => {
    assert.equal(ageOn("2000-02-29", "2026-02-28"), undefined);
    assert.equal(ageOn("2000-02-29", "2026-03-01"), 26);
    assert.equal(ageOn("2000-02-29", "2026-02-27"), 25);
    assert.equal(ageOn("2000-02-29", "2028-02-28"), 27);
    assert.equal(ageOn("2000-02-29", "2028-02-29"), 28);
    assert.equal(ageOn("2000-02-29", "2100-02-28"), undefined);
    assert.equal(ageOn("2000-02-29", "2000-02-29"), 0);
  });

  it("is undefined for a date with no year, a malformed value, or a date before the birth", () => {
    assert.equal(ageOn("04-12", "2026-04-12"), undefined);
    assert.equal(ageOn("1978-04-12", "04-12"), undefined);
    assert.equal(ageOn("1978", "2026-04-12"), undefined);
    assert.equal(ageOn("1978-04", "2026-04-12"), undefined);
    assert.equal(ageOn("", ""), undefined);
    assert.equal(ageOn("not a date", "2026-04-12"), undefined);
    assert.equal(ageOn("2026-04-12", "2026-04-11"), undefined);
  });
});

const JA_WORDS: AgeWords = { before: [], after: ["歳", "才"], skip: [], approximateBefore: ["約"], approximateAfter: ["前後", "程度"] };
const EN_WORDS: AgeWords = { before: ["age", "aged"], after: ["old"], skip: ["year", "years"], approximateBefore: ["about"], approximateAfter: ["or so"] };

const ages = (text: string, words: AgeWords): string[] =>
  agesIn(text, words).map((age) => `${text.slice(age.start, age.end)}=${String(age.amount)}${age.approximate ? "~" : ""}`);

describe("agesIn: ages written on a line", () => {
  it("reads N歳, 満N歳, full-width digits, age N, aged N and N years old", () => {
    assert.deepEqual(ages("（受診時 48歳）", JA_WORDS), ["48歳=48"]);
    assert.deepEqual(ages("（満48才）", JA_WORDS), ["48才=48"]);
    assert.deepEqual(ages("（４８歳）", JA_WORDS), ["４８歳=48"]);
    assert.deepEqual(ages(" (age 57)", EN_WORDS), ["57=57"]);
    assert.deepEqual(ages(", aged 57,", EN_WORDS), ["57=57"]);
    assert.deepEqual(ages(", 57 years old", EN_WORDS), ["57 years old=57"]);
  });

  it("marks an approximate age", () => {
    assert.deepEqual(ages("（約48歳）", JA_WORDS), ["48歳=48~"]);
    assert.deepEqual(ages("（48歳前後）", JA_WORDS), ["48歳=48~"]);
    assert.deepEqual(ages(" (about age 57)", EN_WORDS), ["57=57~"]);
    assert.deepEqual(ages(" (57 years old or so)", EN_WORDS), ["57 years old=57~"]);
  });

  it("marks one side of a range of ages", () => {
    assert.deepEqual(ages(" (age 59-60)", EN_WORDS), ["59=59~"]);
    assert.deepEqual(ages(" (59 to 60 years old)", EN_WORDS), ["60 years old=60~"]);
    assert.deepEqual(ages("（59〜60歳）", JA_WORDS), ["60歳=60~"]);
  });

  it("does not read a number without an age word, a longer number, or a word ending in age", () => {
    assert.deepEqual(ages("（48）", JA_WORDS), []);
    assert.deepEqual(ages("（1234歳）", JA_WORDS), []);
    assert.deepEqual(ages("（4.5歳）", JA_WORDS), []);
    assert.deepEqual(ages(" (stage 3)", EN_WORDS), []);
    assert.deepEqual(ages(" (57 years)", EN_WORDS), []);
    assert.deepEqual(ages("", EN_WORDS), []);
  });
});

describe("labelBefore / labelAfter: the label of a date", () => {
  const labels = [
    { pattern: "受診日", group: "exam" },
    { pattern: "examination date", group: "exam" },
    { pattern: "時点", position: "after" as const, group: "base" },
  ];

  it("reads a label before the date, past separators", () => {
    assert.equal(labelBefore("受診日：", labels)?.pattern, "受診日");
    assert.equal(labelBefore("| **受診日** | ", labels)?.pattern, "受診日");
    assert.equal(labelBefore("Examination Date: ", labels)?.pattern, "examination date");
  });

  it("does not read a label inside a longer word or before other words", () => {
    assert.equal(labelBefore("前回受診日：", labels), undefined);
    assert.equal(labelBefore("受診日は", labels), undefined);
    assert.equal(labelBefore("", labels), undefined);
    assert.equal(labelBefore("時点：", labels), undefined);
    assert.equal(labelBefore("Previous examination date: ", labels), undefined);
    assert.equal(labelBefore("Patient: X; Examination date: ", labels)?.pattern, "examination date");
  });

  it("reads a label right after an age only when the age words are given", () => {
    const asOf = [{ pattern: "as of", group: "base" }];
    assert.equal(labelBefore("(age 23 as of ", asOf, EN_WORDS)?.pattern, "as of");
    assert.equal(labelBefore("(aged 23 years old as of ", asOf, EN_WORDS)?.pattern, "as of");
    assert.equal(labelBefore("(age 23 as of ", asOf), undefined);
    assert.equal(labelBefore("(page 23 as of ", asOf, EN_WORDS), undefined);
    assert.equal(labelBefore("(23 as of ", asOf, EN_WORDS), undefined);
    assert.equal(labelBefore("(age 23, valid as of ", asOf, EN_WORDS), undefined);
  });

  it("reads a label after the date", () => {
    assert.equal(labelAfter("時点の結果", labels)?.pattern, "時点");
    assert.equal(labelAfter(" 時点", labels)?.pattern, "時点");
    assert.equal(labelAfter("の時点", labels), undefined);
    assert.equal(labelAfter("", labels), undefined);
  });
});

const birth = (value: string, amount: number, group?: string): LabelledBirth => ({
  start: 0,
  end: 1,
  birth: value,
  age: { start: 2, end: 3, amount, approximate: false },
  group,
});
const reference = (date: string, group: string): LabelledReference => ({ start: 10, end: 11, date, group });
const expected = (births: LabelledBirth[], references: LabelledReference[]): number[] => ageMismatches(births, references).map((verdict) => verdict.expected);

describe("ageMismatches: the date the age is counted on", () => {
  it("reports an age that differs from the age on the one labelled date, and not a matching one", () => {
    assert.deepEqual(expected([birth("1978-04-12", 46)], [reference("2026-10-08", "exam")]), [48]);
    assert.deepEqual(expected([birth("1978-04-12", 48)], [reference("2026-10-08", "exam")]), []);
  });

  it("uses the dates of the group the age names when there are any", () => {
    const references = [reference("2026-04-01", "exam"), reference("2026-04-30", "report")];
    assert.deepEqual(expected([birth("1978-04-12", 48, "exam")], references), [47]);
    assert.deepEqual(expected([birth("1978-04-12", 47, "report")], references), [48]);
    assert.deepEqual(expected([birth("1978-04-12", 40, "base")], references), []);
  });

  it("is silent when the labelled dates give different ages, or one group has two dates", () => {
    assert.deepEqual(expected([birth("1978-04-12", 40)], [reference("2026-04-01", "exam"), reference("2026-04-30", "report")]), []);
    assert.deepEqual(expected([birth("1978-04-12", 40)], [reference("2026-09-01", "exam"), reference("2026-09-30", "report")]), [48]);
    assert.deepEqual(expected([birth("1978-04-12", 40, "exam")], [reference("2026-09-01", "exam"), reference("2026-09-02", "exam")]), []);
  });

  it("is silent with no date, an approximate age, or an undecided age", () => {
    assert.deepEqual(expected([birth("1978-04-12", 40)], []), []);
    assert.deepEqual(
      expected([{ ...birth("1978-04-12", 40), age: { start: 2, end: 3, amount: 40, approximate: true } }], [reference("2026-09-01", "exam")]),
      [],
    );
    assert.deepEqual(expected([birth("2000-02-29", 30)], [reference("2026-02-28", "exam")]), []);
    assert.deepEqual(expected([birth("04-12", 30)], [reference("2026-02-28", "exam")]), []);
  });
});
