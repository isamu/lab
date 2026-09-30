import { definedLevels, resolve, severityAt } from "../levels.ts";
import type { Config } from "../config/load.ts";
import type { Level, Localized, RuleDefinition } from "../plugin.ts";
import { readableText } from "./text.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import { presetLevels } from "../genre-load.ts";
import type { PresetLevels } from "../genre-parse.ts";
import { optionsJson } from "./options.ts";
import { styleLevelSource } from "../config/style.ts";
import { loadStyles } from "../style-load.ts";
import type { OptionLayer } from "../rule-options.ts";

const TEXT: Texts<{
  readonly offBySetting: string;
  readonly offByGenre: (genre: string) => string;
  readonly offExperimental: string;
  readonly valuesNote: string;
  readonly reason: string;
  readonly byFile: string;
  readonly optionsByFile: string;
}> = {
  ja: {
    offBySetting: "設定で止めている",
    offByGenre: (genre) => `ジャンル ${genre} では見ない`,
    offExperimental: "experimental な rule は既定で動かさない",
    valuesNote: "この 4 語のかわりに数字を直接書いてもよい。4 語のほうを勧める。",
    reason: "<理由>",
    byFile: "chaff.yaml の rules に <rule-id>: <level> を足す。既定のままのものは書かない。",
    optionsByFile: "options を持つ rule は、chaff.yaml の options に <rule-id>: { <option>: <value> } を足す。",
  },
  en: {
    offBySetting: "turned off in the settings",
    offByGenre: (genre) => `the ${genre} genre does not check it`,
    offExperimental: "experimental rules do not run by default",
    valuesNote: "A number may be written instead of these four words. The words are recommended.",
    reason: "<reason>",
    byFile: "Add <rule-id>: <level> under rules in chaff.yaml. Leave out anything at its default.",
    optionsByFile: "For a rule with options, add <rule-id>: { <option>: <value> } under options in chaff.yaml.",
  },
};

const now = (rule: RuleDefinition, config: Config, genre: string, text: (typeof TEXT)["ja"], preset: PresetLevels): Record<string, unknown> => {
  const explicit = config.rules[rule.id] ?? preset[rule.id];
  if (explicit === "off" && config.rules[rule.id] === undefined) return { level: "off", why_off: text.offByGenre(genre) };
  if (explicit === "off") return { level: "off", why_off: text.offBySetting };
  const limit = rule.level_sets === "severity" ? undefined : config.limits[rule.id];
  if (limit !== undefined) return { level: "normal", limit, set_as: "number" };
  if (explicit !== undefined) return { level: explicit, ...effectAt(rule, explicit, genre) };
  if (rule.status === "experimental" && !config.experimental) {
    return { level: "off", why_off: text.offExperimental, turn_on_with: `npx chaff lint --experimental` };
  }
  return { level: "normal", ...effectAt(rule, "normal", genre) };
};

/** What a level does to a rule: the limit it counts to, or, with nothing to count, the severity of its findings. */
const effectAt = (rule: RuleDefinition, level: Exclude<Level, "off">, genre: string): Record<string, unknown> =>
  rule.level_sets === "severity" ? { severity: severityAt(rule, level, genre) } : { limit: resolve(rule, level, genre).limit };

const yourSetting = (rule: RuleDefinition, config: Config): Record<string, unknown> | null => {
  const level = config.rules[rule.id];
  if (level === undefined) return null;
  const from = styleLevelSource(config, rule.id) ?? config.path;
  const limit = rule.level_sets === "severity" ? undefined : config.limits[rule.id];
  return limit === undefined ? { level, from } : { level, limit, from };
};

/** The house style chaff.yaml names: what it decides and the guideline it follows, so an AI can say where a setting came from. */
const styleOf = (config: Config): Record<string, unknown> | null => {
  const style = loadStyles().find((entry) => entry.id === config.applied?.style);
  return style === undefined ? null : { id: style.id, name: style.name, summary: style.summary, source: style.source };
};

/** ジャンルで数字が変わる rule があるので、いま効いている表と既定の表の両方を出す。 */
const levelsOf = (rule: RuleDefinition, genre: string): Record<string, unknown> => {
  if (rule.level_sets === "severity") return { levels: severitiesOf(rule, genre) };
  const effective = Object.fromEntries(
    definedLevels(rule)
      .filter((level) => level !== "off")
      .map((level) => [level, resolve(rule, level, genre).limit]),
  );
  const overridden = JSON.stringify(effective) !== JSON.stringify(rule.levels);
  return overridden ? { levels: effective, levels_default: rule.levels, levels_from: "by_genre" } : { levels: rule.levels };
};

const severitiesOf = (rule: RuleDefinition, genre: string): Record<string, string> =>
  Object.fromEntries(
    definedLevels(rule)
      .filter((level) => level !== "off")
      .map((level) => [level, severityAt(rule, level, genre)]),
  );

/** 指摘が無いので、置き場所は rule の言葉で読ませる。言語はどれも出す。 */
const readableInEvery = (rule: RuleDefinition, field: Localized): Localized =>
  Object.fromEntries(Object.keys(field).map((language) => [language, readableText(rule, field, language)]));

/** AI に設定を書かせるときの入口。推測せずに書けるだけの情報を 1 つに入れる。spec §19.3。 */
export const rulesJson = (
  rules: readonly RuleDefinition[],
  config: Config,
  language: string,
  genre: string,
  optionLayers: readonly OptionLayer[] = [],
): string => {
  const text = TEXT[uiLanguageOf(language)];
  const preset = presetLevels(genre);
  return JSON.stringify(
    {
      schema_version: 1,
      config_file: "chaff.yaml",
      detected: { genre, language },
      style: styleOf(config),
      values_you_can_use: ["strict", "normal", "relaxed", "off"],
      values_note: text.valuesNote,
      rules: rules.map((rule) => ({
        id: rule.id,
        layer: rule.layer,
        status: rule.status,
        name: readableInEvery(rule, rule.name),
        why: readableInEvery(rule, rule.why),
        how_to_fix: readableInEvery(rule, rule.how_to_fix),
        use_for: rule.use_for,
        level_sets: rule.level_sets,
        ...levelsOf(rule, genre),
        levels_you_can_set: definedLevels(rule),
        your_setting: yourSetting(rule, config),
        now: now(rule, config, genre, text, preset),
        ...(rule.options === undefined ? {} : { options: optionsJson(rule, optionLayers) }),
      })),
      how_to_change: {
        by_command: ["relax", "strict", "off"].map((command) => `npx chaff ${command} <rule-id> --why "${text.reason}"`),
        by_file: text.byFile,
        options_by_file: text.optionsByFile,
      },
    },
    null,
    2,
  );
};
