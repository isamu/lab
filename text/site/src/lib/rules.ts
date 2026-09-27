// The rule reference is read with chaff's own loader, once per language, so every level, severity and
// status on the site is the one chaff uses.
import { resolve } from "node:path";
import { loadRules } from "../../../packages/chaff/src/rule-load.ts";
import type { RuleDefinition } from "../../../packages/chaff/src/plugin.ts";
import type { Lang } from "./i18n";

export type Localized = Record<Lang, string>;

export type Rule = {
  readonly id: string;
  readonly layer: RuleDefinition["layer"];
  readonly status: RuleDefinition["status"];
  readonly severity: Localized;
  readonly languages: readonly Lang[];
  readonly name: Localized;
  readonly why: Localized;
  readonly message: Localized;
  readonly howToFix: Localized;
  readonly levels: Record<Lang, readonly (readonly [string, string])[]>;
  readonly useFor: readonly string[];
};

// astro build runs in text/site.
const RULES_DIR = resolve(process.cwd(), "..", "packages", "chaff", "rules");
const LEVEL_NAMES = ["strict", "normal", "relaxed"] satisfies readonly (keyof RuleDefinition["levels"])[];
const SEVERITY_BY_NUMBER: Readonly<Record<number, string>> = { 1: "info", 2: "warning", 3: "error" };

/** L4 keeps its levels as severities, which chaff counts as 1-3; show them as the words the rule file uses. */
const levelText = (definition: RuleDefinition, value: number): string =>
  definition.layer === "L4" ? (SEVERITY_BY_NUMBER[value] ?? String(value)) : String(value);

const levelsOf = (definition: RuleDefinition): readonly (readonly [string, string])[] =>
  LEVEL_NAMES.flatMap((level): (readonly [string, string])[] => {
    const value = definition.levels[level];
    return value === undefined ? [] : [[level, levelText(definition, value)]];
  });

const text = (localized: Readonly<Record<string, string>>, lang: Lang): string => localized[lang] ?? localized["en"] ?? "";

const byLanguage: Record<Lang, readonly RuleDefinition[]> = { ja: loadRules("ja", RULES_DIR), en: loadRules("en", RULES_DIR) };

const ruleOf = (ja: RuleDefinition): Rule => {
  const en = byLanguage.en.find((candidate) => candidate.id === ja.id);
  if (en === undefined) throw new Error(`${ja.id}: chaff loads it for Japanese but not for English`);
  const languages = (ja.languages ?? ["ja", "en"]).filter((lang): lang is Lang => lang === "ja" || lang === "en");
  const localized = (field: "name" | "why" | "message" | "how_to_fix"): Localized => ({
    ja: text(ja[field], "ja"),
    en: text(en[field], "en"),
  });
  return {
    id: ja.id,
    layer: ja.layer,
    status: ja.status,
    severity: { ja: ja.severity, en: en.severity },
    languages,
    name: localized("name"),
    why: localized("why"),
    message: localized("message"),
    howToFix: localized("how_to_fix"),
    levels: { ja: levelsOf(ja), en: levelsOf(en) },
    useFor: ja.use_for,
  };
};

/** Every rule chaff ships, by layer and then by id. */
export const rules: readonly Rule[] = byLanguage.ja.map(ruleOf).sort((a, b) => a.layer.localeCompare(b.layer) || a.id.localeCompare(b.id));
