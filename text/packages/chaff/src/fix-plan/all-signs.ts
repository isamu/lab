import type { Finding, ProseDocument, RuleDefinition } from "../plugin.ts";
import { presetLevels } from "../genre-load.ts";
import { runRulesWith, type Skipped } from "../run.ts";
import { aiShapeRuleIds, measuredLevelsOf } from "../ai-score/signals.ts";

/** What lint found: the findings and the rules that did not run. */
export type LintResult = { readonly findings: readonly Finding[]; readonly skipped: readonly Skipped[] };

const ofLanguage = (rules: readonly RuleDefinition[], language: string): RuleDefinition[] =>
  rules.filter((rule) => rule.languages === undefined || rule.languages.includes(language));

/** Every AI-likeness rule for the language: group ai-tells, the composite's inputs and the AI markup shapes. */
export const allSignRules = (rules: readonly RuleDefinition[], language: string): RuleDefinition[] => {
  const forLanguage = ofLanguage(rules, language);
  const ids = new Set(aiShapeRuleIds(forLanguage));
  return forLanguage.filter((rule) => ids.has(rule.id));
};

/**
 * Every AI-likeness rule run on the document whatever the genre or chaff.yaml turns off: at the genre's level where it
 * runs, at normal where it does not (the levels ai-score measures at), and in the genre even when use_for leaves it out.
 */
export const runAllSigns = (doc: ProseDocument, rules: readonly RuleDefinition[], genre: string): LintResult => {
  const signRules = allSignRules(rules, doc.language).map((rule) => ({ ...rule, use_for: [genre] }));
  const result = runRulesWith(doc, signRules, { settings: measuredLevelsOf(signRules, presetLevels(genre)), experimental: true, genre });
  return { findings: result.findings, skipped: result.skipped };
};

const byLine = (left: Finding, right: Finding): number => left.line - right.line || left.column - right.column;

/** Lint's findings with the AI-likeness rules' own replaced by the all-signs run's, which sees them in every genre. */
export const withAllSigns = (lint: LintResult, signs: LintResult, signIds: ReadonlySet<string>): LintResult => ({
  findings: [...lint.findings.filter((finding) => !signIds.has(finding.rule)), ...signs.findings].toSorted(byLine),
  skipped: [...lint.skipped.filter((skipped) => !signIds.has(skipped.rule)), ...signs.skipped],
});
