import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { fill, localized } from "../packages/chaff/src/render/text.ts";
import { renderExplain } from "../packages/chaff/src/render/explain.ts";
import type { RuleDefinition } from "../packages/chaff/src/plugin.ts";

const rulesById = new Map<string, RuleDefinition>([...loadRules("en"), ...loadRules("ja")].map((rule) => [rule.id, rule]));
const rules = [...rulesById.values()];

const ruleOf = (id: string): RuleDefinition => {
  const rule = rulesById.get(id);
  if (rule === undefined) throw new Error(`no rule ${id}`);
  return rule;
};

const englishAt = (rule: RuleDefinition, limit: number): string => fill(localized(rule.guide?.levelMeaning ?? {}, "en"), { limit });

/**
 * A word after {limit} that reads the same at 1 and at 2 (1 or fewer, 1 per 1000, 1 kanji, fewer than 1 content words).
 * Any other word after it needs an agreeing form ({limit|word|words}) somewhere in the template.
 */
const SAME_AT_ONE = /^(?:or|per|percent|of|deep|kanji|emoji|contrastive|"very"|content)$/u;

const disagreesAtOne = (template: string): boolean => {
  if (template.includes("{limit|")) return false;
  if (/\bthere are \{limit\}/u.test(template)) return true;
  return [...template.matchAll(/\{limit\} (\S+)/gu)].some((match) => !SAME_AT_ONE.test(match[1] ?? ""));
};

const nowLine = (rule: RuleDefinition, limit: number, language = "en"): string =>
  renderExplain(rule, "normal", language, undefined, { limit })
    .split("\n")
    .find((line) => line.includes("Now:") || line.includes("いまは"))
    ?.trim() ?? "";

describe("level_meaning agrees with its number", () => {
  it("no rule's English level line reads wrong at a limit of 1", () => {
    const wrong = rules.filter((rule) => disagreesAtOne(localized(rule.guide?.levelMeaning ?? {}, "en"))).map((rule) => `${rule.id}: ${englishAt(rule, 1)}`);
    assert.deepEqual(wrong, []);
  });

  it("the singular at 1, the plural otherwise", () => {
    const rule = ruleOf("closing-exhortation");
    assert.equal(englishAt(rule, 1), "reported once 1 closing sentence cheers the reader on");
    assert.equal(englishAt(rule, 2), "reported once 2 closing sentences cheer the reader on");
    assert.equal(englishAt(ruleOf("figurative-density"), 1), "up to 1 decorative figure per 1000 words");
    assert.equal(englishAt(ruleOf("figurative-density"), 1.5), "up to 1.5 decorative figures per 1000 words");
    assert.equal(englishAt(ruleOf("cliche"), 1), "reported once there is 1");
    assert.equal(englishAt(ruleOf("cliche"), 3), "reported once there are 3");
  });

  it("explain shows the agreeing form, and Japanese is unchanged", () => {
    const rule = ruleOf("closing-exhortation");
    assert.match(nowLine(rule, 1), /reported once 1 closing sentence cheers the reader on/u);
    assert.match(nowLine(rule, 3), /reported once 3 closing sentences cheer the reader on/u);
    assert.match(nowLine(rule, 1, "ja"), /結びの励ます・請け合う文が 1 個あれば指摘/u);
  });

  it("a rule that does not say what a level means counts times, one time at 1", () => {
    const rule = ruleOf("closing-exhortation");
    const unsaid: RuleDefinition = rule.guide === undefined ? rule : { ...rule, guide: { ...rule.guide, levelMeaning: {} } };
    assert.match(nowLine(unsaid, 1), /Now: 1 time,/u);
    assert.match(nowLine(unsaid, 2), /Now: 2 times,/u);
    assert.match(nowLine(unsaid, 1, "ja"), /いまは段階ではなく数です: 1 回。/u);
  });
});
