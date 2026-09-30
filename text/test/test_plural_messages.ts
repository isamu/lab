import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { messageOf, templateForReading } from "../packages/chaff/src/render/text.ts";
import { counted, formFor } from "../packages/chaff/src/render/plural.ts";
import { describeChange } from "../packages/chaff/src/watch.ts";
import { CLI_TEXT } from "../packages/chaff/src/cli-text.ts";
import { REASONS } from "../packages/chaff/src/reasons.ts";
import { feedbackDraft } from "../packages/chaff/src/feedback/draft.ts";
import type { Finding, RuleDefinition } from "../packages/chaff/src/plugin.ts";

// English agrees with the count: "1 such word", "2 such words", "1 of 1 section". Japanese has no plural.

const RULES = loadRules("en");

const ruleNamed = (id: string): RuleDefinition => {
  const rule = RULES.find((entry) => entry.id === id);
  if (rule === undefined) throw new Error(`no rule ${id}`);
  return rule;
};

const findingWith = (rule: string, values: Readonly<Record<string, string | number>>): Finding => ({
  rule,
  severity: "info",
  line: 1,
  column: 1,
  quote: "",
  values,
});

const english = (id: string, values: Readonly<Record<string, string | number>>): string => messageOf(ruleNamed(id), findingWith(id, values), "en");

/** [rule, the placeholder that carries the count, the other values, the message at 0, at 1, at 2]. */
type Case = readonly [string, string, Readonly<Record<string, string | number>>, string, string, string];

const CASES: readonly Case[] = [
  [
    "adverb-overuse",
    "density",
    { limit: 5 },
    "0 -ly adverbs per 1000 words (limit 5)",
    "1 -ly adverb per 1000 words (limit 5)",
    "2 -ly adverbs per 1000 words (limit 5)",
  ],
  [
    "ai-generated-composite",
    "count",
    { word: "delve", limit: 3 },
    '"delve" occur together in this document (0 signals, 3 needed)',
    '"delve" occurs in this document (1 signal, 3 needed)',
    '"delve" occur together in this document (2 signals, 3 needed)',
  ],
  [
    "ai-tell",
    "count",
    { word: "delve", density: 20, limit: 18 },
    '"delve" appear together (score 20, limit 18)',
    '"delve" appears (score 20, limit 18)',
    '"delve" appear together (score 20, limit 18)',
  ],
  [
    "bold-density",
    "bolds",
    { chars: 400, limit: 3 },
    "0 bold spans in 400 characters (limit 3 per 1000)",
    "1 bold span in 400 characters (limit 3 per 1000)",
    "2 bold spans in 400 characters (limit 3 per 1000)",
  ],
  [
    "concrete-evidence-density",
    "total",
    { word: "Scope", count: 0 },
    'Section "Scope" has no number, code or link (0 of 0 sections)',
    'Section "Scope" has no number, code or link (0 of 1 section)',
    'Section "Scope" has no number, code or link (0 of 2 sections)',
  ],
  [
    "expletive-construction",
    "count",
    { word: "It", limit: 3 },
    '"It is ..." appears 0 times (limit 3)',
    '"It is ..." appears 1 time (limit 3)',
    '"It is ..." appears 2 times (limit 3)',
  ],
  [
    "internal-jargon",
    "count",
    { matched: "OKR" },
    '"OKR" may only be understood inside your team (0 such words)',
    '"OKR" may only be understood inside your team (1 such word)',
    '"OKR" may only be understood inside your team (2 such words)',
  ],
  [
    "max-paragraph-length",
    "count",
    { limit: 6 },
    "This paragraph runs 0 sentences (limit 6)",
    "This paragraph runs 1 sentence (limit 6)",
    "This paragraph runs 2 sentences (limit 6)",
  ],
  [
    "max-sentence-length",
    "count",
    { limit: 30 },
    "This sentence runs 0 words (limit 30)",
    "This sentence runs 1 word (limit 30)",
    "This sentence runs 2 words (limit 30)",
  ],
  [
    "ngram-repetition",
    "count",
    { word: "in order to", limit: 3 },
    '"in order to" appears 0 times (limit 3)',
    '"in order to" appears 1 time (limit 3)',
    '"in order to" appears 2 times (limit 3)',
  ],
  [
    "no-doubled-joshi",
    "count",
    { word: "の", limit: 3 },
    '"の" repeats 0 times with no break (limit 3)',
    '"の" repeats 1 time with no break (limit 3)',
    '"の" repeats 2 times with no break (limit 3)',
  ],
  ["no-em-dash", "density", { limit: 3 }, "0 dashes per 1000 words (limit 3)", "1 dash per 1000 words (limit 3)", "2 dashes per 1000 words (limit 3)"],
  [
    "no-nakaguro-parallel",
    "count",
    { limit: 3 },
    "0 middle dots in this sentence (limit 3)",
    "1 middle dot in this sentence (limit 3)",
    "2 middle dots in this sentence (limit 3)",
  ],
  [
    "preamble-length",
    "count",
    { limit: 3 },
    "0 paragraphs before the first heading (limit 3)",
    "1 paragraph before the first heading (limit 3)",
    "2 paragraphs before the first heading (limit 3)",
  ],
  [
    "proper-noun-density",
    "density",
    { limit: 40 },
    "0 proper nouns per 1000 words (limit 40)",
    "1 proper noun per 1000 words (limit 40)",
    "2 proper nouns per 1000 words (limit 40)",
  ],
  [
    "repeated-conjunction",
    "count",
    { limit: 2 },
    "0 paragraphs in a row open with a conjunction (limit 2)",
    "1 paragraph in a row opens with a conjunction (limit 2)",
    "2 paragraphs in a row open with a conjunction (limit 2)",
  ],
  [
    "repeated-sentence-head",
    "count",
    { head: "The", limit: 2 },
    '0 sentences in a row open with "The" (limit 2)',
    '1 sentence in a row opens with "The" (limit 2)',
    '2 sentences in a row open with "The" (limit 2)',
  ],
  [
    "rule-of-three",
    "count",
    { total: 5, limit: 50 },
    "0 of 5 lists have exactly three items (50% allowed)",
    "1 of 5 lists has exactly three items (50% allowed)",
    "2 of 5 lists have exactly three items (50% allowed)",
  ],
  [
    "sasete-itadaku",
    "count",
    { matched: "させていただく", limit: 2 },
    '"させていただく" appears 0 times in this document (limit 2)',
    '"させていただく" appears 1 time in this document (limit 2)',
    '"させていただく" appears 2 times in this document (limit 2)',
  ],
  [
    "sentence-initial-conjunction-run",
    "count",
    { limit: 2 },
    "0 sentences in a row open with a conjunction (limit 2)",
    "1 sentence in a row opens with a conjunction (limit 2)",
    "2 sentences in a row open with a conjunction (limit 2)",
  ],
  [
    "taigen-dome-in-prose",
    "count",
    { limit: 3 },
    "0 sentences end on a noun in the body text (limit 3)",
    "1 sentence ends on a noun in the body text (limit 3)",
    "2 sentences end on a noun in the body text (limit 3)",
  ],
  [
    "undefined-acronym",
    "count",
    { word: "KPI" },
    '"KPI" is used without an expansion (0 such acronyms)',
    '"KPI" is used without an expansion (1 such acronym)',
    '"KPI" is used without an expansion (2 such acronyms)',
  ],
  [
    "unqualified-superlative",
    "count",
    { matched: "best" },
    '"best" has nothing to compare against (0 such claims)',
    '"best" has nothing to compare against (1 such claim)',
    '"best" has nothing to compare against (2 such claims)',
  ],
];

