import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import type { RuleRewrite } from "../packages/chaff/src/rule-guide.ts";
import type { Lexicon, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { loadLexicons as loadJaLexicons } from "../packages/lang-ja/src/lexicons.ts";
import { loadLexicons as loadEnLexicons } from "../packages/lang-en/src/lexicons.ts";

// chaff fix-plan hands a rewriter each rule's rewrite block. A rule a rewriter meets most often must have one,
// and a block that is written must be whole: a direction, pairs to copy the shape from, what to keep, what to avoid.

/** The AI-shape and common readability rules: the ones a rewrite pass is run for. */
const NEEDS_REWRITE = [
  "ai-tell",
  "contrast-framing",
  "stock-transition",
  "announcing-opener",
  "colon-lead-in",
  "assistant-residue",
  "closing-cliche",
  "padded-intro",
  "bold-density",
  "no-em-dash",
  "rule-of-three",
  "sentence-rhythm",
  "max-sentence-length",
  "taigen-dome-in-prose",
  "agentless-passive",
  "excessive-hedging",
  "empty-intensifier",
  "cushion-phrase-density",
  "nominalization",
];

/** Rules whose direction is to keep one of the phrases and drop the rest, so an after may hold one. */
const KEEPS_ONE: ReadonlySet<string> = new Set(["cushion-phrase-density", "excessive-hedging"]);

/** Rules that count their word list's words in a sentence (読点, 的): an after keeps a few, under the limit. */
const COUNTS_ITS_WORDS: ReadonlySet<string> = new Set(["max-ten", "teki-overuse", "adversative-ga-repeat", "demonstrative-opener-run"]);

/** Rules whose word list names the context around a finding (する after 〜たり, 開始 after より), which an after keeps. */
const LISTS_ITS_CONTEXT: ReadonlySet<string> = new Set(["tari-unpaired", "yori-as-from"]);

const MIN_PAIRS = 2;
const MAX_PAIRS = 3;
const READER_LANGUAGES = ["ja", "en"];

const rules = loadRules("en");
const lexiconsByLanguage: Readonly<Record<string, Readonly<Record<string, Lexicon>>>> = { ja: loadJaLexicons(), en: loadEnLexicons() };

const languagesOf = (rule: RuleDefinition): readonly string[] => rule.languages ?? READER_LANGUAGES;

const rewritesOf = (rule: RuleDefinition): Readonly<Record<string, RuleRewrite>> => rule.guide?.rewrite ?? {};

const lackingIn = (rewrite: RuleRewrite): string[] => [
  ...(rewrite.direction === "" ? ["direction"] : []),
  ...(rewrite.pairs.length < MIN_PAIRS || rewrite.pairs.length > MAX_PAIRS ? [`${MIN_PAIRS}–${MAX_PAIRS} pairs (has ${rewrite.pairs.length})`] : []),
  ...(rewrite.keep.length === 0 ? ["keep"] : []),
  ...(rewrite.avoid.length === 0 ? ["avoid"] : []),
];

/**
 * The phrases the rule's own word lists flag in a language; an after that holds one teaches the habit it should cure.
 * An entry that names its other way (instead_of) is one of two ways a consistency rule compares, and neither is flagged.
 */
const flaggedPhrases = (rule: RuleDefinition, language: string): string[] =>
  [rule.word_list, ...rule.extra_word_lists]
    .flatMap((name) => (name === undefined ? [] : (lexiconsByLanguage[language]?.[name] ?? [])))
    .filter((entry) => entry.instead_of === undefined)
    .map((entry) => entry.pattern.toLowerCase());

/** Each pair's after that still holds a phrase the rule flags, as "rule language: phrase in after". */
/** Rules whose word list says how words sound (article-sound's vowel letters), not phrases the rule flags. */
const SOUND_LISTS: ReadonlySet<string> = new Set(["article-sound"]);

const relapsesOf = (rule: RuleDefinition): string[] =>
  Object.entries(rewritesOf(rule)).flatMap(([language, rewrite]) => {
    const phrases = SOUND_LISTS.has(rule.id) ? [] : flaggedPhrases(rule, language);
    const afters = rewrite.pairs.map((pair) => pair.after);
    return afters.flatMap((after) =>
      phrases.filter((phrase) => after.toLowerCase().includes(phrase)).map((phrase) => `${rule.id} ${language}: "${phrase}" in "${after}"`),
    );
  });

describe("rule rewrite — the direction chaff fix-plan hands a rewriter", () => {
  it("the AI-shape and readability rules have a rewrite block in every language they check", () => {
    const missing = NEEDS_REWRITE.flatMap((id) => {
      const rule = rules.find((entry) => entry.id === id);
      if (rule === undefined) return [`${id}: no such rule`];
      return languagesOf(rule)
        .filter((language) => rewritesOf(rule)[language] === undefined)
        .map((language) => `${id}.yaml lacks rewrite.${language}`);
    });
    assert.deepEqual(missing, []);
  });

  it("every rewrite block that is written has a direction, two or three pairs, what to keep and what to avoid", () => {
    const lacking = rules.flatMap((rule) =>
      Object.entries(rewritesOf(rule)).flatMap(([language, rewrite]) => {
        const fields = lackingIn(rewrite);
        return fields.length === 0 ? [] : [`${rule.id}.yaml rewrite.${language} lacks ${fields.join(", ")}`];
      }),
    );
    assert.deepEqual(lacking, []);
  });

  it("no rule has a rewrite block in a language it does not check", () => {
    const stray = rules.flatMap((rule) =>
      Object.keys(rewritesOf(rule))
        .filter((language) => !languagesOf(rule).includes(language))
        .map((language) => `${rule.id}: rewrite.${language}`),
    );
    assert.deepEqual(stray, []);
  });

  it("no pair's after holds a phrase the rule's own word list flags, unless the direction keeps one", () => {
    const relapsed = rules.filter((rule) => !KEEPS_ONE.has(rule.id) && !COUNTS_ITS_WORDS.has(rule.id) && !LISTS_ITS_CONTEXT.has(rule.id)).flatMap(relapsesOf);
    assert.deepEqual(relapsed, []);
  });
});

describe("rule rewrite — a phrase's own hint in the lexicon", () => {
  it("an ai-tell entry carries its hint, in the lexicon's language", () => {
    const hintOf = (language: string, pattern: string): string | undefined =>
      lexiconsByLanguage[language]?.["ai-tell"]?.find((entry) => entry.pattern === pattern)?.rewrite;
    assert.equal(hintOf("ja", "時間を溶かす"), "時間がかかった（何に、どれだけ）");
    assert.equal(hintOf("ja", "静かに壊れる"), "エラーを出さずに失敗する");
    assert.equal(hintOf("en", "delve into"), "look at, or explain");
  });

  it("an entry without a hint has none, and a hint is never empty", () => {
    const entries = Object.values(lexiconsByLanguage).flatMap((lexicons) => lexicons["ai-tell"] ?? []);
    assert.ok(entries.some((entry) => entry.rewrite === undefined));
    assert.deepEqual(
      entries.filter((entry) => entry.rewrite !== undefined && entry.rewrite.trim() === "").map((entry) => entry.pattern),
      [],
    );
  });
});
