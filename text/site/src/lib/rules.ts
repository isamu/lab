// The rule reference is read with chaff's own loader, once per language, so every level, severity and
// status on the site is the one chaff uses.
import { resolve } from "node:path";
import { loadRules } from "../../../packages/chaff/src/rule-load.ts";
import { severityAt } from "../../../packages/chaff/src/levels.ts";
import type { RuleDefinition } from "../../../packages/chaff/src/plugin.ts";
import { readableText, templateForReading } from "../../../packages/chaff/src/render/text.ts";
import type { RuleExample, RuleGroup } from "../../../packages/chaff/src/rule-guide.ts";
import { depthMeaning, type RewriteDepth } from "../../../packages/chaff/src/rewrite-depth.ts";
import type { Lang } from "./i18n";

export type Localized = Record<Lang, string>;

export type Rule = {
  readonly id: string;
  readonly layer: RuleDefinition["layer"];
  readonly status: RuleDefinition["status"];
  /** Runs only with a style or a level in chaff.yaml (opt_in). */
  readonly optIn: boolean;
  readonly severity: Localized;
  readonly languages: readonly Lang[];
  readonly name: Localized;
  readonly why: Localized;
  readonly message: Localized;
  /** The messages a rule gives for its other ways of finding (excessive-hedging's hedges stacked in one sentence). */
  readonly otherMessages: readonly Localized[];
  readonly howToFix: Localized;
  readonly levels: Record<Lang, readonly (readonly [string, string])[]>;
  readonly levelSets: RuleDefinition["level_sets"];
  readonly useFor: readonly string[];
  /** What the rule needs from the document before it can run (dates, quantities, pos …). */
  readonly requires: readonly string[];
  /** The plain-language part of the rule file (group, summary, examples), for the reference in the guide. */
  readonly group: RuleGroup | undefined;
  readonly summary: Localized;
  readonly examples: Readonly<Record<string, RuleExample>>;
  readonly notFlagged: Localized;
  /** What a level's number means, with {limit}; empty when every level is the same. */
  readonly levelMeaning: Localized;
  /** The genres that set their own numbers for the levels. */
  readonly ownNumbers: readonly string[];
  /** The bibliography entries the rule rests on, by anchor. */
  readonly sources: readonly string[];
  /** How deep the rule's rewrite direction reaches, with what that means; none for a rule without a rewrite block. */
  readonly rewriteDepth: { readonly depth: string; readonly meaning: Localized } | undefined;
};

// astro build runs in text/site.
const RULES_DIR = resolve(process.cwd(), "..", "packages", "chaff", "rules");
const LEVEL_NAMES = ["strict", "normal", "relaxed"] satisfies readonly (keyof RuleDefinition["levels"])[];
/** A rule with nothing to count keeps severities as its levels; show them as the words the rule file uses. */
const levelText = (definition: RuleDefinition, level: (typeof LEVEL_NAMES)[number], value: number): string =>
  definition.level_sets === "severity" ? severityAt(definition, level) : String(value);

const levelsOf = (definition: RuleDefinition): readonly (readonly [string, string])[] =>
  LEVEL_NAMES.flatMap((level): (readonly [string, string])[] => {
    const value = definition.levels[level];
    return value === undefined ? [] : [[level, levelText(definition, level, value)]];
  });

const text = (localized: Readonly<Record<string, string>>, lang: Lang): string => localized[lang] ?? localized["en"] ?? "";

const readableTemplate = (message: Localized): Localized => ({ ja: templateForReading(message.ja), en: templateForReading(message.en) });

const byLanguage: Record<Lang, readonly RuleDefinition[]> = { ja: loadRules("ja", RULES_DIR), en: loadRules("en", RULES_DIR) };

const rewriteDepthOf = (depth: RewriteDepth | undefined): Rule["rewriteDepth"] =>
  depth === undefined ? undefined : { depth, meaning: { ja: depthMeaning(depth, "ja"), en: depthMeaning(depth, "en") } };

const ruleOf = (ja: RuleDefinition): Rule => {
  const en = byLanguage.en.find((candidate) => candidate.id === ja.id);
  if (en === undefined) throw new Error(`${ja.id}: chaff loads it for Japanese but not for English`);
  const languages = (ja.languages ?? ["ja", "en"]).filter((lang): lang is Lang => lang === "ja" || lang === "en");
  const localized = (field: "message"): Localized => ({
    ja: text(ja[field], "ja"),
    en: text(en[field], "en"),
  });
  // The reader's texts have no finding here, so each placeholder reads as the rule's words for it.
  const readable = (field: "name" | "why" | "how_to_fix"): Localized => ({
    ja: readableText(ja, ja[field], "ja"),
    en: readableText(en, en[field], "en"),
  });
  return {
    id: ja.id,
    layer: ja.layer,
    status: ja.status,
    optIn: ja.opt_in === true,
    severity: { ja: ja.severity, en: en.severity },
    languages,
    name: readable("name"),
    why: readable("why"),
    message: readableTemplate(localized("message")),
    otherMessages: Object.keys(ja.messages).map((variant) =>
      readableTemplate({ ja: text(ja.messages[variant] ?? {}, "ja"), en: text(en.messages[variant] ?? {}, "en") }),
    ),
    howToFix: readable("how_to_fix"),
    levels: { ja: levelsOf(ja), en: levelsOf(en) },
    levelSets: ja.level_sets,
    useFor: ja.use_for,
    requires: ja.requires,
    group: ja.guide?.group,
    summary: { ja: ja.guide?.summary["ja"] ?? "", en: ja.guide?.summary["en"] ?? "" },
    examples: ja.guide?.examples ?? {},
    notFlagged: { ja: ja.guide?.notFlagged["ja"] ?? "", en: ja.guide?.notFlagged["en"] ?? "" },
    levelMeaning: { ja: ja.guide?.levelMeaning["ja"] ?? "", en: ja.guide?.levelMeaning["en"] ?? "" },
    ownNumbers: Object.keys(ja.by_genre),
    sources: ja.guide?.sources ?? [],
    rewriteDepth: rewriteDepthOf(ja.guide?.rewriteDepth),
  };
};

/** Every rule chaff ships, by layer and then by id. */
export const rules: readonly Rule[] = byLanguage.ja.map(ruleOf).sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id));
