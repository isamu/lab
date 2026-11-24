import type { Config } from "./load.ts";
import type { PathRule } from "./by-path.ts";
import { byPathSource } from "./by-path-rules.ts";
import { ruleProblems } from "./rule-problems.ts";
import { configOptionProblems } from "./option-problems.ts";
import type { RuleDefinition } from "../plugin.ts";
import type { Texts, UiLanguage } from "../ui.ts";

const TEXT: Texts<{ readonly unreadable: (where: string, value: string) => string; readonly rulesNotAMap: (where: string, value: string) => string }> = {
  ja: {
    unreadable: (where, value) =>
      `${where}: by_path の ${value} は読めないので使いません。by_path は files と、genre・language・profile・rules・options の組を並べます（- files: ["guides/**/*.md"] と genre: docs/manual）`,
    rulesNotAMap: (where, value) =>
      `${where}: rules の ${value} は読めません。ルールの名前と段階（strict / normal / relaxed / off か、正の数）を並べてください`,
  },
  en: {
    unreadable: (where, value) =>
      `${where}: cannot read ${value} under by_path, so it is not used. by_path is a list of files with genre, language, profile, rules or options (- files: ["guides/**/*.md"] with genre: docs/manual)`,
    rulesNotAMap: (where, value) =>
      `${where}: cannot read ${value} under rules. List rule names with a level (strict / normal / relaxed / off, or a positive number)`,
  },
};

/** chaff.yaml の by_path のうち、読めなかったもの。 */
export const byPathProblems = (config: Pick<Config, "unreadableByPath" | "path">, ui: UiLanguage = "ja"): string[] =>
  (config.unreadableByPath ?? []).map((value) => TEXT[ui].unreadable(config.path ?? "chaff.yaml", value));

/** One entry's rules: and options: that change nothing, said as the top-level ones are, with the entry named. */
const entryProblems = (entry: PathRule, file: string, rules: readonly RuleDefinition[], ui: UiLanguage): string[] => {
  const where = `${file} (${byPathSource(entry)})`;
  const blocks = entry.unreadableBlocks ?? [];
  const rulesBlock = blocks.find((block) => block.key === "rules");
  const optionsBlock = blocks.find((block) => block.key === "options");
  return [
    ...(rulesBlock === undefined ? [] : [TEXT[ui].rulesNotAMap(where, rulesBlock.value)]),
    ...ruleProblems({ rules: entry.rules ?? {}, limits: entry.limits ?? {}, unreadableRules: entry.unreadableRules ?? [], path: where }, rules, ui),
    ...configOptionProblems({ options: entry.options ?? {}, unreadableOptions: optionsBlock?.value, path: where }, rules, ui),
  ];
};

/** The by_path entries' rules: and options: that have no effect: an unknown rule, a value that is not a level, an option that does not apply. */
export const byPathRuleProblems = (config: Pick<Config, "byPath" | "path">, rules: readonly RuleDefinition[], ui: UiLanguage = "ja"): string[] =>
  config.byPath.flatMap((entry) => entryProblems(entry, config.path ?? "chaff.yaml", rules, ui));
