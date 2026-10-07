import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { LanguageAdapter } from "../packages/chaff/src/plugin.ts";
import {
  aiScoreOf,
  HIGH_SIGNS,
  isRare,
  levelOf,
  MEDIUM_SIGNS,
  MIN_BASELINE_DOCUMENTS,
  RARE_SHARE,
  shownSignsOf,
  TOGETHER_SIGN,
  TOGETHER_SIGNALS,
  type HumanShares,
  type ScoreInput,
  type SignalRun,
} from "../packages/chaff/src/ai-score/score.ts";
import { aiScoreOfDocument, genreGroupOf } from "../packages/chaff/src/ai-score/of-document.ts";
import { aiShapeRuleIds, compositeLevels, scoredSignalIds, SAME_SHAPE } from "../packages/chaff/src/ai-score/signals.ts";
import type { FeatureValue } from "../packages/chaff/src/structure-shape/features.ts";
import type { StructureScore } from "../packages/chaff/src/structure-shape/score.ts";

// The AI-likeness quick score: signs of generated text that human documents of the genre group rarely show, as low,
// medium or high. Every text here is written for the test (test/fixtures/ai-score/).

const FIXTURES = join(import.meta.dirname, "fixtures", "ai-score");
const PAIRED = join(import.meta.dirname, "fixtures", "ai-samples", "paired");
const fixture = (name: string): string => readFileSync(join(FIXTURES, name), "utf8");

const RARE: Readonly<Record<string, { documents: number; fired: number }>> = { blog: { documents: 20, fired: 0 } };
const shares = (rules: readonly string[]): HumanShares => Object.fromEntries(rules.map((rule) => [rule, RARE]));

const SIGNALS = ["a", "b", "c", "d", "e", "f"];

const input = (fired: number, overrides: Partial<ScoreInput> = {}): ScoreInput => ({
  group: "blog",
  length: 1000,
  minimum: 500,
  unit: "char",
  signals: SIGNALS.map((rule, index): SignalRun => ({ rule, count: index < fired ? 1 : 0 })),
  shares: shares(SIGNALS),
  structure: undefined,
  compositeFired: [],
  ...overrides,
});

describe("levelOf: the boundaries", () => {
  it("is low below MEDIUM_SIGNS, medium from it, high from HIGH_SIGNS", () => {
    assert.equal(levelOf(0), "low");
    assert.equal(levelOf(MEDIUM_SIGNS - 1), "low");
    assert.equal(levelOf(MEDIUM_SIGNS), "medium");
    assert.equal(levelOf(HIGH_SIGNS - 1), "medium");
    assert.equal(levelOf(HIGH_SIGNS), "high");
    assert.equal(levelOf(HIGH_SIGNS * 2), "high");
  });

  it("is held to ai-generated-composite's normal and relaxed levels", () => {
    ["ja", "en"].forEach((language) => {
      const levels = compositeLevels(loadRules(language));
      assert.equal(MEDIUM_SIGNS, levels.normal, language);
      assert.equal(HIGH_SIGNS, levels.relaxed, language);
      assert.equal(TOGETHER_SIGNALS, levels.strict, language);
    });
  });

  it("calls a sign unusual where at most one human document in ten shows it, the structure measures' p90", () => {
    assert.equal(RARE_SHARE, 0.1);
    assert.equal(MIN_BASELINE_DOCUMENTS, 10);
    assert.equal(isRare({ documents: 10, fired: 1 }), true);
    assert.equal(isRare({ documents: 10, fired: 2 }), false);
    assert.equal(isRare({ documents: 20, fired: 0 }), true);
  });
});

