import { definedLevels, resolve } from "../levels.ts";
import type { Config } from "../config/load.ts";
import type { RuleDefinition } from "../plugin.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";

const TEXT: Texts<{
  readonly offBySetting: string;
  readonly offExperimental: string;
  readonly valuesNote: string;
  readonly reason: string;
  readonly byFile: string;
}> = {
  ja: {
    offBySetting: "設定で止めている",
    offExperimental: "experimental な rule は既定で動かさない",
    valuesNote: "この 4 語のかわりに数字を直接書いてもよい。4 語のほうを勧める。",
    reason: "<理由>",
    byFile: "chaff.yaml の rules に <rule-id>: <level> を足す。既定のままのものは書かない。",
  },
  en: {
    offBySetting: "turned off in the settings",
    offExperimental: "experimental rules do not run by default",
    valuesNote: "A number may be written instead of these four words. The words are recommended.",
    reason: "<reason>",
    byFile: "Add <rule-id>: <level> under rules in chaff.yaml. Leave out anything at its default.",
  },
};

const now = (rule: RuleDefinition, config: Config, genre: string, text: (typeof TEXT)["ja"]): Record<string, unknown> => {
  const explicit = config.rules[rule.id];
  if (explicit === "off") return { level: "off", why_off: text.offBySetting };
  const limit = rule.layer === "L4" ? undefined : config.limits[rule.id];
  if (limit !== undefined) return { level: "normal", limit, set_as: "number" };
  if (explicit !== undefined) return { level: explicit, limit: resolve(rule, explicit, genre).limit };
  if (rule.status === "experimental" && !config.experimental) {
    return { level: "off", why_off: text.offExperimental, turn_on_with: `npx chaff lint --experimental` };
  }
  return { level: "normal", limit: resolve(rule, "normal", genre).limit };
};

const yourSetting = (rule: RuleDefinition, config: Config): Record<string, unknown> | null => {
  const level = config.rules[rule.id];
  if (level === undefined) return null;
  const limit = rule.layer === "L4" ? undefined : config.limits[rule.id];
  return limit === undefined ? { level, from: config.path } : { level, limit, from: config.path };
};

/** ジャンルで数字が変わる rule があるので、いま効いている表と既定の表の両方を出す。 */
const levelsOf = (rule: RuleDefinition, genre: string): Record<string, unknown> => {
  const effective = Object.fromEntries(
    definedLevels(rule)
      .filter((level) => level !== "off")
      .map((level) => [level, resolve(rule, level, genre).limit]),
  );
  const overridden = JSON.stringify(effective) !== JSON.stringify(rule.levels);
  return overridden ? { levels: effective, levels_default: rule.levels, levels_from: "by_genre" } : { levels: rule.levels };
};

/** AI に設定を書かせるときの入口。推測せずに書けるだけの情報を 1 つに入れる。spec §19.3。 */
export const rulesJson = (rules: readonly RuleDefinition[], config: Config, language: string, genre: string): string => {
  const text = TEXT[uiLanguageOf(language)];
  return JSON.stringify(
    {
      schema_version: 1,
      config_file: "chaff.yaml",
      detected: { genre, language },
      values_you_can_use: ["strict", "normal", "relaxed", "off"],
      values_note: text.valuesNote,
      rules: rules.map((rule) => ({
        id: rule.id,
        layer: rule.layer,
        status: rule.status,
        name: rule.name,
        why: rule.why,
        how_to_fix: rule.how_to_fix,
        use_for: rule.use_for,
        ...levelsOf(rule, genre),
        levels_you_can_set: definedLevels(rule),
        your_setting: yourSetting(rule, config),
        now: now(rule, config, genre, text),
      })),
      how_to_change: {
        by_command: ["relax", "strict", "off"].map((command) => `npx chaff ${command} <rule-id> --why "${text.reason}"`),
        by_file: text.byFile,
      },
    },
    null,
    2,
  );
};
