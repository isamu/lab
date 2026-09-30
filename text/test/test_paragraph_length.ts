import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules } from "../packages/chaff/src/run.ts";
import { isTooLongParagraph } from "../packages/chaff/src/paragraph-length.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";

const RULE = "max-paragraph-length";

const findingsOf = (source: string, adapter: LanguageAdapter, genre: string, limits: Readonly<Record<string, number>> = {}): string[] =>
  runRules(buildDocument("t.md", source, adapter), loadRules(adapter.id), {}, true, genre, limits)
    .findings.filter((finding) => finding.rule === RULE)
    .map((finding) => String(finding.values["count"]));

const fullSentenceOf = (language: string): number | undefined => loadRules(language).find((rule) => rule.id === RULE)?.full_sentence;

describe("isTooLongParagraph: more sentences than the limit, and longer than that many full sentences", () => {
  it("reports a paragraph over both limits", () => {
    assert.equal(isTooLongParagraph([20, 20, 20, 20, 20, 20], 5, 18), true);
  });

  it("does not report many short sentences: their total is under the length", () => {
    assert.equal(isTooLongParagraph([4, 4, 4, 4, 4, 4, 4, 4, 4, 4], 5, 18), false);
  });

  it("does not report a long paragraph of few sentences: that is the sentence rule's to report", () => {
    assert.equal(isTooLongParagraph([60, 60, 60, 60, 60], 5, 18), false);
  });

  it("the length limit is exclusive, like the sentence limit", () => {
    assert.equal(isTooLongParagraph([15, 15, 15, 15, 15, 15], 5, 18), false);
    assert.equal(isTooLongParagraph([15, 15, 15, 15, 15, 16], 5, 18), true);
    assert.equal(isTooLongParagraph([50, 50, 50, 50, 50], 5, 18), false);
  });

  it("scales the length with the sentence limit, so a team's number moves both", () => {
    const sizes = [20, 20, 20, 20, 20, 20, 20, 20, 20];
    assert.equal(isTooLongParagraph(sizes, 5, 18), true);
    assert.equal(isTooLongParagraph(sizes, 8, 18), true);
    assert.equal(isTooLongParagraph(sizes, 9, 18), false);
    assert.equal(isTooLongParagraph([20, 20, 20, 20, 20, 20, 20, 20, 20, 20], 9, 25), false);
  });

  it("without a full-sentence length, counts sentences alone", () => {
    assert.equal(isTooLongParagraph([1, 1, 1, 1, 1, 1], 5, undefined), true);
    assert.equal(isTooLongParagraph([1, 1, 1, 1, 1], 5, undefined), false);
    assert.equal(isTooLongParagraph([0, 0, 0, 0, 0, 0], 5, undefined), true);
  });

  it("an empty paragraph is never too long", () => {
    assert.equal(isTooLongParagraph([], 0, 18), false);
    assert.equal(isTooLongParagraph([], 5, undefined), false);
  });
});

describe("max-paragraph-length: the full-sentence length is data, per language", () => {
  it("both languages declare one, in their own unit", () => {
    assert.equal(typeof fullSentenceOf("ja"), "number");
    assert.equal(typeof fullSentenceOf("en"), "number");
    assert.ok((fullSentenceOf("ja") ?? 0) > (fullSentenceOf("en") ?? 0), "characters outnumber words");
  });
});

// NASA Knows! (Grades K-4): What Is a Spacewalk? Public domain (NASA). Seven short sentences, 88 words.
const NASA_AIRLOCK = [
  "Astronauts are now ready to get out of their spacecraft. They leave the spacecraft through a special door called an airlock.",
  "The airlock has two doors. When astronauts are inside the spacecraft, the airlock is airtight so no air can get out.",
  "When astronauts get ready to go on a spacewalk, they go through the first door and lock it tight behind them.",
  "They can then open the second door without any air getting out of the spacecraft. After a spacewalk, astronauts go back inside through the airlock.",
].join(" ");

// Minutes of the Federal Open Market Committee, July 2025. Public domain (Federal Reserve Board). Six dense sentences.
const FOMC_LABOR = [
  "Recent data indicated that labor market conditions remained solid. The unemployment rate was 4.1 percent in June, down 0.1 percentage point from May.",
  "The participation rate edged down 0.1 percentage point in June, and the employment-to-population ratio was unchanged.",
  "Total nonfarm payroll gains were solid in June, though the pace of private payroll gains stepped down noticeably.",
  "The ratio of job vacancies to unemployed workers was 1.1 in June and remained within the narrow range seen over the past year.",
  "Average hourly earnings for all employees rose 3.7 percent over the 12 months ending in June, slightly lower than the year-earlier pace.",
].join(" ");

describe("max-paragraph-length (English)", () => {
  it("valid: a children's paragraph of short sentences is not a wall", () => {
    assert.deepEqual(findingsOf(`# Spacewalks\n\n${NASA_AIRLOCK}\n`, en, "blog/owned-media"), []);
  });

  it("invalid: a dense paragraph of long sentences is still reported, with its sentence count", () => {
    assert.deepEqual(findingsOf(`# Labor market\n\n${FOMC_LABOR}\n`, en, "business/meeting-notes"), ["6"]);
  });

  it("a team's lower limit reaches the short paragraph too", () => {
    assert.deepEqual(findingsOf(`# Spacewalks\n\n${NASA_AIRLOCK}\n`, en, "blog/owned-media", { [RULE]: 3 }), ["7"]);
  });
});

const SHORT_JA = Array.from({ length: 8 }, (_, index) => `これは${String(index)}番目の文です。`).join("");
const LONG_JA = Array.from(
  { length: 6 },
  (_, index) =>
    `第${String(index + 1)}の手順では、申請書の記載内容と添付書類の写しを担当者が一件ずつ突き合わせ、食い違いがあれば申請者に電話で確認したうえで、確認の結果を台帳に記録して上長の承認を受けます。`,
).join("");

describe("max-paragraph-length (Japanese)", () => {
  it("valid: 短い文を 8 つ並べた段落は、壁にならない", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${SHORT_JA}\n`, ja, "blog/tech"), []);
  });

  it("valid: 普通より少し短い文を 6 つ並べた段落（上限 × 普通の文より短い）は指摘しない", () => {
    const moderate = Array.from({ length: 6 }, (_, index) => `第${String(index + 1)}の手順では、申請書と添付書類を担当者が突き合わせて確認します。`).join("");
    assert.deepEqual(findingsOf(`# 見出し\n\n${moderate}\n`, ja, "blog/tech"), []);
  });

  it("invalid: 長い文を 6 つ詰めた段落は、これまでどおり指摘する", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${LONG_JA}\n`, ja, "blog/tech"), ["6"]);
  });

  it("法令の上限（12 文）では、同じ段落も長すぎない", () => {
    assert.deepEqual(findingsOf(`# 見出し\n\n${LONG_JA}\n`, ja, "legal/statute"), []);
  });
});
