import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { rulesByGroup } from "../packages/chaff/src/rule-guide.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { runAllExamples } from "../scripts/rule-examples.ts";

// The guide's reference (site/src/content/guide/*/reference.md) is built from these fields of every rule file.
// A rule without them would drop off the page, or show a reader an example chaff says nothing about.

const rules = loadRules("en");
const READER_LANGUAGES = ["ja", "en"];

const languagesOf = (rule: RuleDefinition): readonly string[] => rule.languages ?? READER_LANGUAGES;

/** A level's number needs words only when the levels differ; L4 keeps severities there, not numbers. */
const needsLevelMeaning = (rule: RuleDefinition): boolean => rule.layer !== "L4" && new Set(Object.values(rule.levels)).size > 1;

const lackingOf = (rule: RuleDefinition): string[] => [
  ...(rule.guide?.group === undefined ? ["group"] : []),
  ...READER_LANGUAGES.filter((language) => (rule.guide?.summary[language] ?? "") === "").map((language) => `summary.${language}`),
  ...languagesOf(rule)
    .filter((language) => rule.guide?.examples[language] === undefined)
    .map((language) => `example.${language} (before and after)`),
  ...READER_LANGUAGES.filter((language) => (rule.guide?.notFlagged[language] ?? "") === "").map((language) => `not_flagged.${language}`),
  ...(needsLevelMeaning(rule) ? READER_LANGUAGES : [])
    .filter((language) => !(rule.guide?.levelMeaning[language] ?? "").includes("{limit}"))
    .map((language) => `level_meaning.${language} (with {limit})`),
];

describe("rule reference — the plain-language fields of every rule file", () => {
  it("every rule has a group, a summary and what it does not flag in both languages, an example in each language it checks, and words for its levels", () => {
    const lacking = rules.flatMap((rule) => {
      const fields = lackingOf(rule);
      return fields.length === 0 ? [] : [`${rule.id}.yaml lacks ${fields.join(", ")}`];
    });
    assert.deepEqual(lacking, []);
  });

  it("no rule has an example in a language it does not check", () => {
    const stray = rules.flatMap((rule) =>
      Object.keys(rule.guide?.examples ?? {})
        .filter((language) => !languagesOf(rule).includes(language))
        .map((language) => `${rule.id}: example.${language}`),
    );
    assert.deepEqual(stray, []);
  });

  it("the reference lists every rule, once", () => {
    const listed = rulesByGroup(rules, (rule) => rule.guide?.group).flatMap(({ rules: members }) => members.map((rule) => rule.id));
    const byName = (left: string, right: string): number => left.localeCompare(right, "en");
    assert.deepEqual(listed.toSorted(byName), rules.map((rule) => rule.id).toSorted(byName));
  });
});

describe("rule reference — chaff says what the page says it says", () => {
  it("each example's before is reported by its rule, and its after is not (chaff test's rules are read by an AI, not run here)", async () => {
    const outcomes = await runAllExamples(rules.filter((rule) => rule.layer !== "L4"));
    const wrong = outcomes.flatMap((outcome) => [
      ...(outcome.before.length === 0 ? [`${outcome.rule} ${outcome.language}: before is not reported`] : []),
      ...outcome.after.map((finding) => `${outcome.rule} ${outcome.language}: after is still reported: ${finding.message}`),
    ]);
    assert.deepEqual(wrong, []);
  });
});
