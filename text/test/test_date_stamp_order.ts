import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { stampOrderIssues } from "../packages/chaff/src/structure/stamp-order.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

// 制定日が改定日より後の刻印（date-stamp-order）。例文は自作。

const RULE = "date-stamp-order";

const found = (source: string, adapter: LanguageAdapter, genre = "legal/contract"): number[] =>
  runRules(buildDocument("terms.md", source, adapter), loadRules(adapter.id), {}, false, genre)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => finding.line);

const jaDoc = (...lines: string[]): string => ["# 利用規約", "", "本規約は、日本法に準拠します。", "", ...lines, ""].join("\n");
const enDoc = (...lines: string[]): string => ["# Terms of Use", "", "These Terms are governed by the laws of Japan.", "", ...lines, ""].join("\n");

describe("date-stamp-order", () => {
  it("ja: 制定の日付が改定の日付より後なら、両方の行を指す", () => {
    assert.deepEqual(found(jaDoc("2027年4月1日 制定", "", "2026年7月1日 最終改定"), ja), [5, 7]);
    assert.deepEqual(found(jaDoc("制定日：2024年10月1日", "", "最終改定日：2024年9月1日"), ja), [5, 7]);
    assert.deepEqual(found(jaDoc("令和7年10月1日 制定", "", "2024年9月1日 改定"), ja), [5, 7]);
    assert.deepEqual(found(jaDoc("作成：令和4年2月4日　最終改定：令和3年11月19日"), ja), [5, 5]);
    assert.deepEqual(found(jaDoc("| 制定 | 2027年4月1日 |", "| --- | --- |", "| 最終改定 | 2026年7月1日 |"), ja), [5, 7]);
  });

  it("ja: 順の正しい刻印、片方だけの刻印、年の無い日付、文の中の日付、施行日は指さない", () => {
    assert.deepEqual(found(jaDoc("2023年4月1日 制定", "", "2026年7月1日 最終改定"), ja), []);
    assert.deepEqual(found(jaDoc("2027年4月1日 制定"), ja), []);
    assert.deepEqual(found(jaDoc("4月1日 制定", "", "2026年7月1日 最終改定"), ja), []);
    assert.deepEqual(found(jaDoc("2027年4月1日に基本方針を制定", "", "2026年7月1日 最終改定"), ja), []);
    assert.deepEqual(found(jaDoc("2026年3月1日 改定", "", "2026年4月1日 施行"), ja), []);
    assert.deepEqual(found(jaDoc("作成：平成16年2月4日　最終改定：令和3年11月19日"), ja), []);
    assert.deepEqual(found(jaDoc("2027年4月1日 制定 2026年7月1日 最終改定"), ja), []);
  });

  it("en: an established date after the last update, both lines", () => {
    assert.deepEqual(found(enDoc("Established: April 1, 2027", "", "Last updated: July 1, 2026"), en), [5, 7]);
    assert.deepEqual(found(enDoc("**Established:** October 1, 2024", "", "**Last updated:** September 1, 2024"), en), [5, 7]);
    assert.deepEqual(found(enDoc("Established: April 1, 2023", "", "Last updated: July 1, 2026", "", "Established: April 1, 2027"), en), [7, 9]);
  });

  it("compares only stamps written together, not the stamps of two documents in one file", () => {
    const body = ["", "These Terms apply to the Service.", "", "We may change them.", "", "Notices are sent by email.", ""];
    assert.deepEqual(found(enDoc("Established: April 1, 2027", ...body, "# Terms B", "", "Last updated: July 1, 2026"), en), []);
  });

  it("en: stamps in order, one stamp, an effective date after the update, a date in a sentence stay silent", () => {
    assert.deepEqual(found(enDoc("Established: April 1, 2023", "", "Last updated: July 1, 2026"), en), []);
    assert.deepEqual(found(enDoc("Last updated: July 1, 2026"), en), []);
    assert.deepEqual(found(enDoc("Effective date: April 27, 2026", "", "Last updated: April 23, 2026"), en), []);
    assert.deepEqual(found(enDoc("We adopted these Terms on April 1, 2027.", "", "Last updated: July 1, 2026"), en), []);
    assert.deepEqual(found(enDoc("Established: April 1", "", "Last updated: July 1, 2026"), en), []);
  });

  it("names each line's partner in its message", () => {
    const rules = loadRules("en");
    const rule = rules.find((candidate) => candidate.id === RULE);
    assert.ok(rule);
    const messages = runRules(
      buildDocument("terms.md", enDoc("Established: April 1, 2027", "", "Last updated: July 1, 2026"), en),
      rules,
      {},
      false,
      "legal/contract",
    )
      .findings.filter((finding) => finding.rule === RULE)
      .map((finding) => messageOf(rule, finding, "en"));
    assert.deepEqual(messages, [
      "The established date 2027-04-01 is after the update 2026-07-01",
      "The update 2026-07-01 is before the established date 2027-04-01",
    ]);
  });

  it("does not run in literature", () => {
    assert.deepEqual(found(enDoc("Established: April 1, 2027", "", "Last updated: July 1, 2026"), en, "literature/fiction"), []);
  });
});

describe("stampOrderIssues", () => {
  const words = { established: ["制定"], updated: ["改定", "最終改定"] };
  const text = "2027年4月1日 制定\n2026年7月1日 改定\n2026年9月1日 最終改定";
  const dateAt = (written: string, value: string): { offset: number; end: number; value: string } => {
    const offset = text.indexOf(written);
    return { offset, end: offset + written.length, value };
  };
  const dates = [dateAt("2027年4月1日", "2027-04-01"), dateAt("2026年7月1日", "2026-07-01"), dateAt("2026年9月1日", "2026-09-01")];
  const [first, second, third] = dates.map((date) => date.offset);

  it("reports the established stamp once, against the latest earlier update, and every earlier update", () => {
    assert.deepEqual(
      stampOrderIssues(text, dates, words).map((issue) => [issue.offset, issue.values["updated"], issue.values["side"]]),
      [
        [first, "2026-09-01", undefined],
        [second, "2026-07-01", "updated"],
        [third, "2026-09-01", "updated"],
      ],
    );
  });

  it("says nothing without words, dates, or text", () => {
    assert.deepEqual(stampOrderIssues(text, dates, { established: [], updated: ["改定"] }), []);
    assert.deepEqual(stampOrderIssues(text, [], words), []);
    assert.deepEqual(stampOrderIssues("", [], words), []);
  });

  it("reads no line with two dates or a date without its year", () => {
    const pair = [
      { offset: 0, end: 9, value: "2027-04-01" },
      { offset: 13, end: 22, value: "2026-07-01" },
    ];
    assert.equal(stampOrderIssues("2027年4月1日 制定\n2026年7月1日 改定", pair, words).length, 2);
    assert.deepEqual(
      stampOrderIssues(
        "2027年4月1日 制定 2026年1月1日\n2026年7月1日 改定",
        [
          { offset: 0, end: 9, value: "2027-04-01" },
          { offset: 13, end: 22, value: "2026-01-01" },
          { offset: 23, end: 32, value: "2026-07-01" },
        ],
        words,
      ),
      [],
    );
    assert.deepEqual(
      stampOrderIssues(
        "4月1日 制定\n2026年7月1日 改定",
        [
          { offset: 0, end: 4, value: "--04-01" },
          { offset: 8, end: 17, value: "2026-07-01" },
        ],
        words,
      ),
      [],
    );
  });
});
