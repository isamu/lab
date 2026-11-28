import { matches, type PathRule } from "./by-path.ts";
import type { Config } from "./load.ts";
import type { Level } from "../plugin.ts";
import type { OptionLayer } from "../rule-options.ts";

/** How a by_path entry is named where a setting's source is shown (the rules that did not run, explain, rules --json). */
export const byPathSource = (entry: Pick<PathRule, "files">): string => `by_path: ${entry.files.join(", ")}`;

/** What the by_path entries matching one file set on rules, merged: the later entry wins, as it does for genre. */
export type PathRuleSettings = {
  readonly rules: Readonly<Record<string, Level>>;
  readonly limits: Readonly<Record<string, number>>;
  /** For each rule whose level an entry set, the entry that set it last. */
  readonly levelsFrom: Readonly<Record<string, string>>;
  /** The entries' options, strongest (latest) first. */
  readonly optionLayers: readonly OptionLayer[];
};

const NOTHING: PathRuleSettings = { rules: {}, limits: {}, levelsFrom: {}, optionLayers: [] };

const without = <T>(record: Readonly<Record<string, T>>, ids: readonly string[]): Record<string, T> =>
  Object.fromEntries(Object.entries(record).filter(([id]) => !ids.includes(id)));

/** One more entry over what the earlier ones set. A word it writes drops an earlier number for that rule: the word is the newer setting. */
const overlay = (settings: PathRuleSettings, entry: PathRule): PathRuleSettings => {
  const source = byPathSource(entry);
  const levels = entry.rules ?? {};
  const ids = Object.keys(levels);
  const options = entry.options ?? {};
  return {
    rules: { ...settings.rules, ...levels },
    limits: { ...without(settings.limits, ids), ...entry.limits },
    levelsFrom: { ...settings.levelsFrom, ...Object.fromEntries(ids.map((id) => [id, source])) },
    optionLayers: Object.keys(options).length === 0 ? settings.optionLayers : [{ from: source, values: options }, ...settings.optionLayers],
  };
};

/** The entries in the order written, merged. */
export const mergePathRules = (entries: readonly PathRule[]): PathRuleSettings => entries.reduce(overlay, NOTHING);

/** The by_path entries whose files match this path, matched from the folder of the settings file, in the order written. */
export const entriesFor = (byPath: readonly PathRule[], base: string, path: string): PathRule[] =>
  byPath.filter((entry) => entry.files.some((glob) => matches(glob, base, path)));

/**
 * The settings one file is checked with. Strongest first: the matching by_path entries' rules and options (the last one
 * written first), chaff.yaml's own rules and options, its style, the genre's preset, the rule's default.
 * A level by_path sets also drops a number chaff.yaml or the style set for that rule, since the level is the closer setting.
 */
export const configForPath = (config: Config, path: string): Config => {
  const settings = mergePathRules(entriesFor(config.byPath, config.baseDir, path));
  const ids = Object.keys(settings.rules);
  if (ids.length === 0 && settings.optionLayers.length === 0) return config;
  const { applied } = config;
  return {
    ...config,
    rules: { ...config.rules, ...settings.rules },
    limits: { ...without(config.limits, ids), ...settings.limits },
    applied:
      applied === undefined
        ? undefined
        : { ...applied, levelsFrom: applied.levelsFrom.filter((id) => !ids.includes(id)), limits: without(applied.limits, ids) },
    pathLevelsFrom: settings.levelsFrom,
    pathOptionLayers: settings.optionLayers,
  };
};

/** One by_path entry's setting for one rule, for explain and rules --json, which speak of no one file. */
export type PathRuleLevel = { readonly files: readonly string[]; readonly level: Level; readonly limit?: number };

/** Every by_path entry that sets this rule's level or number, in the order written. */
export const pathLevelsOf = (byPath: readonly PathRule[], ruleId: string): PathRuleLevel[] =>
  byPath.flatMap((entry): PathRuleLevel[] => {
    const level = entry.rules?.[ruleId];
    if (level === undefined) return [];
    const limit = entry.limits?.[ruleId];
    return [limit === undefined ? { files: entry.files, level } : { files: entry.files, level, limit }];
  });
