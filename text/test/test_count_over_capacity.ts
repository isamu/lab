import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { comparableGroup, overCapacity, sectionAround, type LabelledCount } from "../packages/chaff/src/structure/capacity-count.ts";

// 定員より多い申込の人数（count-over-capacity）。語の付いた人の数だけを比べる。

const findings = (source: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(language), { "count-over-capacity": "normal" }, false, "business/email")
    .findings.filter((finding) => finding.rule === "count-over-capacity")
    .map((finding) => `${String(finding.values["capacity"])}<${String(finding.values["count"])}`);

const overJa = (...paragraphs: string[]): string[] => findings(paragraphs.join("\n\n"), ja, "ja");
const overEn = (...paragraphs: string[]): string[] => findings(paragraphs.join("\n\n"), en, "en");

const reading = (value: number, unit?: string): LabelledCount => ({ start: 0, end: 0, value, unit, line: "" });

before(async () => {
  await ja.prepare?.({ pos: true });
});

describe("overCapacity and comparableGroup", () => {
  it("returns the largest count over the one capacity", () => {
    const found = overCapacity([reading(30, "head")], [reading(31, "head"), reading(45, "head"), reading(20, "head")]);
    assert.equal(found?.over.value, 45);
  });

  it("says nothing for a count equal to or under the capacity, or with no capacity", () => {
    assert.equal(overCapacity([reading(30, "head")], [reading(30, "head"), reading(29, "head")]), undefined);
    assert.equal(overCapacity([], [reading(45, "head")]), undefined);
  });

  it("does not compare when the document states two capacities, but repeats of one value are one", () => {
    assert.equal(overCapacity([reading(30, "head"), reading(50, "head")], [reading(45, "head")]), undefined);
    assert.notEqual(overCapacity([reading(30, "head"), reading(30, "head")], [reading(45, "head")]), undefined);
  });

  it("compares seats with people and a bare number with people, but not parties with people", () => {
    assert.equal(comparableGroup("place"), "head");
    assert.equal(comparableGroup(undefined), "head");
    assert.notEqual(overCapacity([reading(90, "place")], [reading(95, "head")]), undefined);
    assert.equal(overCapacity([reading(30, "party")], [reading(45, "head")]), undefined);
  });

  it("sectionAround takes the smallest section holding the offset, and the whole text without sections", () => {
    const text = "aaaa bbbb cccc";
    assert.equal(
      sectionAround(text, 6, [
        { start: 0, end: 14 },
        { start: 5, end: 9 },
      ]),
      "bbbb",
    );
    assert.equal(sectionAround(text, 6, []), text);
  });
});

describe("count-over-capacity: Japanese", () => {
  it("reports a capacity smaller than a number registered, in the same line or another section", () => {
    assert.deepEqual(overJa("工作教室は事前申込制で、定員は25名です。すでに28名のお申し込みがありました。"), ["25名<28名"]);
    assert.deepEqual(overJa("## 概要", "定員：90名（先着順）", "## お申し込み", "11月6日現在、95名の方にお申し込みいただいております。"), ["90名<95名"]);
    assert.deepEqual(overJa("先着30名", "申込45名"), ["30名<45名"]);
    assert.deepEqual(overJa("定員30名", "招待者40名"), ["30名<40名"]);
  });

  it("says nothing when the number is within the capacity", () => {
    assert.deepEqual(overJa("定員：120名（先着順）", "95名の方にお申し込みいただいております。"), []);
  });

  it("says nothing when a waiting list or a ballot is mentioned in the section", () => {
    assert.deepEqual(overJa("定員30名。定員を超えた場合はキャンセル待ちとなります。", "現在45名の申し込みがあります。"), []);
    assert.deepEqual(overJa("定員30名（応募多数の場合は抽選）", "応募者45名"), []);
  });

  it("still compares when a raffle is in another section", () => {
    assert.deepEqual(overJa("## 予定", "14:30 抽選会", "## 教室", "定員は25名です。すでに28名のお申し込みがありました。"), ["25名<28名"]);
  });

  it("says nothing for a capacity per session against an overall count", () => {
    assert.deepEqual(overJa("各回定員20名", "申込45名"), []);
  });

  it("says nothing for last year's numbers", () => {
    assert.deepEqual(overJa("定員100名", "昨年は120名の方にお申し込みいただきました。"), []);
  });

  it("says nothing for counts of different things or without a word", () => {
    assert.deepEqual(overJa("定員30組", "申込45名"), []);
    assert.deepEqual(overJa("定員30名", "申込45件"), []);
    assert.deepEqual(overJa("定員30名", "会員は45名です。"), []);
  });

  it("says nothing when the document states two capacities", () => {
    assert.deepEqual(overJa("午前の部　定員30名", "午後の部　定員50名", "申込45名"), []);
  });
});

describe("count-over-capacity: English", () => {
  it("reports a capacity smaller than a number registered", () => {
    assert.deepEqual(overEn("Capacity: 90 seats, first come, first served", "As of November 6, 95 members have registered."), ["90 seats<95 members"]);
    assert.deepEqual(overEn("Places in the workshop must be booked in advance, and there are 25 places. By 29 October, 28 children had already booked."), [
      "25 places<28 children",
    ]);
    assert.deepEqual(overEn("The dinner is limited to 30 people.", "45 people have registered so far."), ["30 people<45 people"]);
  });

  it("says nothing when the number is within the capacity", () => {
    assert.deepEqual(overEn("Capacity: 120 seats", "95 members have registered."), []);
  });

  it("says nothing with a waitlist, a capacity per session, or last year's numbers", () => {
    assert.deepEqual(overEn("Capacity: 30 people. Further registrations join the waitlist.", "45 people have registered."), []);
    assert.deepEqual(overEn("Capacity: 20 people per session.", "45 people have registered."), []);
    assert.deepEqual(overEn("Capacity: 100 people.", "Last year 120 people registered."), []);
  });

  it("does not read a number of people who have not registered, nor parking spaces as places", () => {
    assert.deepEqual(overEn("Capacity: 30 people.", "45 people have not registered."), []);
    assert.deepEqual(overEn("Floor plan: there are 25 spaces in the parking lot.", "45 people have registered for the seminar."), []);
    assert.deepEqual(overJa("定員30名", "45名が登録していません。"), []);
  });

  it('does not read "there are" without a unit of places, or a capacity of other things', () => {
    assert.deepEqual(overEn("There are 30 people on the committee.", "45 people have registered."), []);
    assert.deepEqual(overEn("The car park has a capacity of 30 cars.", "45 people have registered."), []);
    assert.deepEqual(overEn("Capacity: 30 groups.", "45 people have registered."), []);
  });
});
