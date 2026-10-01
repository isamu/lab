import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { localized } from "../packages/chaff/src/render/text.ts";
import { renderExplain } from "../packages/chaff/src/render/explain.ts";
import { uiLanguageOf } from "../packages/chaff/src/ui.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import type { LanguageAdapter, LengthUnit, RuleDefinition } from "../packages/chaff/src/plugin.ts";

// A density rule's message is read in the document's language, so it must name the unit that language is measured in.

/** The rules that measure per 1000 of something other than the document's length unit. Everything else divides by it. */
const FIXED_UNIT: Readonly<Record<string, LengthUnit>> = { "bold-density": "char" };

const PER_THOUSAND = /1000 ?[字語]|per 1000 (characters|words)/u;

const UNIT_WORD: Readonly<Record<"ja" | "en", Readonly<Record<LengthUnit, RegExp>>>> = {
  ja: { char: /1000 ?字/u, word: /1000 ?語/u },
  en: { char: /per 1000 characters/u, word: /per 1000 words/u },
};

/** The density rules there are now. A new one is checked as soon as its text says per 1000. */
const KNOWN = [
  "proper-noun-density",
  "cushion-phrase-density",
  "emoji-density",
  "excessive-hedging",
  "contrast-framing",
  "stock-transition",
  "no-em-dash",
  "bold-density",
];

const unitOf = (rule: RuleDefinition, adapter: LanguageAdapter): LengthUnit => FIXED_UNIT[rule.id] ?? adapter.capabilities.lengthUnit;

/** Every per-1000 text a reader of this language sees: the messages and what a level means. */
const textsOf = (rule: RuleDefinition, language: string): string[] =>
  [rule.message, ...Object.values(rule.messages), rule.guide?.levelMeaning ?? {}]
    .map((field) => localized(field, language))
    .filter((text) => PER_THOUSAND.test(text));

type Case = { readonly adapter: LanguageAdapter; readonly rule: RuleDefinition; readonly text: string };

/** Each per-1000 text, in the language a document of this adapter is reported in. */
const casesOf = (adapter: LanguageAdapter): Case[] =>
  loadRules(adapter.id)
    .filter((rule) => rule.languages === undefined || rule.languages.includes(adapter.id))
    .flatMap((rule) => textsOf(rule, uiLanguageOf(adapter.id)).map((text) => ({ adapter, rule, text })));

describe("density messages name the unit they measure", () => {
  [ja, en].flatMap(casesOf).forEach(({ adapter, rule, text }) => {
    it(`${adapter.id}: ${rule.id}: ${text}`, () => {
      assert.match(text, UNIT_WORD[uiLanguageOf(adapter.id)][unitOf(rule, adapter)]);
    });
  });

  it("reads every known density rule as one", () => {
    const measured = new Set(
      loadRules("ja")
        .filter((rule) => textsOf(rule, "ja").length > 0)
        .map((rule) => rule.id),
    );
    assert.deepEqual(
      KNOWN.filter((id) => !measured.has(id)),
      [],
    );
  });
});

/** A level line of chaff explain is "  → normal   <value>": the level's name from column 4, padded to 9, then the value. */
const NAME_COLUMNS = { start: 4, end: 13 } as const;
const COUNTED_LEVELS = new Set(["strict", "normal", "relaxed"]);

const levelValuesOf = (explained: string): string[] =>
  explained
    .split("\n")
    .filter((line) => COUNTED_LEVELS.has(line.slice(NAME_COLUMNS.start, NAME_COLUMNS.end).trim()))
    .map((line) => line.slice(NAME_COLUMNS.end));

/** The density rules of this adapter, once each. */
const densityRulesOf = (adapter: LanguageAdapter): RuleDefinition[] => [...new Map(casesOf(adapter).map(({ rule }) => [rule.id, rule])).values()];

/** A level that says only "1000 字あたり N 個" or "up to N per 1000 words" does not say what is counted. */
const COUNT_ONLY = /^1000 ?[字語]あたり \d+ 個|^up to \d+ per 1000/u;

describe("explain says what a density level counts, per 1000 of the unit it measures", () => {
  const densityCases = [ja, en].flatMap((adapter) => densityRulesOf(adapter).map((rule) => ({ adapter, rule })));
  densityCases.forEach(({ adapter, rule }) => {
    it(`${adapter.id}: ${rule.id}`, () => {
      const values = levelValuesOf(renderExplain(rule, "normal", adapter.id));
      assert.notEqual(values.length, 0);
      values.forEach((value) => {
        assert.match(value, UNIT_WORD[uiLanguageOf(adapter.id)][unitOf(rule, adapter)]);
        assert.doesNotMatch(value, COUNT_ONLY);
      });
    });
  });

  it("a rule that does not say what a level means shows its limits as a number of times", () => {
    const [rule] = densityRulesOf(en);
    assert.ok(rule?.guide !== undefined);
    const unsaid: RuleDefinition = { ...rule, guide: { ...rule.guide, levelMeaning: {} } };
    const english = levelValuesOf(renderExplain(unsaid, "normal", "en"));
    assert.notEqual(english.length, 0);
    english.forEach((value) => assert.match(value, /^\d+(\.\d+)? times$/u));
    const japanese = levelValuesOf(renderExplain(unsaid, "normal", "ja"));
    assert.notEqual(japanese.length, 0);
    japanese.forEach((value) => assert.match(value, /^\d+(\.\d+)? 回$/u));
  });
});
