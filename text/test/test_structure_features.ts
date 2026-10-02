import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import type { LanguageAdapter, Lexicon } from "../packages/chaff/src/plugin.ts";
import {
  FEATURE_IDS,
  childCounts,
  headedSections,
  structureFeaturesOf,
  type FeatureId,
  type FeatureValue,
} from "../packages/chaff/src/structure-shape/features.ts";
import {
  bookendOf,
  containsWord,
  endsWithWord,
  headingFormOf,
  headingWords,
  proConPairs,
  startsWithWord,
} from "../packages/chaff/src/structure-shape/heading-words.ts";
import { MIN_CLOSING_GRAMS, gramsOf, restatementPercent } from "../packages/chaff/src/structure-shape/restatement.ts";
import { BASELINE_STEPS, parseStructureBaseline, percentilesOf } from "../packages/chaff/src/structure-shape/baseline.ts";
import { STRUCTURE_BASELINE } from "../packages/chaff/src/structure-shape/baseline-load.ts";
import { isBeyond, pastShareOf, structureScoreOf } from "../packages/chaff/src/structure-shape/score.ts";

// The structure measures: pure functions over the document, each one a number or a reason it has none. Every text here
// is written for the test.

const lines = (...rows: string[]): string => rows.join("\n");

const featuresOf = (adapter: LanguageAdapter, source: string): Map<FeatureId, FeatureValue> =>
  new Map(structureFeaturesOf(buildDocument("a.md", source, adapter)).map((feature) => [feature.id, feature]));

const valueOf = (features: Map<FeatureId, FeatureValue>, id: FeatureId): number | undefined => features.get(id)?.value;

const lexicon = (...entries: Lexicon): Lexicon => entries;

describe("a heading's words", () => {
  it("drops the number, decoration and closing marks, and lowers the case", () => {
    assert.equal(headingWords("1. What is Chaff?"), "what is chaff");
    assert.equal(headingWords("２．Pythonとは？"), "pythonとは");
    assert.equal(headingWords("第3章 導入の手順"), "導入の手順");
    assert.equal(headingWords("🚀 はじめに"), "はじめに");
    assert.equal(headingWords("1-2. まとめ："), "まとめ");
  });

  it("keeps a heading that has no number or marks as it is", () => {
    assert.equal(headingWords("在庫の数え方"), "在庫の数え方");
    assert.equal(headingWords(""), "");
    assert.equal(headingWords("2024年の振り返り"), "2024年の振り返り");
    assert.equal(headingWords("3 steps"), "steps");
  });
});

describe("matching a phrase at a word edge", () => {
  it("does not match inside a longer Latin word", () => {
    assert.equal(startsWithWord("keyboard shortcuts", "key"), false);
    assert.equal(startsWithWord("key ideas", "key"), true);
    assert.equal(endsWithWord("drawbacks", "backs"), false);
    assert.equal(endsWithWord("why it matters", "matters"), true);
    assert.equal(containsWord("considerations", "cons"), false);
    assert.equal(containsWord("pros and cons", "cons"), true);
    assert.equal(containsWord("cons", "cons"), true);
  });

  it("matches Japanese anywhere, where words are not spaced", () => {
    assert.equal(endsWithWord("pythonとは", "とは"), true);
    assert.equal(containsWord("導入のメリット", "メリット"), true);
    assert.equal(containsWord("anything", ""), false);
  });

  it("finds a whole word after an earlier partial one", () => {
    assert.equal(containsWord("considerations and cons", "cons"), true);
  });

  it("scans a long run of partial matches without running out of stack", () => {
    assert.equal(containsWord("ab".repeat(20000), "ab"), false);
    assert.equal(containsWord(`${"ab".repeat(20000)} ab`, "ab"), true);
  });
});

