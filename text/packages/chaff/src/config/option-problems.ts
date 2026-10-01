import { CONFIG_FILE, type Config } from "./load.ts";
import type { RuleDefinition, RuleOption } from "../plugin.ts";
import { optionProblems, type OptionLayer, type OptionProblem } from "../rule-options.ts";
import { limitsFor, styleLevelSource, styleSource } from "./style.ts";
import type { Texts, UiLanguage } from "../ui.ts";

/** Where chaff.yaml's options come from, for settleOptions: the file itself. */
export const configOptionLayer = (config: Pick<Config, "options">): OptionLayer => ({
  from: CONFIG_FILE,
  values: config.options ?? {},
});

/** Where a rule's settings come from, for explain: the option layers, the style when it set the level, and a number set for it. */
export const settingSourcesOf = (
  config: Pick<Config, "options" | "applied" | "limits">,
  ruleId: string,
  language: string,
): { optionLayers: OptionLayer[]; levelFrom: string | undefined; limit: number | undefined } => ({
  optionLayers: optionLayersOf(config),
  levelFrom: styleLevelSource(config, ruleId),
  limit: limitsFor(config, language)[ruleId],
});

/** Every place options come from, strongest first: chaff.yaml, then its style. */
export const optionLayersOf = (config: Pick<Config, "options" | "applied">): OptionLayer[] => [
  configOptionLayer(config),
  ...(config.applied === undefined ? [] : [{ from: styleSource(config.applied.style), values: config.applied.options }]),
];

type ProblemText = {
  readonly notAMap: (where: string, value: string) => string;
  readonly problem: (where: string, problem: OptionProblem) => string;
};

const TEXT: Texts<ProblemText> = {
  ja: {
    notAMap: (where, value) => `${where}: options の ${value} は読めません。ルールの名前の下に、オプションの名前と値を並べてください`,
    problem: (where, problem) => {
      if (problem.kind === "unknown-rule") return `${where}: options の ${problem.rule} というルールはありません（npx chaff rules --json で一覧が出ます）`;
      if (problem.kind === "no-options") return `${where}: ${problem.rule} にはオプションがありません。options に書いても何も変わりません`;
      if (problem.kind === "not-a-map") return `${where}: options の ${problem.rule} の下には、オプションの名前と値を並べてください`;
      if (problem.kind === "unknown-option")
        return `${where}: ${problem.rule} に ${problem.option} というオプションはありません（使えるのは ${problem.known.join(" / ")}）`;
      return `${where}: ${problem.rule} の ${problem.option} の値 ${problem.value} は読めません（${problem.expected}）。既定のまま動きます`;
    },
  },
  en: {
    notAMap: (where, value) => `${where}: cannot read ${value} under options. Under each rule's name, list option names and values`,
    problem: (where, problem) => {
      if (problem.kind === "unknown-rule") return `${where}: there is no rule named ${problem.rule} under options (npx chaff rules --json lists them)`;
      if (problem.kind === "no-options") return `${where}: ${problem.rule} takes no options, so writing some changes nothing`;
      if (problem.kind === "not-a-map") return `${where}: under options, ${problem.rule} needs option names and values`;
      if (problem.kind === "unknown-option") return `${where}: ${problem.rule} has no option ${problem.option} (it takes ${problem.known.join(" / ")})`;
      return `${where}: cannot read ${problem.value} as ${problem.rule}'s ${problem.option} (${problem.expected}); it stays at its default`;
    },
  },
};

const optionsByRule = (rules: readonly RuleDefinition[]): Record<string, Readonly<Record<string, RuleOption>>> =>
  Object.fromEntries(rules.map((rule) => [rule.id, rule.options ?? {}]));

/** chaff.yaml's options that change nothing. Said on every run, like an unknown rule under rules: silence would look like it applied. */
export const configOptionProblems = (
  config: Pick<Config, "options" | "unreadableOptions" | "path">,
  rules: readonly RuleDefinition[],
  ui: UiLanguage,
): string[] => {
  const text = TEXT[ui];
  const where = config.path ?? "chaff.yaml";
  if (config.unreadableOptions !== undefined) return [text.notAMap(where, config.unreadableOptions)];
  return optionProblems(configOptionLayer(config), optionsByRule(rules)).map((problem) => text.problem(where, problem));
};
