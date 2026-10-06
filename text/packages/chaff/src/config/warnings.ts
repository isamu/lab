import type { Config } from "./load.ts";
import type { RuleDefinition } from "../plugin.ts";
import type { UiLanguage } from "../ui.ts";
import { ruleProblems } from "./rule-problems.ts";
import { nameProblems } from "./name-problems.ts";
import { byPathProblems } from "./by-path-problems.ts";
import { configOptionProblems } from "./option-problems.ts";
import { configGuideProblems } from "../genre-guide/of-config.ts";

/** Everything in chaff.yaml that has no effect: unknown rules or levels, unreadable names or by_path entries, options that do not apply, guides that cannot be read. Said before the results. */
export const settingWarnings = (config: Config, rules: readonly RuleDefinition[], ui: UiLanguage): string[] => [
  ...ruleProblems(config, rules, ui),
  ...nameProblems(config, ui),
  ...byPathProblems(config, ui),
  ...configOptionProblems(config, rules, ui),
  ...configGuideProblems(config, ui),
];