describe("heading forms, bookends and pro / con pairs from the lexicons", () => {
  const forms = lexicon({ pattern: "とは", position: "after" }, { pattern: "とは何か", position: "after" }, { pattern: "なぜ", position: "before" });

  it("takes the longest form that fits, at its side of the heading", () => {
    assert.equal(headingFormOf("ragとは何か", forms)?.pattern, "とは何か");
    assert.equal(headingFormOf("ragとは", forms)?.pattern, "とは");
    assert.equal(headingFormOf("なぜ遅いのか", forms)?.pattern, "なぜ");
    assert.equal(headingFormOf("遅い理由はなぜ", forms), undefined);
    assert.equal(headingFormOf("在庫の数え方", forms), undefined);
  });

  it("reads the English lexicon's forms at the start of the heading", () => {
    const english = en.lexicons["heading-form"] ?? [];
    assert.equal(headingFormOf(headingWords("What Is Retrieval?"), english)?.pattern, "what is");
    assert.equal(headingFormOf(headingWords("Keyboard shortcuts"), english), undefined);
  });

  it("says which side a bookend stands on", () => {
    const bookends = ja.lexicons["bookend-heading"] ?? [];
    assert.equal(bookendOf("はじめに", bookends), "before");
    assert.equal(bookendOf("まとめ：分かったこと", bookends), "after");
    assert.equal(bookendOf("在庫のまとめ方", bookends), undefined);
    assert.equal(bookendOf("conclusion", en.lexicons["bookend-heading"] ?? []), "after");
    assert.equal(bookendOf("concluding remarks", en.lexicons["bookend-heading"] ?? []), undefined);
  });

  it("finds a pro / con pair only across two headings, and does not read デメリット as メリット", () => {
    const pairs = ja.lexicons["pro-con-heading"] ?? [];
    assert.deepEqual(proConPairs(["導入のメリット", "導入のデメリット"], pairs), ["メリット/デメリット"]);
    assert.deepEqual(proConPairs(["導入のデメリット", "費用"], pairs), []);
    assert.deepEqual(proConPairs(["導入のデメリット", "運用のデメリット"], pairs), []);
    assert.deepEqual(proConPairs(["メリットとデメリット"], pairs), []);
    assert.deepEqual(proConPairs([], pairs), []);
    assert.deepEqual(proConPairs(["considerations", "pros"], en.lexicons["pro-con-heading"] ?? []), []);
    assert.deepEqual(proConPairs(["pros", "cons"], en.lexicons["pro-con-heading"] ?? []), ["pros/cons"]);
  });

  it("ignores an entry without its counterpart", () => {
    assert.deepEqual(proConPairs(["利点", "欠点"], lexicon({ pattern: "利点" })), []);
  });
});

describe("how much of a closing section restates the body", () => {
  const body = "在庫は毎朝数えます。数えた結果は帳簿と照らします。差があれば入力を見直します。";

  it("is all of it when the closing repeats the body", () => {
    assert.equal(restatementPercent(body, body, "char"), 100);
  });

  it("is none of it when the closing says something new", () => {
    assert.equal(restatementPercent("来月からは発注の担当を二人に増やし、週ごとに交代する予定です。", body, "char"), 0);
  });

  it("is not measured when the closing is too short to say anything", () => {
    assert.equal(restatementPercent("以上です。", body, "char"), undefined);
    assert.ok(gramsOf("以上です。", "char").size < MIN_CLOSING_GRAMS);
  });

  it("compares word pairs in English, ignoring case and punctuation", () => {
    const english = "We count stock every morning. We match the count against the books. A gap means a typing error.";
    assert.equal(restatementPercent(english.toUpperCase(), english, "word"), 100);
    assert.equal(restatementPercent("Next month two people will share the ordering and swap every week from then on.", english, "word"), 0);
  });

  it("does not count a run across punctuation as content", () => {
    assert.deepEqual([...gramsOf("ab、cdef", "char")], ["cdef"]);
  });

  it("counts a character outside the Basic Multilingual Plane as one, never half of one", () => {
    assert.deepEqual([...gramsOf("𠮷野家の", "char")], ["𠮷野家の"]);
    assert.ok([...gramsOf("𠮷".repeat(20), "char")].every((gram) => [...gram].length === 4 && gram === "𠮷".repeat(4)));
  });
});

