import type { Config } from "./load.ts";
import type { StyleDefinition } from "../style-parse.ts";
import type { Texts, UiLanguage } from "../ui.ts";

/** How a style is named where a setting's source is shown (rules --json, explain). */
export const styleSource = (id: string): string => `style: ${id}`;

/** Where a rule's level came from when the style set it; undefined when chaff.yaml, the genre or the default did. */
export const styleLevelSource = (config: Pick<Config, "applied">, ruleId: string): string | undefined =>
  config.applied?.levelsFrom.includes(ruleId) === true ? styleSource(config.applied.style) : undefined;

/**
 * chaff.yaml with its style applied. A style's levels sit under chaff.yaml's own rules and over the genre's preset, since
 * they join rules (which run.ts already puts over the preset). Its options become a layer under chaff.yaml's options.
 * Without a style, or with one chaff does not have (settingProblems stops the run on that), the config is unchanged.
 */
export const withStyle = (config: Config, styles: readonly StyleDefinition[]): Config => {
  const style = styles.find((entry) => entry.id === config.style);
  if (style === undefined) return config;
  const fromStyle = Object.keys(style.rules).filter((id) => config.rules[id] === undefined && config.limits[id] === undefined);
  const limits = Object.fromEntries(Object.entries(style.limits).filter(([id]) => fromStyle.includes(id)));
  return {
    ...config,
    rules: { ...style.rules, ...config.rules },
    applied: { style: style.id, levelsFrom: fromStyle, options: style.options, limits },
  };
};

/**
 * The numeric limits a run of a document in this language uses: chaff.yaml's own, and under them the style's for this
 * language. A style that gives a number only for Japanese leaves an English document at the level's number.
 */
export const limitsFor = (config: Pick<Config, "limits" | "applied">, language: string): Readonly<Record<string, number>> => {
  const fromStyle = Object.entries(config.applied?.limits ?? {}).flatMap(([id, byLanguage]): [string, number][] => {
    const limit = byLanguage[language];
    return limit === undefined ? [] : [[id, limit]];
  });
  return { ...Object.fromEntries(fromStyle), ...config.limits };
};

const TEXT: Texts<{ readonly unknown: (where: string, style: string, known: string) => string }> = {
  ja: {
    unknown: (where, style, known) => `${where}: style: ${style} というスタイルはありません。使えるのは ${known} です`,
  },
  en: {
    unknown: (where, style, known) => `${where}: there is no style named ${style}. The styles are ${known}`,
  },
};

/** A style chaff does not have. It stops the run, like an unknown genre: running without it would check less than was asked. */
export const styleProblems = (config: Pick<Config, "style" | "path">, styles: readonly StyleDefinition[], ui: UiLanguage): string[] => {
  const written = config.style;
  if (written === undefined || styles.some((style) => style.id === written)) return [];
  return [`chaff: ${TEXT[ui].unknown(config.path ?? "chaff.yaml", written, styles.map((style) => style.id).join(", "))}`];
};
