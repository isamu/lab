import type { Finding, LengthUnit, Lexicon, RuleDefinition } from "../plugin.ts";
import type { RewritePair } from "../rule-guide.ts";
import type { Skipped } from "../run.ts";
import type { Outline, Shape } from "../outline/shape.ts";
import { localized, messageOf } from "../render/text.ts";
import { splitWords } from "../detectors/word-list.ts";
import { COMPOSITE_RULE, recommendMode, type ModeChoice } from "./mode.ts";
import type { StructureScore } from "../structure-shape/score.ts";
import { structureTargetsOf, type StructureTarget } from "./structure-targets.ts";

/** One flagged spot, where it is and what chaff said about it. */
export type PlanSpot = { readonly line: number; readonly column: number; readonly quote: string; readonly message: string };

/** A phrase's own hint from the lexicon ("時間を溶かす" → "時間がかかった（何に、どれだけ）"). */
export type PhraseHint = { readonly phrase: string; readonly rewrite: string };

/** Everything a rewriter needs for one rule: its direction and the spots it flagged. */
export type RulePlan = {
  readonly rule: string;
  readonly name: string;
  /** The rule's rewrite direction, or its how_to_fix when it has no rewrite block. */
  readonly direction: string;
  readonly keep: readonly string[];
  readonly avoid: readonly string[];
  /** The first of the rule's pairs, to copy the shape from. */
  readonly pair: RewritePair | undefined;
  readonly hints: readonly PhraseHint[];
  readonly spots: readonly PlanSpot[];
};

/** A rule that measures the whole document, with what it said. */
type DocumentSignal = { readonly rule: string; readonly message: string };

export type FixPlan = {
  readonly path: string;
  /** Where the plan suggests saving the rewrite, so the check commands can be pasted as they are. */
  readonly rewrittenPath: string;
  readonly language: string;
  readonly genre: string;
  readonly experimental: boolean;
  readonly mode: ModeChoice;
  readonly signals: readonly DocumentSignal[];
  readonly outline: { readonly unit: LengthUnit; readonly shape: Shape };
  /** The structure score, the count at which the plan rewrites from the outline, and how many measures were compared. */
  readonly structure: { readonly score: number; readonly limit: number; readonly compared: number };
  /** The structure measures past 90% of human articles, each with the human numbers to bring it back to. */
  readonly targets: readonly StructureTarget[];
  readonly rules: readonly RulePlan[];
  /** The rewrite and signal rules that did not run, and why: silence from them is not "checked and fine". */
  readonly notRun: readonly Skipped[];
  readonly checks: readonly string[];
};

export type PlanInput = {
  readonly path: string;
  readonly language: string;
  readonly genre: string;
  readonly experimental: boolean;
  /** --genre as given on the command line, repeated in the check commands. */
  readonly genreFlag: string | undefined;
  readonly findings: readonly Finding[];
  readonly rules: readonly RuleDefinition[];
  readonly skipped: readonly Skipped[];
  readonly outline: Outline;
  /** The document's structure measures against human articles (chaff outline's structure block). */
  readonly structure: StructureScore;
  /** The ai-tell lexicon of the document's language, whose entries may carry their own hint. */
  readonly phrases: Lexicon;
};

const BOLD_DENSITY_RULE = "bold-density";
const STRUCTURE_RULE = "ai-structure";
/** ai-structure's count at its normal level, when its rule file does not say. */
const DEFAULT_STRUCTURE_LIMIT = 3;
const AI_TELL_RULE = "ai-tell";

/** ai-generated-composite's inputs and bold-density: the rules the guide reads as document-level signals. */
const signalRulesOf = (rules: readonly RuleDefinition[]): ReadonlySet<string> =>
  new Set([...(rules.find((rule) => rule.id === COMPOSITE_RULE)?.from ?? []), BOLD_DENSITY_RULE]);

/** article.md → article.rewritten.md, beside the original. */
export const rewrittenPathOf = (path: string): string => {
  const dot = path.lastIndexOf(".");
  const slash = path.lastIndexOf("/");
  return dot > slash + 1 ? `${path.slice(0, dot)}.rewritten${path.slice(dot)}` : `${path}.rewritten`;
};

const SHELL_SAFE = /^[\w./-]+$/u;

/** A single quote inside single quotes: close, an escaped quote, reopen. */
const QUOTE_IN_QUOTES = "'\\''";

/** A path as a shell reads it: quoted unless every character is plain. */
export const shellPath = (path: string): string => (SHELL_SAFE.test(path) ? path : `'${path.replaceAll("'", QUOTE_IN_QUOTES)}'`);

/** The ai-tell phrases the finding names that carry a hint of their own. */
export const phraseHintsOf = (finding: Finding, phrases: Lexicon, language: string): PhraseHint[] => {
  const named = new Set(splitWords(String(finding.values["word"] ?? ""), language));
  return phrases.flatMap((entry) =>
    entry.rewrite !== undefined && named.has(entry.pattern.toLowerCase()) ? [{ phrase: entry.pattern, rewrite: entry.rewrite }] : [],
  );
};