const AI_SHAPED = lines(
  "# 在庫管理を見直して見えてきた、本当に大切なこと",
  "",
  "## はじめに",
  "",
  "在庫管理は、どの会社にとっても重要な課題です。本記事では、私たちが取り組んだ改善を紹介します。",
  "",
  "## 在庫管理とは",
  "",
  "在庫管理とは、倉庫にある品物の数を正しく把握することです。",
  "",
  "## 直面した課題",
  "",
  "### 数え忘れ",
  "",
  "棚の奥の品物を数え忘れることがありました。",
  "",
  "### 記録の漏れ",
  "",
  "数えた結果を帳簿に書き忘れることがありました。",
  "",
  "### 見返さない",
  "",
  "書いた帳簿を誰も見返していませんでした。",
  "",
  "## 改善のポイント",
  "",
  "- **毎朝数える**：棚の奥まで、毎朝数えます",
  "- **すぐ書く**：数えたらすぐ帳簿に書きます",
  "- **週に一度見返す**：金曜日に帳簿を見返します",
  "",
  "## 導入のメリット",
  "",
  "数え忘れが減り、帳簿と倉庫の差が小さくなりました。",
  "",
  "## 導入のデメリット",
  "",
  "毎朝の作業に十五分ほどかかるようになりました。",
  "",
  "## まとめ",
  "",
  "本記事では、在庫管理の改善を紹介しました。毎朝数え、すぐ書き、週に一度見返すことで、数え忘れが減り、帳簿と倉庫の差が小さくなりました。",
);

const HUMAN_SHAPED = lines(
  "# 在庫が合わない理由は、棚の奥にあった",
  "",
  "先月の棚卸しで、帳簿と倉庫の数が四十件ずれていました。半分は棚の奥に押し込まれた箱で、誰も数えていませんでした。残りは、数えた人が帳簿に書く前に別の作業に呼ばれ、そのまま忘れていたものです。",
  "",
  "そこで、数える順番を変えました。奥の列から手前へ数え、数えた列にはその場で札を下げます。札があれば数えた印なので、途中で呼ばれても続きから数えられます。最初の週は慣れずに時間がかかりましたが、二週目からは前と同じ十五分で終わるようになりました。",
  "",
  "帳簿に書くのも、数えたその場にしました。端末を棚の前に置き、数えた列ごとに打ち込みます。後でまとめて書くと、どの列の数だったのかを思い出せないからです。",
  "",
  "## 今月の結果",
  "",
  "今月の棚卸しでは、ずれは三件でした。三件とも、入荷した日に棚へ入れる前の箱で、数える仕組みとは別の問題です。入荷の箱をどこに置くかを、次に決めます。",
);

