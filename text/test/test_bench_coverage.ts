import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { parse } from "yaml";
import { planOf, planProblems, unplanted, type PlantPlan } from "../scripts/bench-coverage.ts";
import { MUTATIONS } from "../scripts/bench-mutations.ts";

// yarn bench が誤りを植えるはずの rule の一覧（test/fixtures/bench/plants.yaml）。植える先が消えても、新しい rule が来ても、黙って通さない。

const plan: PlantPlan = {
  planted: { "doubled-word": ["ja", "en"], "latin-spacing": ["ja"] },
  notPlanted: { "sentence-rhythm": "the shape of the whole document" },
};
const RULES = ["doubled-word", "latin-spacing", "sentence-rhythm"];
const MUTATED = [
  { rule: "doubled-word", languages: ["ja"] },
  { rule: "doubled-word", languages: ["en"] },
  { rule: "latin-spacing", languages: ["ja"] },
];

describe("planOf", () => {
  it("planted（rule と言語）と not_planted（rule と理由）を読む", () => {
    assert.deepEqual(planOf({ planted: { "doubled-word": ["ja", "en"] }, not_planted: { "sentence-rhythm": "a shape" } }), {
      planted: { "doubled-word": ["ja", "en"] },
      notPlanted: { "sentence-rhythm": "a shape" },
    });
  });

  it("形の違うものは読まずに止まる。言語の無い planted、理由の無い not_planted、どちらかの欠け", () => {
    assert.throws(() => planOf({ planted: { "doubled-word": [] }, not_planted: {} }), /doubled-word/u);
    assert.throws(() => planOf({ planted: { "doubled-word": "ja" }, not_planted: {} }), /doubled-word/u);
    assert.throws(() => planOf({ planted: {}, not_planted: { "sentence-rhythm": "" } }), /sentence-rhythm/u);
    assert.throws(() => planOf({ planted: {} }), /not_planted/u);
    assert.throws(() => planOf(undefined), /planted/u);
  });
});

describe("planProblems", () => {
  it("rule も植える誤りも一覧と合っていれば、何も言わない", () => {
    assert.deepEqual(planProblems(plan, RULES, MUTATED), []);
  });

  it("一覧に無い rule、無くなった rule、両方に書いた rule を言う", () => {
    assert.deepEqual(planProblems(plan, [...RULES, "rule-of-three"], MUTATED), [
      "rule-of-three: not in test/fixtures/bench/plants.yaml (planted or not_planted)",
    ]);
    assert.deepEqual(planProblems(plan, ["doubled-word", "latin-spacing"], MUTATED), ["sentence-rhythm: in test/fixtures/bench/plants.yaml but no such rule"]);
    assert.deepEqual(planProblems({ ...plan, notPlanted: { ...plan.notPlanted, "latin-spacing": "x" } }, RULES, MUTATED), [
      "latin-spacing: both planted and not_planted in test/fixtures/bench/plants.yaml",
      "latin-spacing: listed as not_planted, but a mutation plants it",
    ]);
  });

  it("植えるはずの言語に誤りが無い rule と、植えないはずなのに誤りがある rule を言う", () => {
    assert.deepEqual(planProblems(plan, RULES, MUTATED.slice(1)), ["doubled-word: no mutation plants it in ja"]);
    assert.deepEqual(planProblems(plan, RULES, [...MUTATED, { rule: "sentence-rhythm", languages: ["en"] }]), [
      "sentence-rhythm: listed as not_planted, but a mutation plants it",
    ]);
  });
});

describe("unplanted", () => {
  const outcome = (sample: string, rule: string): { readonly sample: string; readonly rule: string } => ({ sample, rule });

  it("植えるはずの言語で、一つの見本にも植わらなかった rule を言う", () => {
    const outcomes = [outcome("ja/blog", "doubled-word"), outcome("en/press", "doubled-word"), outcome("ja/press", "latin-spacing")];
    assert.deepEqual(unplanted(plan, outcomes), []);
    assert.deepEqual(unplanted(plan, outcomes.slice(1)), ["doubled-word: planted in no ja sample"]);
    assert.deepEqual(unplanted(plan, []), [
      "doubled-word: planted in no ja sample",
      "doubled-word: planted in no en sample",
      "latin-spacing: planted in no ja sample",
    ]);
  });

  it("別の言語の見本に植わっても数えない", () => {
    assert.deepEqual(unplanted({ planted: { "latin-spacing": ["ja"] }, notPlanted: {} }, [outcome("en/blog", "latin-spacing")]), [
      "latin-spacing: planted in no ja sample",
    ]);
  });
});

describe("test/fixtures/bench/plants.yaml", () => {
  const committed = planOf(parse(readFileSync(join(import.meta.dirname, "fixtures", "bench", "plants.yaml"), "utf8")));
  const rules = readdirSync(join(import.meta.dirname, "..", "packages", "chaff", "rules"))
    .filter((file) => file.endsWith(".yaml"))
    .map((file) => file.replace(/\.yaml$/u, ""));

  it("どの rule も planted か not_planted のどちらかにあり、planted の言語ごとに植える誤りがある", () => {
    assert.deepEqual(planProblems(committed, rules, MUTATIONS), []);
  });

  it("ngram-repetition は両方の言語で植える", () => {
    assert.deepEqual(committed.planted["ngram-repetition"], ["ja", "en"]);
  });
});
