import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dateStampIndexes, stampCandidates, type StampCandidate } from "../packages/chaff/src/date-stamp.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import type { Finding, LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";

const LABELS = ["最終更新日", "Last updated", "Updated"];

/** text の中の date を日付として印を付けた段落。 */
const paragraph = (text: string, ...dates: readonly string[]): StampCandidate => ({
  text,
  dates: dates.map((date) => ({ start: text.indexOf(date), end: text.indexOf(date) + date.length })),
});

const stamps = (candidates: readonly StampCandidate[], labels: readonly string[] = LABELS): number[] => [...dateStampIndexes(candidates, labels)];

describe("dateStampIndexes", () => {
  it("日付だけの段落は刻印", () => {
    assert.deepEqual(stamps([paragraph("2025年6月20日", "2025年6月20日")]), [0]);
    assert.deepEqual(stamps([paragraph("April 23, 2026", "April 23, 2026")]), [0]);
    assert.deepEqual(stamps([paragraph("2026年5月1日〜2026年5月3日", "2026年5月1日", "2026年5月3日")]), [0]);
  });

  it("コロンで終わるラベルの段落と、すぐ後の日付だけの段落は刻印", () => {
    assert.deepEqual(stamps([paragraph("最終更新日:"), paragraph("2025年6月20日", "2025年6月20日"), paragraph("本文です。")]), [0, 1]);
    assert.deepEqual(stamps([paragraph("最終更新日："), paragraph("2025年6月20日", "2025年6月20日")]), [0, 1]);
    assert.deepEqual(stamps([paragraph("Last updated:"), paragraph("March 3, 2026", "March 3, 2026")]), [0, 1]);
  });

  it("ラベルと日付が同じ段落なら刻印。大文字小文字は問わない", () => {
    assert.deepEqual(stamps([paragraph("Updated 2026-03-03", "2026-03-03")]), [0]);
    assert.deepEqual(stamps([paragraph("LAST UPDATED: March 3, 2026", "March 3, 2026")]), [0]);
    assert.deepEqual(stamps([paragraph("最終更新日：2025年6月20日", "2025年6月20日")]), [0]);
  });

  it("文の中に日付があるだけの段落は刻印ではない", () => {
    assert.deepEqual(stamps([paragraph("2026年7月21日、重点計画が閣議決定されました。", "2026年7月21日")]), []);
    assert.deepEqual(stamps([paragraph("The plan was adopted on March 3, 2026.", "March 3, 2026")]), []);
    assert.deepEqual(stamps([paragraph("Updated 2026-03-03 and again 2026-04-01", "2026-03-03", "2026-04-01")]), []);
  });

  it("ラベルの後が日付だけの段落でなければ、ラベルの段落は数える", () => {
    assert.deepEqual(stamps([paragraph("最終更新日:"), paragraph("本文です。")]), []);
    assert.deepEqual(stamps([paragraph("最終更新日:")]), []);
    assert.deepEqual(stamps([paragraph("2025年6月20日", "2025年6月20日"), paragraph("最終更新日:")]), [0]);
  });

  it("語彙表に無いラベルは刻印にしない", () => {
    assert.deepEqual(stamps([paragraph("締切:"), paragraph("2026年5月1日", "2026年5月1日")]), [1]);
    assert.deepEqual(stamps([paragraph("Deadline March 3, 2026", "March 3, 2026")]), []);
    assert.deepEqual(stamps([paragraph("Updated 2026-03-03", "2026-03-03")], []), []);
  });

  it("コロンの無いラベルだけの段落は、次が日付でも刻印にしない", () => {
    assert.deepEqual(stamps([paragraph("最終更新日"), paragraph("2025年6月20日", "2025年6月20日")]), [1]);
  });

  it("語彙表の空の語は、コロンだけの段落をラベルにしない", () => {
    assert.deepEqual(stamps([paragraph(":"), paragraph("2025年6月20日", "2025年6月20日")], [""]), [1]);
  });

  it("空や日付の無い入力では何も返さない", () => {
    assert.deepEqual(stamps([]), []);
    assert.deepEqual(stamps([paragraph("")]), []);
    assert.deepEqual(stamps([paragraph(":")]), []);
    assert.deepEqual(stamps([paragraph("  ")]), []);
    assert.deepEqual(stamps([paragraph(":", "")]), []);
  });
});

describe("stampCandidates", () => {
  const source = "最終更新日:\n\n2025年6月20日\n\n本文。";
  const at = (text: string): { start: number; end: number } => ({ start: source.indexOf(text), end: source.indexOf(text) + text.length });

  it("段落の中の日付だけを、段落の先頭からの位置にする", () => {
    const candidates = stampCandidates(source, [at("最終更新日:"), at("2025年6月20日"), at("本文。")], [at("2025年6月20日")]);
    assert.deepEqual(candidates, [
      { text: "最終更新日:", dates: [] },
      { text: "2025年6月20日", dates: [{ start: 0, end: 10 }] },
      { text: "本文。", dates: [] },
    ]);
  });

  it("段落をはみ出す日付はどちらの段落にも入れない", () => {
    const straddling = { start: at("最終更新日:").end - 1, end: at("2025年6月20日").start + 2 };
    assert.deepEqual(
      stampCandidates(source, [at("最終更新日:"), at("2025年6月20日")], [straddling]).map((candidate) => candidate.dates),
      [[], []],
    );
  });

  it("段落も日付も無ければ空", () => {
    assert.deepEqual(stampCandidates(source, [], [at("本文。")]), []);
    assert.deepEqual(stampCandidates("", [{ start: 0, end: 0 }], []), [{ text: "", dates: [] }]);
  });
});

const findingsFor = (source: string, adapter: LanguageAdapter): Finding[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, "business/report").findings.filter(
    (finding) => finding.rule === "preamble-length",
  );

describe("preamble-length と更新日の刻印", () => {
  it("日本語: 「最終更新日:」と日付の段落は本題までの段落に数えない", () => {
    const source = "# 表題\n\n最終更新日:\n\n2025年6月20日\n\n前置きです。\n\n## 本題\n\n中身です。";
    assert.deepEqual(findingsFor(source, ja), []);
  });

  it("日本語: 刻印を除いても上限を超えれば指摘し、数と位置は刻印の後から", () => {
    const source = "# 表題\n\n最終更新日:\n\n2025年6月20日\n\n前置き一。\n\n前置き二。\n\n前置き三。\n\n## 本題\n\n中身です。";
    const [finding] = findingsFor(source, ja);
    assert.equal(finding?.values["count"], 3);
    assert.equal(finding?.values["offset"], source.indexOf("前置き一"));
  });

  it("日本語: 文の中に日付がある前置きは数える", () => {
    const source = "# 表題\n\n2025年6月20日に決めました。\n\n前置き二。\n\n前置き三。\n\n## 本題\n\n中身です。";
    assert.equal(findingsFor(source, ja)[0]?.values["count"], 3);
  });

  it("English: a date-only paragraph and a labelled date are not preamble", () => {
    const source = "April 23, 2026\n\n# Title\n\nUpdated 2026-03-03\n\nLast updated:\n\nMarch 3, 2026\n\nOne paragraph.\n\n## Body\n\nContent.";
    assert.deepEqual(findingsFor(source, en), []);
  });

  it("English: a date inside a sentence still counts", () => {
    const source = "# Title\n\nOn March 3, 2026 we decided.\n\nSecond.\n\nThird.\n\n## Body\n\nContent.";
    assert.equal(findingsFor(source, en)[0]?.values["count"], 3);
  });
});
