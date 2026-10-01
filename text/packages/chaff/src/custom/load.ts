import type { Config } from "../config/load.ts";
import type { RuleDefinition } from "../plugin.ts";
import { loadRules } from "../rule-load.ts";
import { loadGenres } from "../genre-load.ts";
import { parseCustomRules, type CustomRules } from "./parse.ts";

/** The team's custom_rules as rules, with what could not be read. A team's rule applies to every genre, like the team's words. */
export const customRulesOf = (config: Pick<Config, "customRules">): CustomRules =>
  parseCustomRules(config.customRules, {
    builtIn: new Set(loadRules("en").map((rule) => rule.id)),
    useFor: loadGenres().groups.map((group) => group.id),
  });

/** Every rule a run knows for a language: chaff's own, then the team's. Where the team's cannot be read, settingProblems stops the run. */
export const rulesOf = (language: string, config: Pick<Config, "customRules">): RuleDefinition[] => [...loadRules(language), ...customRulesOf(config).rules];
