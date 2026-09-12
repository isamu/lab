import { definedLevels, resolve } from "../levels.ts";
import type { Config } from "../config/load.ts";
import type { RuleDefinition } from "../plugin.ts";

const now = (rule: RuleDefinition, config: Config, genre: string): Record<string, unknown> => {
  const explicit = config.rules[rule.id];
  if (explicit === "off") return { level: "off", why_off: "設定で止めている" };
  if (explicit !== undefined) return { level: explicit, limit: resolve(rule, explicit, genre).limit };
  if (rule.status === "experimental" && !config.experimental) {
    return { level: "off", why_off: "experimental な rule は既定で動かさない", turn_on_with: `npx chaff lint --experimental` };
  }
  return { level: "normal", limit: resolve(rule, "normal", genre).limit };
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
export const rulesJson = (rules: readonly RuleDefinition[], config: Config, language: string, genre: string): string =>
  JSON.stringify(
    {
      schema_version: 1,
      config_file: "chaff.yaml",
      detected: { genre, language },
      values_you_can_use: ["strict", "normal", "relaxed", "off"],
      values_note: "この 4 語のかわりに数字を直接書いてもよい。4 語のほうを勧める。",
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
        your_setting: config.rules[rule.id] === undefined ? null : { level: config.rules[rule.id], from: config.path },
        now: now(rule, config, genre),
      })),
      how_to_change: {
        by_command: ['npx chaff relax <rule-id> --why "<理由>"', 'npx chaff strict <rule-id> --why "<理由>"', 'npx chaff off <rule-id> --why "<理由>"'],
        by_file: "chaff.yaml の rules に <rule-id>: <level> を足す。既定のままのものは書かない。",
      },
    },
    null,
    2,
  );