describe("aiScoreOf", () => {
  it("counts the signals that fired and that human documents of the group rarely show", () => {
    const score = aiScoreOf(input(4));
    assert.equal(score.signs, 4);
    assert.equal(score.compared, 6);
    assert.equal(score.level, "medium");
    assert.equal(score.notScored, undefined);
    assert.deepEqual(
      score.signals.filter((signal) => signal.unusual).map((signal) => signal.rule),
      ["a", "b", "c", "d"],
    );
  });

  it("reads the level boundaries off the sign count", () => {
    assert.equal(aiScoreOf(input(MEDIUM_SIGNS - 1)).level, "low");
    assert.equal(aiScoreOf(input(MEDIUM_SIGNS)).level, "medium");
    assert.equal(aiScoreOf(input(HIGH_SIGNS)).level, "high");
  });

  it("does not count a signal common in human documents of the group, but still lists it", () => {
    const common = { ...shares(SIGNALS), a: { blog: { documents: 10, fired: 5 } } };
    const score = aiScoreOf(input(3, { shares: common }));
    assert.equal(score.signs, 2);
    assert.equal(score.signals[0]?.unusual, false);
    assert.equal(score.signals[0]?.count, 1);
    assert.deepEqual(score.signals[0]?.human, { documents: 10, fired: 5 });
  });

  it("does not compare a signal with too few human documents, or none in the group", () => {
    const thin = { ...shares(SIGNALS), a: { blog: { documents: MIN_BASELINE_DOCUMENTS - 1, fired: 0 } }, b: { business: { documents: 50, fired: 0 } } };
    const score = aiScoreOf(input(2, { shares: thin }));
    assert.equal(score.signs, 0);
    assert.equal(score.compared, 4);
    assert.equal(score.signals[0]?.human, undefined);
    assert.equal(score.signals[1]?.human, undefined);
  });

  it("does not compare a signal that did not run, and keeps its reason", () => {
    const signals: SignalRun[] = [...input(0).signals.slice(1), { rule: "a", count: 0, notRun: "needs headings" }];
    const score = aiScoreOf(input(0, { signals }));
    assert.equal(score.compared, 5);
    assert.equal(score.signals.at(-1)?.notRun, "needs headings");
  });

  it("is not scored when the document is shorter than the minimum, with the length and the minimum", () => {
    const score = aiScoreOf(input(6, { length: 499 }));
    assert.equal(score.level, undefined);
    assert.deepEqual(score.notScored, { reason: "too-short", length: 499, minimum: 500, unit: "char" });
    assert.equal(aiScoreOf(input(6, { length: 500 })).level, "high");
  });

  it("is not scored when fewer signs can be compared than the high boundary: a low there would say nothing", () => {
    const score = aiScoreOf(input(0, { group: "academic" }));
    assert.equal(score.level, undefined);
    assert.deepEqual(score.notScored, { reason: "no-baseline", compared: 0, needed: HIGH_SIGNS });
    const few = aiScoreOf(input(0, { signals: input(0).signals.slice(0, HIGH_SIGNS - 1) }));
    assert.equal(few.notScored?.reason, "no-baseline");
    assert.equal(aiScoreOf(input(0, { signals: input(0).signals.slice(0, HIGH_SIGNS) })).level, "low");
  });

  it("adds the structure measures past the human p90, and counts a shape a signal already counts once", () => {
    const feature = (id: FeatureValue["id"], value: number): FeatureValue => ({ id, value });
    const placement = (id: FeatureValue["id"], beyond: boolean) => ({
      feature: feature(id, 1),
      direction: "high" as const,
      pastShare: beyond ? 95 : 0,
      limit: 1,
      median: 0,
      beyond,
    });
    const structure: StructureScore = {
      placements: [placement("bold-labels", true), placement("heading-density", true), placement("pro-con", false)],
      score: 2,
      compared: 3,
      articles: 100,
    };
    const twin = SAME_SHAPE["bold-labels"] ?? "";
    const signals: SignalRun[] = [{ rule: twin, count: 2 }, ...SIGNALS.map((rule) => ({ rule, count: 0 }))];
    const score = aiScoreOf(input(0, { signals, shares: shares([twin, ...SIGNALS]), structure }));
    assert.equal(score.signs, 2);
    assert.equal(score.structure?.[0]?.sameAs, twin);
    assert.equal(score.structure?.[1]?.sameAs, undefined);
    assert.equal(score.compared, SIGNALS.length + 1 + 2);
  });
});

describe("aiScoreOf: the together sign", () => {
  const composite = (count: number): string[] => ["announcing-opener", "contrast-framing", "no-em-dash"].slice(0, count);

  it("adds one sign when TOGETHER_SIGNALS of the composite's signals fired, and shows it", () => {
    const score = aiScoreOf(input(MEDIUM_SIGNS - 1, { compositeFired: composite(TOGETHER_SIGNALS) }));
    assert.equal(score.signs, MEDIUM_SIGNS);
    assert.equal(score.level, "medium");
    assert.deepEqual(score.together, { fired: composite(TOGETHER_SIGNALS), counted: true });
    assert.equal(shownSignsOf(score).at(-1), TOGETHER_SIGN);
  });

  it("adds one sign however many fired together, not one per signal", () => {
    assert.equal(aiScoreOf(input(0, { compositeFired: composite(TOGETHER_SIGNALS + 1) })).signs, 1);
  });

  it("adds nothing below TOGETHER_SIGNALS, and keeps what fired", () => {
    const score = aiScoreOf(input(MEDIUM_SIGNS - 1, { compositeFired: composite(TOGETHER_SIGNALS - 1) }));
    assert.equal(score.signs, MEDIUM_SIGNS - 1);
    assert.equal(score.level, "low");
    assert.deepEqual(score.together, { fired: composite(TOGETHER_SIGNALS - 1), counted: false });
    assert.ok(!shownSignsOf(score).includes(TOGETHER_SIGN));
    assert.equal(aiScoreOf(input(0)).together.counted, false);
  });

  it("is not compared against a genre group, so it neither adds to compared nor lifts a document out of no-baseline", () => {
    assert.equal(aiScoreOf(input(0, { compositeFired: composite(TOGETHER_SIGNALS) })).compared, SIGNALS.length);
    const none = aiScoreOf(input(0, { group: "academic", compositeFired: composite(TOGETHER_SIGNALS) }));
    assert.equal(none.notScored?.reason, "no-baseline");
    assert.equal(none.level, undefined);
  });
});

