import { describe, it, before } from "node:test";
import assert from "node:assert/strict";
import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { limitFor, runRulesWith, wantsTags } from "../packages/chaff/src/run.ts";
import { CROSS_DETECTORS, DETECTORS } from "../packages/chaff/src/detectors/index.ts";
import { FILTERS } from "../packages/chaff/src/semantic.ts";
import { adapter as ja } from "../packages/lang-ja/src/index.ts";
import { adapter as en } from "../packages/lang-en/src/index.ts";
import { isLevel } from "../packages/chaff/src/levels.ts";
import type { Detector, LanguageAdapter, Level, ProseDocument, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import type { RuleExample } from "../packages/chaff/src/rule-guide.ts";
import { EXAMPLE_GENRE, withPadding } from "../scripts/rule-examples.ts";

// A rule that reads tokens must say so (requires or uses: [pos]): the analyser is loaded only for rules that ask for it,
// and a rule reading tokens that were never made finds nothing, silently. A rule that says so and never reads them makes
// every run pay for the analyser. Each rule runs on its own example, with every token list in the document watched.

const ADAPTERS: Readonly<Record<string, LanguageAdapter>> = { ja, en };
const RULES: Readonly<Record<string, readonly RuleDefinition[]>> = { ja: loadRules("ja"), en: loadRules("en") };
const TOKEN_FIELDS: ReadonlySet<string> = new Set(["tokens", "headingTokens"]);

/** Whether a token list was read while a rule's own code ran. */
type Watch = { running: boolean; read: boolean; ran: boolean };

const isObject = (value: unknown): value is object => typeof value === "object" && value !== null;

/** Replaces every token list in the document with a getter that marks the watch, leaving lazy getters untouched. */
const watchTokens = (value: unknown, watch: Watch, seen: Set<object>): void => {
  if (!isObject(value) || seen.has(value) || value instanceof Set || value instanceof Map) return;
  seen.add(value);
  Object.keys(value).forEach((key) => {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (field === undefined || !("value" in field)) return;
    const inner: unknown = field.value;
    if (TOKEN_FIELDS.has(key)) Object.defineProperty(value, key, { get: () => markRead(watch, inner), enumerable: true, configurable: true });
    watchTokens(inner, watch, seen);
  });
};

const markRead = (watch: Watch, inner: unknown): unknown => {
  if (watch.running) watch.read = true;
  return inner;
};

const during = <T>(watch: Watch, run: () => T): T => {
  watch.running = true;
  watch.ran = true;
  try {
    return run();
  } finally {
    watch.running = false;
  }
};

const watchedDocument = (path: string, text: string, adapter: LanguageAdapter, watch: Watch): ProseDocument => {
  const doc = buildDocument(path, text, adapter);
  watchTokens(doc, watch, new Set());
  return doc;
};

const genreOf = (example: RuleExample): string => {
  const genre = example.config?.["genre"];
  return typeof genre === "string" ? genre : EXAMPLE_GENRE;
};

const optionsOf = (example: RuleExample): Readonly<Record<string, unknown>> => {
  const options = example.config?.["options"];
  return isObject(options) ? Object.fromEntries(Object.entries(options)) : {};
};

/** The level the example's chaff.yaml sets the rule at, or normal. */
const levelOf = (rule: RuleDefinition, example: RuleExample): Level => {
  const levels = example.config?.["rules"];
  const level: unknown = isObject(levels) ? Object.entries(levels).find(([id]) => id === rule.id)?.[1] : undefined;
  return isLevel(level) ? level : "normal";
};

/** The rule alone, through the run, with its detector watched; every other rule off. */
const runAlone = (rule: RuleDefinition, rules: readonly RuleDefinition[], doc: ProseDocument, example: RuleExample, watch: Watch): void => {
  const detector = DETECTORS[rule.how_to_find];
  if (detector === undefined) return;
  const watched: Detector = (watchedDoc, options) => during(watch, () => detector(watchedDoc, options));
  const settings = Object.fromEntries(rules.map((entry) => [entry.id, entry.id === rule.id ? levelOf(rule, example) : "off"] as const));
  runRulesWith(doc, rules, {
    settings,
    experimental: true,
    genre: genreOf(example),
    detectors: { [rule.id]: watched },
    optionLayers: [{ from: "chaff.yaml", values: optionsOf(example) }],
  });
};

/** A rule that compares documents, on its example and the other file it names. */
const runAcross = (rule: RuleDefinition, doc: ProseDocument, other: ProseDocument, example: RuleExample, watch: Watch): void => {
  const detector = CROSS_DETECTORS[rule.how_to_find];
  if (detector === undefined) return;
  const options = {
    limit: limitFor(rule, levelOf(rule, example), genreOf(example), {}),
    lexicon: rule.word_list === undefined ? undefined : doc.lexicons[rule.word_list],
    where: rule.where,
  };
  during(watch, () => detector([doc, other], options));
};

/** A rule chaff test judges: only the filter that picks what to send runs here. */
const runFilter = (rule: RuleDefinition, doc: ProseDocument, watch: Watch): void => {
  const filter = FILTERS[rule.how_to_find];
  if (filter !== undefined) during(watch, () => filter(doc));
};

const tryExample = (rule: RuleDefinition, language: string, example: RuleExample, watch: Watch): void => {
  const adapter = ADAPTERS[language];
  const rules = RULES[language];
  if (adapter === undefined || rules === undefined) return;
  const doc = watchedDocument("t.md", withPadding(example.before, example, language), adapter, watch);
  if (rule.layer === "L4") return runFilter(rule, doc, watch);
  if (!rule.requires.includes("documents")) return runAlone(rule, rules, doc, example, watch);
  runAcross(rule, doc, watchedDocument("a.md", example.other ?? example.after, adapter, watch), example, watch);
};

/** Whether the rule read tokens on any of its examples, or undefined when its code never ran there. */
const readsTokens = (rule: RuleDefinition): boolean | undefined => {
  const watch: Watch = { running: false, read: false, ran: false };
  Object.entries(rule.guide?.examples ?? {}).forEach(([language, example]) => tryExample(rule, language, example, watch));
  return watch.ran ? watch.read : undefined;
};

describe("a rule reads tokens exactly when it says it does (requires or uses: [pos])", () => {
  before(async () => {
    await ja.prepare?.({ pos: true });
    await en.prepare?.({ pos: true });
  });

  const rules = loadRules("en").filter((rule) => rule.from.length === 0);

  rules.forEach((rule) => {
    it(rule.id, () => {
      const read = readsTokens(rule);
      assert.notEqual(read, undefined, "the rule's code never ran on its examples, so what it reads is unknown");
      assert.equal(
        wantsTags(rule),
        read,
        read === true ? "reads tokens but declares neither requires nor uses: [pos]" : "declares pos but never reads tokens on its examples",
      );
    });
  });

  it("a rule built from other rules' findings reads no tokens, so declares none", () => {
    assert.deepEqual(
      loadRules("en")
        .filter((rule) => rule.from.length > 0 && wantsTags(rule))
        .map((rule) => rule.id),
      [],
    );
  });
});