describe("the structure measures of a document", () => {
  it("measures every feature in a fixed order", () => {
    assert.deepEqual(
      structureFeaturesOf(buildDocument("a.md", AI_SHAPED, ja)).map((feature) => feature.id),
      [...FEATURE_IDS],
    );
  });

  it("reads the generated shape: bookends, a stock heading form, three subsections, bold labels, a pro / con pair, a restating まとめ", () => {
    const features = featuresOf(ja, AI_SHAPED);
    assert.equal(valueOf(features, "bookends"), 2);
    assert.equal(valueOf(features, "three-subsections"), 1);
    assert.equal(valueOf(features, "bold-labels"), 3);
    assert.equal(valueOf(features, "pro-con"), 1);
    assert.equal(features.get("pro-con")?.detail, "メリット/デメリット");
    assert.ok((valueOf(features, "heading-forms") ?? 0) > 0);
    assert.ok((valueOf(features, "closing-restatement") ?? 0) >= 40, String(valueOf(features, "closing-restatement")));
    assert.equal(features.get("closing-restatement")?.detail, "まとめ");
  });

  it("reads a human shape as few headings, no bookends and nothing templated", () => {
    const features = featuresOf(ja, HUMAN_SHAPED);
    assert.equal(valueOf(features, "bold-labels"), 0);
    assert.equal(valueOf(features, "three-subsections"), 0);
    assert.equal(valueOf(features, "emoji-headings"), 0);
  });

  it("says why a measure has no value instead of reading it as zero", () => {
    const features = featuresOf(ja, HUMAN_SHAPED);
    assert.equal(features.get("section-uniformity")?.notMeasured, "too-few-sections");
    assert.equal(features.get("heading-forms")?.notMeasured, "too-few-headings");
    assert.equal(features.get("bookends")?.notMeasured, "too-few-headings");
    assert.equal(features.get("closing-restatement")?.notMeasured, "no-closing");
    assert.equal(features.get("three-item-lists")?.notMeasured, "too-few-lists");
    assert.equal(featuresOf(ja, "# 短い\n\n短い文書です。").get("heading-density")?.notMeasured, "too-short");
  });

  it("measures headings per 1000 words, without the title", () => {
    const paragraph = "We count the stock on every shelf each morning and write the numbers down before anyone starts to pick orders.";
    const section = (heading: string): string => lines(`## ${heading}`, "", paragraph, "", paragraph);
    const source = lines("# Title", "", ...["One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"].map(section));
    const words = 10 * 2 * paragraph.split(" ").length;
    assert.equal(valueOf(featuresOf(en, source), "heading-density"), Math.round((10 / words) * 1000 * 10) / 10);
  });

  it("counts headings split into exactly three direct subheadings, not four, and not deeper ones", () => {
    const section = (depth: number, heading: string): string[] => [`${"#".repeat(depth)} ${heading}`, "", "Text.", ""];
    const source = lines(
      "# Title",
      "",
      ...section(2, "Three"),
      ...["A", "B", "C"].flatMap((heading) => section(3, heading)),
      ...section(2, "Four"),
      ...["D", "E", "F", "G"].flatMap((heading) => section(3, heading)),
      ...section(2, "Nested"),
      ...section(3, "H"),
      ...["I", "J"].flatMap((heading) => section(4, heading)),
    );
    const features = featuresOf(en, source);
    assert.equal(valueOf(features, "three-subsections"), 1);
    assert.deepEqual(childCounts(headedSections(buildDocument("a.md", source, en).sections)), [3, 0, 0, 0, 4, 0, 0, 0, 0, 1, 2, 0, 0]);
  });

  it("measures heading forms over the headings that are not bookends", () => {
    const source = lines(
      "# 題",
      "",
      "## はじめに",
      "",
      "本文。",
      "",
      "## RAGとは",
      "",
      "本文。",
      "",
      "## 導入",
      "",
      "本文。",
      "",
      "## 運用",
      "",
      "本文。",
      "",
      "## 費用",
      "",
      "本文。",
      "",
      "## まとめ",
      "",
      "本文。",
    );
    assert.equal(valueOf(featuresOf(ja, source), "heading-forms"), 25);
  });

  it("counts a section of exactly two paragraphs as short, and three as not", () => {
    const paragraphs = (count: number): string[] => Array.from({ length: count }, (_, index) => [`Paragraph ${String(index + 1)}.`, ""]).flat();
    const source = lines(
      "# Title",
      "",
      "## One",
      "",
      ...paragraphs(1),
      "## Two",
      "",
      ...paragraphs(2),
      "## Three",
      "",
      ...paragraphs(3),
      "## Four",
      "",
      ...paragraphs(4),
    );
    assert.equal(valueOf(featuresOf(en, source), "short-sections"), 50);
    assert.equal(featuresOf(en, source).get("short-sections")?.detail, "2.5");
  });

  it("counts a heading with an emoji, the title too", () => {
    const features = featuresOf(en, lines("# 🚀 Launch notes", "", "## ✅ Done", "", "Shipped.", "", "## Next", "", "More."));
    assert.equal(valueOf(features, "emoji-headings"), 2);
  });

  it("counts three-item lists as a share of the lists", () => {
    const list = (count: number): string => Array.from({ length: count }, (_, index) => `- item ${String(index + 1)}`).join("\n");
    const source = lines("# Lists", "", list(3), "", "Text.", "", list(3), "", "Text.", "", list(4), "", "Text.", "", list(2));
    assert.equal(valueOf(featuresOf(en, source), "three-item-lists"), 50);
    assert.equal(featuresOf(en, source).get("three-item-lists")?.detail, "2/4");
  });
});