const spotOf = (finding: Finding, rule: RuleDefinition, language: string): PlanSpot => ({
  line: finding.line,
  column: finding.column,
  quote: finding.quote,
  message: messageOf(rule, finding, language),
});

const rulePlanOf = (rule: RuleDefinition, findings: readonly Finding[], input: PlanInput): RulePlan => {
  const rewrite = rule.guide?.rewrite[input.language];
  const hints = rule.id === AI_TELL_RULE ? findings.flatMap((finding) => phraseHintsOf(finding, input.phrases, input.language)) : [];
  return {
    rule: rule.id,
    name: localized(rule.name, input.language),
    direction: rewrite?.direction ?? localized(rule.how_to_fix, input.language),
    keep: rewrite?.keep ?? [],
    avoid: rewrite?.avoid ?? [],
    pair: rewrite?.pairs[0],
    hints,
    spots: findings.map((finding) => spotOf(finding, rule, input.language)),
  };
};

/** The rules in the order their first finding appears; the composite has no spot of its own and is a signal only. */
const rulePlansOf = (input: PlanInput): RulePlan[] => {
  const order = [...new Set(input.findings.map((finding) => finding.rule))].filter((id) => id !== COMPOSITE_RULE);
  return order.flatMap((id) => {
    const rule = input.rules.find((entry) => entry.id === id);
    return rule === undefined
      ? []
      : [
          rulePlanOf(
            rule,
            input.findings.filter((finding) => finding.rule === id),
            input,
          ),
        ];
  });
};

/** The composite first, then each signal rule once, with what its first finding said. */
const signalsOf = (input: PlanInput, signalRules: ReadonlySet<string>): DocumentSignal[] =>
  [COMPOSITE_RULE, ...signalRules].flatMap((id) => {
    const finding = input.findings.find((entry) => entry.rule === id);
    const rule = input.rules.find((entry) => entry.id === id);
    return finding === undefined || rule === undefined ? [] : [{ rule: id, message: messageOf(rule, finding, input.language) }];
  });

const hasRewrite = (rule: RuleDefinition): boolean => Object.keys(rule.guide?.rewrite ?? {}).length > 0;

/** A rule written for other languages is not one that failed to run on this document. */
const checksLanguage = (rule: RuleDefinition, language: string): boolean => rule.languages === undefined || rule.languages.includes(language);

const notRunOf = (input: PlanInput, signalRules: ReadonlySet<string>): Skipped[] => {
  const forThisLanguage = input.rules.filter((rule) => checksLanguage(rule, input.language));
  const watched = new Set(forThisLanguage.filter((rule) => hasRewrite(rule) || rule.id === COMPOSITE_RULE || signalRules.has(rule.id)).map((rule) => rule.id));
  return input.skipped.filter((skipped) => watched.has(skipped.rule));
};

/** The commands to run on the rewrite. A full rewrite cuts repeats and rebuilds headings, which compare is told. */
const checksOf = (input: PlanInput, choice: ModeChoice): string[] => {
  const original = shellPath(input.path);
  const rewritten = shellPath(rewrittenPathOf(input.path));
  const lintFlags = [...(input.experimental ? ["--experimental"] : []), ...(input.genreFlag === undefined ? [] : ["--genre", input.genreFlag])];
  const compareFlags = choice.mode === "full" ? ["--distinct", "--allow-dropped heading", "--allow-added heading"] : [];
  return [
    ["npx chaffjs", rewritten, ...lintFlags].join(" "),
    ["npx chaffjs compare", original, rewritten, ...compareFlags].join(" "),
    ["npx chaffjs outline", original, rewritten].join(" "),
  ];
};

/** The count ai-structure fires at by default: the same line decides when the plan rewrites from the outline. */
const structureLimitOf = (rules: readonly RuleDefinition[]): number =>
  rules.find((rule) => rule.id === STRUCTURE_RULE)?.levels.normal ?? DEFAULT_STRUCTURE_LIMIT;

const documentLength = (outline: Outline): number => outline.entries.reduce((sum, entry) => sum + entry.length, 0);

/** The plan for one document: deterministic, from chaff's findings, the rule files and the human baseline alone. */
export const buildFixPlan = (input: PlanInput): FixPlan => {
  const signalRules = signalRulesOf(input.rules);
  const structure = { score: input.structure.score, limit: structureLimitOf(input.rules), compared: input.structure.compared };
  const firedRules = new Set(input.findings.map((finding) => finding.rule));
  const mode = recommendMode({ genre: input.genre, firedRules, signalRules, structure });
  return {
    path: input.path,
    rewrittenPath: rewrittenPathOf(input.path),
    language: input.language,
    genre: input.genre,
    experimental: input.experimental,
    mode,
    signals: signalsOf(input, signalRules),
    outline: { unit: input.outline.unit, shape: input.outline.shape },
    structure,
    targets: structureTargetsOf(input.structure, documentLength(input.outline)),
    rules: rulePlansOf(input),
    notRun: notRunOf(input, signalRules),
    checks: checksOf(input, mode),
  };
};
