import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { relativeMismatches, type RelativeInput } from "../packages/chaff/src/derived/relative-dates.ts";

// A length of time that names its own start is not counted from the date before it. The ja excerpt is adapted from
// 最高裁判所 平成24年1月17日判決 (a judgment, not protected by copyright: 著作権法13条3号).

const found = (text: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", `# T\n\n${text}\n`, adapter), loadRules(language), { "relative-date-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "relative-date-mismatch")
    .map((finding) => `${String(finding.values["target"])}→${String(finding.values["expected"])}`);

const foundJa = (text: string): string[] => found(text, ja, "ja");
const foundEn = (text: string): string[] => found(text, en, "en");

describe("relative-date-mismatch: a length counted from its own start", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("two parallel computations: the second is counted from its own start, not from the first result", () => {
    assert.deepEqual(
      foundJa(
        "著作権は、谷口が死亡した年の翌年から起算して38年後の平成57年12月31日まで存続し、本件映画2の著作権も、今井が死亡した年の翌年から起算して38年後の平成41年12月31日まで存続する。",
      ),
      [],
    );
  });

  it("a start right after the date is that date, and a length with no start of its own is still checked", () => {
    assert.deepEqual(foundJa("10月2日から3日後の10月6日に結果を通知します。"), ["10月6日→10月5日"]);
    assert.deepEqual(foundJa("10月2日に申し込みを締め切り、3日後の10月6日に結果を通知します。"), ["10月6日→10月5日"]);
    assert.deepEqual(foundJa("10月2日に申し込みを締め切り、受付から3日後の10月6日に結果を通知します。"), []);
  });

  it("から in another sense, or a comma inside brackets, does not move the start", () => {
    assert.deepEqual(foundJa("10月2日に締め切り、雨だから3日後の10月6日に通知します。"), ["10月6日→10月5日"]);
    assert.deepEqual(foundJa("10月2日に締め切り、東京から大阪まで3日後の10月6日に着きます。"), ["10月6日→10月5日"]);
    assert.deepEqual(foundJa("10月2日（注、重要）受付から3日後の10月6日に通知します。"), ["10月6日→10月5日"]);
  });

  it("English is unchanged: a later date with no start of its own is checked", () => {
    assert.deepEqual(foundEn("The appeal was filed on May 1, 2026, and two weeks later, on May 20, 2026, we replied."), ["May 20, 2026→May 15, 2026"]);
  });
});

describe("relativeMismatches: the start words", () => {
  const source = "10月2日締切、受付から3日後の10月6日";
  const input = (starts: readonly string[]): RelativeInput => ({
    source,
    sentences: [{ start: 0, end: source.length }],
    dates: [
      { start: 0, end: 5, value: "10-02" },
      { start: source.indexOf("10月6日"), end: source.indexOf("10月6日") + 5, value: "10-06" },
    ],
    relatives: [{ start: source.indexOf("3日後"), end: source.indexOf("3日後") + 3, amount: 3, unit: "day", direction: 1 }],
    links: ["の"],
    starts,
  });

  it("without start words the earlier date is the base; with them it is not", () => {
    assert.equal(relativeMismatches(input([])).length, 1);
    assert.deepEqual(relativeMismatches(input(["から"])), []);
    assert.equal(relativeMismatches(input(["より"])).length, 1);
  });
});
