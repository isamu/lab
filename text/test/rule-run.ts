import { buildDocument } from "../packages/chaff/src/document.ts";
import { loadRules } from "../packages/chaff/src/rule-load.ts";
import { runRules, type Settings } from "../packages/chaff/src/run.ts";
import type { LanguageAdapter, RuleDefinition } from "../packages/chaff/src/plugin.ts";
import { messageOf } from "../packages/chaff/src/render/text.ts";

// What one rule reports when the whole pipeline runs, for the tests that check a detector's edge through the rule.

const loaded = new Map<string, readonly RuleDefinition[]>();

/** The rule files are read once per language; runRules only reads them. */
const rulesOf = (language: string): readonly RuleDefinition[] => {
  const cached = loaded.get(language);
  if (cached !== undefined) return cached;
  const rules = loadRules(language);
  loaded.set(language, rules);
  return rules;
};

/** The ids of every finding in a source, experimental rules on and every level at its default. */
export const firedRules = (adapter: LanguageAdapter, source: string, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, adapter), rulesOf(adapter.id), {}, true, genre).findings.map((finding) => finding.rule);

/** The words undefined-acronym reports in a Markdown source, with the rule at strict and experimental rules on. */
export const reportedAcronyms = (adapter: LanguageAdapter, source: string, genre = "business/report"): string[] =>
  runRules(buildDocument("t.md", source, adapter), rulesOf(adapter.id), { "undefined-acronym": "strict" }, true, genre)
    .findings.filter((finding) => finding.rule === "undefined-acronym")
    .map((finding) => String(finding.values["word"]));

const SPACING = "latin-spacing";

/** latin-spacing's findings as kind:style, with experimental rules off. */
export const latinSpacing = (adapter: LanguageAdapter, source: string, genre: string, level: Settings[string] = "normal"): string[] =>
  runRules(buildDocument("a.md", source, adapter), rulesOf(adapter.id), { [SPACING]: level }, false, genre)
    .findings.filter((finding) => finding.rule === SPACING)
    .map((finding) => `${String(finding.values["kind"])}:${String(finding.values["style"])}`);

const SUPERLATIVE = "unqualified-superlative";

/** Whether unqualified-superlative reports a sentence, at strict and with a limit of one. */
export const superlativeReported = (adapter: LanguageAdapter, sentence: string): boolean =>
  runRules(buildDocument("t.md", `# T\n\n${sentence}\n`, adapter), rulesOf(adapter.id), { [SUPERLATIVE]: "strict" }, true, "business/report", {
    [SUPERLATIVE]: 1,
  }).findings.some((finding) => finding.rule === SUPERLATIVE);

/** 一つの rule だけを名指しで動かした、指摘の message と止まった理由。experimental は切ったまま。 */
export type NamedRun = { readonly findings: readonly string[]; readonly skipped: readonly string[] };

export const namedRuleRun = (
  rule: string,
  source: string,
  adapter: LanguageAdapter,
  path = "a.md",
  genre = "business/report",
  level: Settings[string] = "normal",
): NamedRun => {
  const rules = rulesOf(adapter.id);
  const result = runRules(buildDocument(path, source, adapter), rules, { [rule]: level }, false, genre);
  const definition = rules.find((entry) => entry.id === rule);
  if (definition === undefined) throw new Error(`no rule ${rule}`);
  return {
    findings: result.findings.filter((finding) => finding.rule === rule).map((finding) => messageOf(definition, finding, adapter.id)),
    skipped: result.skipped.filter((entry) => entry.rule === rule).map((entry) => entry.why),
  };
};
