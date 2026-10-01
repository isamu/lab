import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { localized } from "../packages/chaff/src/render/text.ts";
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
