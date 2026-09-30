import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runCli } from "./cli-run.ts";
import { allRulesRun } from "../scripts/corpus-findings.ts";
import { MUTATIONS } from "../scripts/bench-mutations.ts";
import { contextOf, runsOn, samplesOf, teamOf, type Sample } from "../scripts/bench-samples.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { renderFriendly } from "../packages/chaff/src/render/friendly.ts";
import { renderCompact } from "../packages/chaff/src/render/compact.ts";
import { renderSarif } from "../packages/chaff/src/render/sarif.ts";
import { renderExplain } from "../packages/chaff/src/render/explain.ts";
import { renderSemantic } from "../packages/chaff/src/render/semantic.ts";
import { rulesJson } from "../packages/chaff/src/render/rules-json.ts";
import { readableText } from "../packages/chaff/src/render/text.ts";
import { EMPTY } from "../packages/chaff/src/config/load.ts";
import { applyLevel } from "../packages/chaff/src/config/write.ts";
import type { Finding, Localized, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import type { RunResult } from "../packages/chaff/src/run.ts";

// Every text a rule shows the reader has its placeholders filled: from the finding's values where there is a finding,
// from the rule's own reading of each placeholder where there is none (explain, rules --json, the rule reference).

const LANGUAGES = ["ja", "en"] as const;
const PLACEHOLDER = /\{\w+(?:\|[^|{}]*\|[^|{}]*)?\}/gu;

/** The placeholders a rule's texts use in one language, as written ("{preferred}", "{count|word|words}"). */
const placeholdersOf = (rule: RuleDefinition, language: string): string[] => {
  const fields: Localized[] = [rule.name, rule.why, rule.how_to_fix, rule.message, ...Object.values(rule.messages)];
  return [...new Set(fields.flatMap((field) => (field[language] ?? "").match(PLACEHOLDER) ?? []))];
};

const leftIn = (text: string, rule: RuleDefinition, language: string): string[] => placeholdersOf(rule, language).filter((token) => text.includes(token));

/** Only the reader's texts: name, why and how_to_fix, which have no finding outside `chaff lint`. */
const readerPlaceholdersOf = (rule: RuleDefinition, language: string): string[] =>
  [rule.name, rule.why, rule.how_to_fix].flatMap((field) => (field[language] ?? "").match(PLACEHOLDER) ?? []);

const PREFER = "prefer:\n  サーバ: サーバー\n  e-mail: email\n";

describe("how_to_fix is filled from the finding (#345)", () => {
  it("preferred-term in Japanese names the spelling to use", async () => {
    const run = await runCli({ "chaff.yaml": `rules:\n  preferred-term: normal\n${PREFER}`, "t.md": "# 手引き\n\n社内のサーバに接続する。\n" }, [
      "lint",
      "t.md",
    ]);
    assert.match(run.out, /→ 「サーバー」に直してください。/u);
    assert.doesNotMatch(run.out, /\{preferred\}/u);
  });

  it("preferred-term in English names the spelling to use", async () => {
    const run = await runCli(
      { "chaff.yaml": `rules:\n  preferred-term: normal\n${PREFER}`, "t.md": "# Guide\n\nSend an e-mail to the team before you start.\n" },
      ["lint", "t.md"],
      "en_US.UTF-8",
    );
    assert.match(run.out, /→ Change it to "email"\./u);
    assert.doesNotMatch(run.out, /\{preferred\}/u);
  });
});

type Rendered = { readonly where: string; readonly rule: RuleDefinition; readonly language: string; readonly text: string };

/** One finding per rule at a time, drawn through every renderer that shows it. */
const renderedFor = (result: RunResult, rules: readonly RuleDefinition[], language: string, where: string): Rendered[] =>
  result.findings.flatMap((finding) => {
    const rule = rules.find((entry) => entry.id === finding.rule);
    if (rule === undefined) return [];
    const one: RunResult = { ...result, findings: [finding] };
    const sarif = renderSarif([{ path: "a.md", finding, language, rules }], "0.0.0");
    return [
      { where: `${where} friendly`, rule, language, text: renderFriendly("", one, rules, language) },
      { where: `${where} compact`, rule, language, text: renderCompact("", one, rules, language) },
      { where: `${where} sarif`, rule, language, text: sarif },
    ];
  });

/** Each seeded mistake of `yarn bench`, planted in the first sample of each language it can go in. */
type BenchRun = { readonly rendered: readonly Rendered[]; readonly missed: readonly string[] };

const benchRenderings = async (): Promise<BenchRun> => {
  const samples = LANGUAGES.flatMap((language) => samplesOf(language));
  const planted = MUTATIONS.flatMap((mutation) =>
    LANGUAGES.filter((language) => mutation.languages.includes(language)).flatMap((language) => {
      const plantIn = (sample: Sample): string | undefined =>
        sample.language === language && runsOn(sample, mutation.rule) ? mutation.plant(sample.source, contextOf(sample))?.source : undefined;
      const sample = samples.find((candidate) => plantIn(candidate) !== undefined);
      const source = sample === undefined ? undefined : plantIn(sample);
      return sample === undefined || source === undefined ? [] : [{ mutation, sample, source }];
    }),
  );
  const runs = await Promise.all(
    planted.map(async ({ mutation, sample, source }) => {
      const { result, rules } = await allRulesRun(sample.path, source, sample.language, sample.genre, teamOf(sample));
      const where = `${sample.name} ${mutation.id}`;
      const found = result.findings.some((finding) => finding.rule === mutation.rule);
      return { rendered: renderedFor(result, rules, sample.language, where), missed: found ? [] : [where] };
    }),
  );
  return { rendered: runs.flatMap((run) => run.rendered), missed: runs.flatMap((run) => run.missed) };
};

describe("no rendered finding keeps a placeholder (the bench's seeded mistakes)", async () => {
  const { rendered, missed } = await benchRenderings();
  const covered = new Set(rendered.map((entry) => entry.rule.id));

  it("covers every rule the bench plants a mistake for, and the rules whose how_to_fix has a placeholder", () => {
    assert.deepEqual(missed, [], "each planted mistake is found by its own rule in its own run");
    MUTATIONS.forEach((mutation) => assert.ok(covered.has(mutation.rule), `${mutation.rule} had no finding`));
    assert.ok(covered.has("preferred-term"));
    assert.ok(covered.has("duplicate-definition"));
  });

  it("friendly, compact and SARIF fill every placeholder of the rule", () => {
    const unfilled = rendered.flatMap((entry) => leftIn(entry.text, entry.rule, entry.language).map((token) => `${entry.where}: ${token}`));
    assert.deepEqual(unfilled, []);
  });
});

/** "<rule> <placeholder>" for each of the rule's reader placeholders (in the given languages) that the text still shows. */
const shownIn = (text: string, rule: RuleDefinition, languages: readonly string[]): string[] =>
  languages.flatMap((language) => readerPlaceholdersOf(rule, language).filter((token) => text.includes(token))).map((token) => `${rule.id} ${token}`);

const hasReading = (rule: RuleDefinition, token: string, language: string): boolean =>
  token.includes("|") || rule.placeholders?.[token.slice(1, -1)]?.[language] !== undefined;

const unreadable = (rules: readonly RuleDefinition[], language: string): string[] =>
  rules.flatMap((rule) =>
    readerPlaceholdersOf(rule, language)
      .filter((token) => !hasReading(rule, token, language))
      .map((token) => `${rule.id} ${token}`),
  );

const sarifRuleOf = (rule: RuleDefinition, rules: readonly RuleDefinition[], language: string): string => {
  const finding: Finding = { rule: rule.id, severity: "warning", line: 1, column: 1, quote: "", values: {} };
  return renderSarif([{ path: "a.md", finding, language, rules }], "0.0.0").split('"results"')[0] ?? "";
};

describe("where no finding exists, a placeholder reads as the rule's words for it", () => {
  LANGUAGES.forEach((language) => {
    const rules = loadRules(language);

    it(`every placeholder in name, why and how_to_fix has a reading (${language})`, () => {
      assert.deepEqual(unreadable(rules, language), []);
    });

    // chaff eval and chaff test's plan print the name as written.
    it(`no name uses a placeholder (${language})`, () => {
      assert.deepEqual(
        rules.filter((rule) => (rule.name[language] ?? "").match(PLACEHOLDER) !== null).map((rule) => rule.id),
        [],
      );
    });

    it(`explain shows no placeholder (${language})`, () => {
      assert.deepEqual(
        rules.flatMap((rule) => shownIn(renderExplain(rule, "normal", language, "char"), rule, [language])),
        [],
      );
    });

    it(`rules --json shows no placeholder in any language (${language})`, () => {
      const json = rulesJson(rules, EMPTY, language, "business");
      assert.deepEqual(
        rules.flatMap((rule) => shownIn(json, rule, LANGUAGES)),
        [],
      );
    });

    it(`the SARIF rule's help shows no placeholder (${language})`, () => {
      assert.deepEqual(
        rules.flatMap((rule) => shownIn(sarifRuleOf(rule, rules, language), rule, [language])),
        [],
      );
    });
  });

  it("reads preferred-term and duplicate-definition in words", () => {
    const ja = loadRules("ja");
    const en = loadRules("en");
    const rule = (rules: readonly RuleDefinition[], id: string): RuleDefinition => rules.find((entry) => entry.id === id) ?? assert.fail(id);
    assert.match(readableText(rule(ja, "preferred-term"), rule(ja, "preferred-term").how_to_fix, "ja"), /^「prefer に並べた使う書き方」に直してください。/u);
    assert.match(readableText(rule(en, "preferred-term"), rule(en, "preferred-term").how_to_fix, "en"), /^Change it to "the spelling listed under prefer"\./u);
    assert.match(readableText(rule(ja, "duplicate-definition"), rule(ja, "duplicate-definition").how_to_fix, "ja"), /「第2条に定める〇〇」/u);
  });

  it("keeps a placeholder the rule gives no reading for, and reads a plural form as its plural", () => {
    const rule = { placeholders: { term: { ja: "〇〇", en: "the term" } } };
    assert.equal(readableText(rule, { en: "{term} {other} {n|item|items}" }, "en"), "the term {other} items");
    assert.equal(readableText({}, { en: "{term}" }, "en"), "{term}");
    assert.equal(readableText({ placeholders: { term: {} } }, { en: "{term}" }, "en"), "{term}");
  });

  it("reads each language in its own words, and falls back to English as the text does", () => {
    const rule = { placeholders: { term: { ja: "〇〇", en: "the term" }, only: { en: "the value" } } };
    assert.equal(readableText(rule, { ja: "「{term}」", en: "{term}" }, "ja"), "「〇〇」");
    assert.equal(readableText(rule, { en: "Fix {only}" }, "ja"), "Fix the value");
  });
});

describe("chaff test fills a built-in rule's name and how_to_fix from the AI's finding", () => {
  it("a {reason} in how_to_fix is the reason the finding gave", () => {
    const base = loadRules("en").find((rule) => rule.layer === "L4") ?? assert.fail("no L4 rule");
    const rule: RuleDefinition = {
      ...base,
      name: { en: "Checked {confidence}", ja: "{confidence}" },
      how_to_fix: { en: "Say why: {reason}", ja: "理由: {reason}" },
    };
    const finding: Finding = { rule: rule.id, severity: "warning", line: 1, column: 1, quote: "q", values: { reason: "no source", confidence: "0.90" } };
    const lines = renderSemantic({ findings: [finding], skipped: [], asked: 1, sentencesSeen: 1, narrowed: [] }, [rule], [], "en").join("\n");
    assert.match(lines, /→ Say why: no source/u);
    assert.match(lines, /Checked 0\.90/u);
  });
});

/** A rule that uses a placeholder in every text the reader sees, so each renderer's handling of each field is checked. */
const everywhere = (): RuleDefinition => {
  const base = loadRules("en").find((rule) => rule.id === "preferred-term") ?? assert.fail("no preferred-term");
  const both = (text: string): Localized => ({ en: text, ja: text });
  return {
    ...base,
    name: both("Name {preferred}"),
    why: both("Why {preferred}"),
    how_to_fix: both("Fix {preferred}"),
    placeholders: { preferred: both("READING") },
  };
};

describe("every field the reader sees, not only how_to_fix", () => {
  const rule = everywhere();
  const finding: Finding = { rule: rule.id, severity: "warning", line: 1, column: 1, quote: "q", values: { preferred: "VALUE", matched: "m" } };

  it("friendly fills name, why and how_to_fix from the finding", () => {
    const text = renderFriendly("", { findings: [finding], skipped: [], forcedExperimental: [], presetExperimental: [] }, [rule], "en");
    ["Name VALUE", "Why VALUE", "→ Fix VALUE"].forEach((expected) => assert.ok(text.includes(expected), expected));
  });

  it("explain reads name, why and how_to_fix in the rule's words", () => {
    const text = renderExplain(rule, "normal", "en", "word");
    ["Name READING", "Why READING", "Fix READING"].forEach((expected) => assert.ok(text.includes(expected), expected));
  });

  it("the SARIF rule reads name, why and how_to_fix in the rule's words", () => {
    const text = sarifRuleOf(rule, [rule], "en");
    ['"text": "Name READING"', '"text": "Why READING"', '"text": "Fix READING"'].forEach((expected) => assert.ok(text.includes(expected), expected));
  });

  it("rules --json reads name, why and how_to_fix in the rule's words, in every language", () => {
    const text = rulesJson([rule], EMPTY, "en", "business");
    ['"en": "Name READING"', '"ja": "Why READING"', '"en": "Fix READING"'].forEach((expected) => assert.ok(text.includes(expected), expected));
  });

  it("chaff relax's comment in chaff.yaml reads name and why in the rule's words", () => {
    const dir = mkdtempSync(join(tmpdir(), "chaff-fill-"));
    const path = join(dir, "chaff.yaml");
    applyLevel(path, rule, "relaxed", undefined, "en", "me");
    const text = readFileSync(path, "utf8");
    ["Name READING", "Why READING"].forEach((expected) => assert.ok(text.includes(expected), expected));
  });
});