describe("the signals", () => {
  it("are the AI-shape rules (group ai-tells, the composite's from, the markup shapes) but the two that add up others", () => {
    const rules = loadRules("ja");
    const group = rules.filter((rule) => rule.guide?.group === "ai-tells").map((rule) => rule.id);
    const from = rules.find((rule) => rule.id === "ai-generated-composite")?.from ?? [];
    const shape = aiShapeRuleIds(rules);
    [...group, ...from, "bold-density"].forEach((id) => assert.ok(shape.includes(id), id));
    const scored = scoredSignalIds(rules);
    assert.ok(!scored.includes("ai-generated-composite"));
    assert.ok(!scored.includes("ai-structure"));
    assert.ok(scored.includes("rule-of-three") && scored.includes("sentence-rhythm"));
  });

  it("pair each structure measure with a scored signal that reads the same shape", () => {
    const scored = scoredSignalIds(loadRules("ja"));
    Object.values(SAME_SHAPE).forEach((rule) => assert.ok(scored.includes(rule), rule));
  });

  it("read the genre group off the genre", () => {
    assert.equal(genreGroupOf("blog/tech"), "blog");
    assert.equal(genreGroupOf("business"), "business");
  });
});

const scoreOf = async (adapter: LanguageAdapter, name: string, genre = "blog/tech") => {
  await adapter.prepare?.({ pos: true });
  return aiScoreOfDocument(buildDocument(name, fixture(name), adapter), loadRules(adapter.id), genre);
};

describe("aiScoreOfDocument on written samples", () => {
  it("reads a generated-style article as high, in Japanese and English", async () => {
    assert.equal((await scoreOf(ja, "ja-ai.md")).level, "high");
    assert.equal((await scoreOf(en, "en-ai.md")).level, "high");
  });

  it("reads a plainly written article as low, in Japanese and English", async () => {
    assert.equal((await scoreOf(ja, "ja-plain.md")).level, "low");
    assert.equal((await scoreOf(en, "en-plain.md")).level, "low");
  });

  it("leaves out the signals of the other language", async () => {
    const score = await scoreOf(en, "en-plain.md");
    assert.ok(!score.signals.some((signal) => signal.rule === "colon-lead-in"));
  });

  it("does not compare the structure where the human articles are not its baseline", async () => {
    const score = await scoreOf(ja, "ja-ai.md", "business/report");
    assert.equal(score.structure, undefined);
    assert.equal(score.group, "business");
  });

  it("does not score a short text", async () => {
    await ja.prepare?.({ pos: true });
    const doc = buildDocument("short.md", "# 短い\n\nいかがでしたでしょうか。この記事が皆さんのお役に立てれば幸いです。\n", ja);
    const score = aiScoreOfDocument(doc, loadRules("ja"), "blog/tech");
    assert.equal(score.level, undefined);
    assert.equal(score.notScored?.reason, "too-short");
  });

  it("reads the paired generated-style essays as medium through the together sign, and their human pairs as low", async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
    const essay = (adapter: LanguageAdapter, variant: string) => {
      const name = join(PAIRED, adapter.id, "essay", `${variant}.md`);
      return aiScoreOfDocument(buildDocument(name, readFileSync(name, "utf8"), adapter), loadRules(adapter.id), "blog/essay");
    };
    [ja, en].forEach((adapter) => {
      const generated = essay(adapter, "ai");
      assert.equal(generated.level, "medium", adapter.id);
      assert.equal(generated.together.counted, true, adapter.id);
      ["human", "rewritten"].forEach((variant) => {
        const score = essay(adapter, variant);
        assert.notEqual(score.level, "medium", `${adapter.id}/${variant}`);
        assert.notEqual(score.level, "high", `${adapter.id}/${variant}`);
        assert.equal(score.together.counted, false, `${adapter.id}/${variant}`);
      });
    });
  });

  it("does not score a genre group with no human baseline", async () => {
    const score = await scoreOf(ja, "ja-ai.md", "speech/address");
    assert.equal(score.level, undefined);
    assert.equal(score.notScored?.reason, "no-baseline");
  });
});
