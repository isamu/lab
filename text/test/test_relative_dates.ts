import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 相対で書いた日付（relative-date-mismatch）。「3日後の10月5日」を、基準の日付に期間を足した日と比べる。

const found = (text: string, adapter: LanguageAdapter, language: string): string[] =>
  runRules(buildDocument("t.md", `# T\n\n${text}\n`, adapter), loadRules(language), { "relative-date-mismatch": "normal" }, false, "business/report")
    .findings.filter((finding) => finding.rule === "relative-date-mismatch")
    .map((finding) => `${String(finding.values["target"])}→${String(finding.values["expected"])}`);

const foundJa = (text: string): string[] => found(text, ja, "ja");
const foundEn = (text: string): string[] => found(text, en, "en");

describe("relative-date-mismatch", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  it("days after a base date in the same sentence (ja)", () => {
    assert.deepEqual(foundJa("10月2日に申し込みを締め切り、3日後の10月6日に結果を通知します。"), ["10月6日→10-05"]);
    assert.deepEqual(foundJa("10月2日に申し込みを締め切り、3日後の10月5日に結果を通知します。"), []);
  });

  it("a month before, across a year written on the base only (ja)", () => {
    assert.deepEqual(foundJa("発売日の2026年5月1日の1か月前の4月2日に予約を始めます。"), ["4月2日→04-01"]);
    assert.deepEqual(foundJa("発売日の2026年5月1日の1か月前の4月1日に予約を始めます。"), []);
  });

  it("a sentence that opens with the relative length takes its base from the sentence before (en)", () => {
    assert.deepEqual(foundEn("Applications close on May 1, 2026. Two weeks later, on May 16, 2026, results are sent."), ["May 16, 2026→2026-05-15"]);
    assert.deepEqual(foundEn("Applications close on May 1, 2026. Two weeks later, on May 15, 2026, results are sent."), []);
    assert.deepEqual(foundEn("Applications close on May 1, 2026. 3 days later, on May 4, 2026, we reply."), []);
  });

  it("earlier, and a year boundary", () => {
    assert.deepEqual(foundEn("The launch is on June 1, 2026; one month earlier, on May 2, 2026, preorders open."), ["May 2, 2026→2026-05-01"]);
    assert.deepEqual(foundJa("12月30日に締め切り、3日後の1月2日に発表します。"), []);
  });

  it("a base without a year is counted in the target's year, or in either kind of year", () => {
    assert.deepEqual(foundJa("2月28日の1日後の2025年3月1日に通知します。"), []);
    assert.deepEqual(foundJa("2月28日の1日後の3月1日に通知します。"), []);
    assert.deepEqual(foundJa("2月28日の1日後の3月2日に通知します。"), ["3月2日→02-29"]);
  });

  it("a year before, a tab between the number and its unit, and a number word after another word", () => {
    assert.deepEqual(foundJa("2026年5月1日の1年前の2025年5月2日に予約を始めます。"), ["2025年5月2日→2025-05-01"]);
    assert.deepEqual(foundEn("Applications close on May 1, 2026. 3\tdays later, on May 5, 2026, we reply."), ["May 5, 2026→2026-05-04"]);
    assert.deepEqual(foundEn("Applications close on May 1, 2026. Then two weeks later, on May 16, 2026, results are sent."), []);
    assert.deepEqual(foundEn("Applications close on May 1, 2026, and then two weeks later, on May 16, 2026, results are sent."), ["May 16, 2026→2026-05-15"]);
  });

  it("a relative length in the middle of a sentence does not reach back to the sentence before", () => {
    assert.deepEqual(foundEn("Applications close on May 1, 2026. We reply 3 days later, on May 9, 2026."), []);
  });

  it("a date not right after the relative length is not its date", () => {
    assert.deepEqual(foundJa("10月2日に締め切り、3日後に結果を出し、10月9日に発表します。"), []);
    assert.deepEqual(foundEn("Applications close on May 1, 2026. Two weeks later the panel meets on May 20, 2026."), []);
  });

  it("units other than days, weeks, months and years are not counted", () => {
    assert.deepEqual(foundJa("10月2日に締め切り、3営業日後の10月7日に通知します。"), []);
    assert.deepEqual(foundJa("10月2日に締め切り、3時間後の10月6日に通知します。"), []);
  });
});