describe("the human baseline as data", () => {
  it("takes nearest-rank percentiles at every step", () => {
    const values = Array.from({ length: 100 }, (_, index) => index + 1);
    const percentiles = percentilesOf(values);
    assert.deepEqual(Object.keys(percentiles).map(Number), [...BASELINE_STEPS]);
    assert.equal(percentiles[10], 10);
    assert.equal(percentiles[90], 90);
    assert.equal(percentilesOf([7])[50], 7);
    assert.deepEqual(percentilesOf([]), {});
  });

  it("drops a language or a measure that does not parse", () => {
    const parsed = parseStructureBaseline({
      ja: { articles: 10, features: { bookends: { measured: 10, percentiles: { 50: 1, 90: 2 } }, "pro-con": { measured: "x" }, unknown: {} } },
      en: { features: {} },
      xx: "nonsense",
    });
    assert.deepEqual(Object.keys(parsed), ["ja"]);
    assert.deepEqual(Object.keys(parsed["ja"]?.features ?? {}), ["bookends"]);
    assert.equal(parsed["ja"]?.features.bookends?.percentiles.get(90), 2);
    assert.deepEqual(parseStructureBaseline(undefined), {});
    assert.deepEqual(parseStructureBaseline([1, 2]), {});
  });

  it("drops a measure with a value that is not a finite number, a step it does not know, or a negative count", () => {
    const withFeature = (feature: unknown): string[] =>
      Object.keys(parseStructureBaseline({ ja: { articles: 10, features: { bookends: feature } } })["ja"]?.features ?? {});
    assert.deepEqual(withFeature({ measured: 10, percentiles: { 50: 1, 90: 2 } }), ["bookends"]);
    assert.deepEqual(withFeature({ measured: 10, percentiles: { 50: Number.NaN, 90: 2 } }), []);
    assert.deepEqual(withFeature({ measured: 10, percentiles: { 50: 1, 90: Infinity } }), []);
    assert.deepEqual(withFeature({ measured: 10, percentiles: { 50: 1, 91: 2 } }), []);
    assert.deepEqual(withFeature({ measured: -1, percentiles: { 50: 1 } }), []);
    assert.deepEqual(parseStructureBaseline({ ja: { articles: Number.NaN, features: {} } }), {});
  });

  it("ships a baseline for Japanese and English with every measure", () => {
    ["ja", "en"].forEach((language) => {
      const baseline = STRUCTURE_BASELINE[language];
      assert.ok(baseline !== undefined && baseline.articles > 0, language);
      assert.deepEqual(new Set(Object.keys(baseline.features)), new Set(FEATURE_IDS), language);
    });
  });
});

describe("placing the measures against the human baseline", () => {
  const steps = (values: readonly number[]): ReadonlyMap<number, number> => new Map(BASELINE_STEPS.map((step, index) => [step, values[index] ?? 0]));
  /** Values 1 to 19 at the steps 5 to 95: p10 is 2, p50 is 10, p90 is 18. */
  const linear = { measured: 100, percentiles: steps(BASELINE_STEPS.map((_, index) => index + 1)) };
  const zeros = { measured: 100, percentiles: steps([]) };

  it("says what share of human articles a value is past, in the measure's direction", () => {
    assert.equal(pastShareOf(18.5, linear, "high"), 90);
    assert.equal(pastShareOf(18, linear, "high"), 85);
    assert.equal(pastShareOf(0, linear, "high"), 0);
    assert.equal(pastShareOf(1.5, linear, "low"), 90);
    assert.equal(pastShareOf(2, linear, "low"), 85);
    assert.equal(pastShareOf(30, linear, "low"), 0);
    assert.equal(pastShareOf(1, zeros, "high"), 95);
    assert.equal(pastShareOf(0, zeros, "high"), 0);
  });

  it("counts a value past the human p90 (p10 for a low measure), and no value at the limit", () => {
    assert.equal(isBeyond(19, 18, "high"), true);
    assert.equal(isBeyond(18, 18, "high"), false);
    assert.equal(isBeyond(1, 2, "low"), true);
    assert.equal(isBeyond(2, 2, "low"), false);
  });

  it("scores the count of measures past the limit, and compares only what has a value and a baseline", () => {
    const baseline = { articles: 100, features: { "heading-density": linear, "section-uniformity": linear, "bold-labels": zeros } };
    const features: FeatureValue[] = [
      { id: "heading-density", value: 19 },
      { id: "section-uniformity", value: 1 },
      { id: "bold-labels", value: 0 },
      { id: "bookends", value: 2 },
      { id: "three-item-lists", value: undefined, notMeasured: "too-few-lists" },
    ];
    const scored = structureScoreOf(features, baseline);
    assert.equal(scored.score, 2);
    assert.equal(scored.compared, 3);
    assert.equal(scored.articles, 100);
    assert.deepEqual(
      scored.placements.map((placement) => [placement.feature.id, placement.beyond, placement.limit, placement.median]),
      [
        ["heading-density", true, 18, 10],
        ["section-uniformity", true, 2, 10],
        ["bold-labels", false, 0, 0],
        ["bookends", false, undefined, undefined],
        ["three-item-lists", false, undefined, undefined],
      ],
    );
  });

  it("compares nothing for a language without a baseline", () => {
    const scored = structureScoreOf([{ id: "bold-labels", value: 5 }], undefined);
    assert.deepEqual([scored.score, scored.compared, scored.articles], [0, 0, undefined]);
  });
});