describe("English rule messages agree with the count", () => {
  CASES.forEach(([id, key, values, zero, one, two]) => {
    it(`${id} at 0, 1 and 2`, () => {
      assert.equal(english(id, { ...values, [key]: 0 }), zero);
      assert.equal(english(id, { ...values, [key]: 1 }), one);
      assert.equal(english(id, { ...values, [key]: 2 }), two);
    });
  });

  it("1 of 1: the noun follows the total, the verb follows the count", () => {
    assert.equal(english("rule-of-three", { count: 1, total: 1, limit: 50 }), "1 of 1 list has exactly three items (50% allowed)");
    assert.equal(english("concrete-evidence-density", { word: "Scope", count: 1, total: 1 }), 'Section "Scope" has no number, code or link (1 of 1 section)');
  });

  it("every placeholder in every English message is filled", () => {
    RULES.forEach((rule) => {
      const keys = [...(rule.message["en"] ?? "").matchAll(/\{(\w+)/gu)].map((match) => match[1] ?? "");
      const values = Object.fromEntries(keys.map((key) => [key, 1]));
      assert.doesNotMatch(messageOf(rule, findingWith(rule.id, values), "en"), /[{}|]/u, rule.id);
    });
  });

  it("no Japanese message uses the plural form", () => {
    loadRules("ja").forEach((rule) => assert.doesNotMatch(rule.message["ja"] ?? "", /\{\w+\|/u, rule.id));
  });
});

describe("the plural form in a message", () => {
  const withMessage = (en: string, ja: string): RuleDefinition => ({ ...ruleNamed("internal-jargon"), message: { en, ja } });
  const fill = (template: string, values: Readonly<Record<string, string | number>>, language = "en"): string =>
    messageOf(withMessage(template, template), findingWith("internal-jargon", values), language);

  it("picks the singular only for exactly one", () => {
    assert.equal(fill("{n} {n|item|items}", { n: 0 }), "0 items");
    assert.equal(fill("{n} {n|item|items}", { n: 1 }), "1 item");
    assert.equal(fill("{n} {n|item|items}", { n: 2 }), "2 items");
    assert.equal(fill("{n} {n|item|items}", { n: 1.5 }), "1.5 items");
    assert.equal(fill("{n} {n|item|items}", { n: "1" }), "1 item");
    assert.equal(fill("{n} {n|item|items}", { n: -1 }), "-1 items");
  });

  it("leaves a form whose value is missing as written", () => {
    assert.equal(fill("{n|item|items}", {}), "{n|item|items}");
    assert.equal(fill("{n}", {}), "{n}");
  });

  it("allows an empty form and spaces in a form", () => {
    assert.equal(fill("{n|occurs|occur together}", { n: 2 }), "occur together");
    assert.equal(fill("file{n||s}", { n: 1 }), "file");
    assert.equal(fill("file{n||s}", { n: 3 }), "files");
  });

  it("the rule reference reads each form as its plural", () => {
    assert.equal(templateForReading('"{matched}" ({count} such {count|word|words})'), '"{matched}" ({count} such words)');
    assert.equal(templateForReading("file{n||s} {n}"), "files {n}");
    assert.equal(templateForReading("「{matched}」が {count} 箇所"), "「{matched}」が {count} 箇所");
  });

  it("leaves text without a form untouched", () => {
    assert.equal(fill("「{matched}」が {count} 箇所", { matched: "握る", count: 1 }, "ja"), "「握る」が 1 箇所");
    assert.equal(fill("a | b {x}", { x: 1 }), "a | b 1");
  });
});

describe("counted and formFor", () => {
  it("counts in English", () => {
    assert.equal(counted(0, "finding"), "0 findings");
    assert.equal(counted(1, "finding"), "1 finding");
    assert.equal(counted(2, "finding"), "2 findings");
    assert.equal(counted(1, "passage"), "1 passage");
    assert.equal(counted(2, "match", "matches"), "2 matches");
    assert.equal(formFor(1, "was", "were"), "was");
    assert.equal(formFor(0, "was", "were"), "were");
  });
});

describe("the command line's counts agree", () => {
  it("watch: the total after the change sets the noun", () => {
    const unit = CLI_TEXT.en.findingsUnit;
    assert.equal(describeChange({ a: 0 }, { a: 1 }, unit), "✗ 0 → 1 finding   (+1 a)");
    assert.equal(describeChange({ a: 1 }, {}, unit), "✓ 1 → 0 findings   (-1 a)");
    assert.equal(describeChange({ a: 1 }, { a: 2 }, unit), "✗ 1 → 2 findings   (+1 a)");
    assert.equal(describeChange({ a: 0 }, { a: 1 }, CLI_TEXT.ja.findingsUnit), "✗ 0 → 1 件   (+1 a)");
  });

  it("feedback: an excerpt of one line is a line, not lines", () => {
    const draft = (from: number, to: number, ui: "ja" | "en"): string =>
      feedbackDraft(
        {
          kind: "missed",
          version: "0",
          runtime: "node",
          fileName: "a.md",
          language: "en",
          genre: "blog",
          findings: [],
          line: from,
          excerpts: [{ from, to, lines: ["x"] }],
          config: undefined,
        },
        ui,
      ).body;
    assert.match(draft(1, 1, "en"), /\nline 1\n/u);
    assert.match(draft(1, 3, "en"), /\nlines 1-3\n/u);
    assert.match(draft(1, 1, "ja"), /\n1〜1 行目\n/u);
  });

  it("a structure that could not be read: one clause number, one read", () => {
    assert.equal(
      REASONS.en.unreadStructure(8, 1),
      "the text has 8 clause numbers but only 1 was read as a numbered line (deep indents, or lines run into the text)",
    );
    assert.equal(
      REASONS.en.unreadStructure(8, 0),
      "the text has 8 clause numbers but only 0 were read as numbered lines (deep indents, or lines run into the text)",
    );
    assert.equal(
      REASONS.en.unreadStructure(8, 2),
      "the text has 8 clause numbers but only 2 were read as numbered lines (deep indents, or lines run into the text)",
    );
  });
});
