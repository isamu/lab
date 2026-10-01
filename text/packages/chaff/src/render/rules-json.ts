import { definedLevels, resolve, severityAt } from "../levels.ts";
import type { Config } from "../config/load.ts";
import type { Level, Localized, RuleDefinition } from "../plugin.ts";
import { readableText } from "./text.ts";
import { uiLanguageOf, type Texts } from "../ui.ts";
import { loadGenres, presetLevels } from "../genre-load.ts";
import { presetLevelsOf, type PresetLevels } from "../genre-parse.ts";
import { RULE_GROUPS, groupTextOf } from "../rule-guide.ts";
import { standingIn } from "../rule-genres.ts";
import { optionsJson } from "./options.ts";
import type { OptionLayer } from "../rule-options.ts";

const TEXT: Texts<{
  readonly offBySetting: string;
  readonly offByGenre: (genre: string) => string;
  readonly offUnsuited: (genre: string) => string;
  readonly offExperimental: string;
  readonly valuesNote: string;
  readonly reason: string;
  readonly byFile: string;
  readonly optionsByFile: string;
  readonly fromStyleNote: readonly string[];
}> = {
  ja: {
    offBySetting: "設定で止めている",
    offByGenre: (genre) => `ジャンル ${genre} では見ない`,
    offUnsuited: (genre) => `ジャンル ${genre} の文書には向かない rule（use_for）`,
    offExperimental: "experimental な rule は既定で動かさない",
    valuesNote: "この 4 語のかわりに数字を直接書いてもよい。4 語のほうを勧める。",
    reason: "<理由>",
    byFile: "chaff.yaml の rules に <rule-id>: <level> を足す。既定のままのものは書かない。",
    optionsByFile: "options を持つ rule は、chaff.yaml の options に <rule-id>: { <option>: <value> } を足す。",
    fromStyleNote: [
      "チームの書き方の決まり（例: です・ます、1 文 80 字まで）を一つずつ読む。",
      "決まりごとに、summary と level_meaning が合う rule を選ぶ。数の決まりは levels の数と比べ、合う段階を選ぶか数を直接書く。",
      "文書の種類が分かれば genre を決める。rules[].genres で、そのジャンルで動くか・止まるかを確かめる。",
      "表記の決まりは prefer、社内用語は jargon、必須の見出しは required_sections に書く。",
      "既定と同じものは書かない。書いたら npx chaff explain <rule-id> と、決まりに沿った短い見本で確かめる。",
    ],
  },
  en: {
    offBySetting: "turned off in the settings",
    offByGenre: (genre) => `the ${genre} genre does not check it`,
    offUnsuited: (genre) => `not a rule for ${genre} documents (use_for)`,
    offExperimental: "experimental rules do not run by default",
    valuesNote: "A number may be written instead of these four words. The words are recommended.",
    reason: "<reason>",
    byFile: "Add <rule-id>: <level> under rules in chaff.yaml. Leave out anything at its default.",
    optionsByFile: "For a rule with options, add <rule-id>: { <option>: <value> } under options in chaff.yaml.",
    fromStyleNote: [
      "Read the team's style note one requirement at a time (for example: polite endings, sentences of at most 80 characters).",
      "For each requirement, pick the rule whose summary and level_meaning match. For a number, compare it with the rule's levels and pick a level, or write the number itself.",
      "If the kind of document is known, set genre, and check rules[].genres for whether each rule runs or is off in it.",
      "Put spellings under prefer, in-house words under jargon, and required headings under required_sections.",
      "Leave out anything at its default. Then check each rule with npx chaff explain <rule-id> and a short sample that follows the note.",
    ],
  },
};

const now = (rule: RuleDefinition, config: Config, genre: string, text: (typeof TEXT)["ja"], preset: PresetLevels): Record<string, unknown> => {
  // A run leaves out a rule whose use_for does not cover the genre before it reads any level.
  if (standingIn(rule, genre, {}).kind === "unsuited") return { level: "off", why_off: text.offUnsuited(genre) };
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

/** The level a rule runs at now, and why it is off when it is: what `chaff rules` shows in its table. */
export const nowFor = (rule: RuleDefinition, config: Config, language: string, genre: string): Record<string, unknown> =>
  now(rule, config, genre, TEXT[uiLanguageOf(language)], presetLevels(genre));

/** What a level does to a rule: the limit it counts to, or, with nothing to count, the severity of its findings. */
const effectAt = (rule: RuleDefinition, level: Exclude<Level, "off">, genre: string): Record<string, unknown> =>
  rule.level_sets === "severity" ? { severity: severityAt(rule, level, genre) } : { limit: resolve(rule, level, genre).limit };

const yourSetting = (rule: RuleDefinition, config: Config): Record<string, unknown> | null => {
  const level = config.rules[rule.id];
  if (level === undefined) return null;
  const limit = rule.level_sets === "severity" ? undefined : config.limits[rule.id];
  return limit === undefined ? { level, from: config.path } : { level, limit, from: config.path };
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

const READER_LANGUAGES = ["ja", "en"];

/** How the rule stands in every genre with no chaff.yaml, so an AI can pick a genre before it picks levels. */
const genresOf = (rule: RuleDefinition): Record<string, Record<string, string>> => {
  const data = loadGenres();
  return Object.fromEntries(
    data.genres.map((genre) => {
      const standing = standingIn(rule, genre.id, presetLevelsOf(data, genre.id));
      return [genre.id, standing.kind === "on" ? { runs: "on", level: standing.level } : { runs: standing.kind }];
    }),
  );
};

/** The plain-language part of the rule file: what it finds, an example, what it leaves alone, what a level means. */
const guideOf = (rule: RuleDefinition): Record<string, unknown> => ({
  group: rule.guide?.group ?? null,
  summary: rule.guide?.summary ?? {},
  example: rule.guide?.examples ?? {},
  not_flagged: rule.guide?.notFlagged ?? {},
  level_meaning: rule.guide?.levelMeaning ?? {},
  languages: rule.languages ?? READER_LANGUAGES,
  requires: rule.requires,
  genres: genresOf(rule),
});

const groupsOf = (): Record<string, unknown>[] =>
  RULE_GROUPS.map((group) => ({
    id: group,
    name: Object.fromEntries(READER_LANGUAGES.map((language) => [language, groupTextOf(language, group).name])),
    note: Object.fromEntries(READER_LANGUAGES.map((language) => [language, groupTextOf(language, group).note])),
  }));

/**
 * What the local-rules release adds. Named now so an AI reading the JSON knows they are coming and does not invent them.
 * Filled in when they ship: the style presets under style:, the custom_rules types, and each rule's options.
 */
const COMING = {
  style_presets: { status: "coming", presets: [] },
  custom_rule_types: { status: "coming", planned: ["words", "pattern", "tokens", "module"] },
  rule_options: { status: "coming", note: "Each rule's options (with their types and allowed values) will be listed under options." },
};

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
      // 2: rules gained group, summary, example, not_flagged, level_meaning, languages, requires and genres,
      // and groups and the coming local-rules fields were added. Nothing from 1 was removed or renamed.
      schema_version: 2,
      config_file: "chaff.yaml",
      detected: { genre, language },
      values_you_can_use: ["strict", "normal", "relaxed", "off"],
      values_note: text.valuesNote,
      groups: groupsOf(),
      ...COMING,
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
        ...guideOf(rule),
      })),
      how_to_write_settings_from_a_style_note: text.fromStyleNote,
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
