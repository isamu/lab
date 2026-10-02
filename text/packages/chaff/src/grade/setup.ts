import { loadAdapter } from "../adapter-load.ts";
import type { Config } from "../config/load.ts";
import { rulesOf } from "../custom/load.ts";
import { loadGenres } from "../genre-load.ts";
import { loadProfiles } from "../profile/load.ts";
import { VERSION_LINES } from "../version.ts";
import type { GradeSetup } from "./grade-item.ts";
import { compareText } from "./order.ts";
import type { Rubric } from "./rubric.ts";
import { stampOf, type RuleSet } from "./stamp.ts";

/** The languages every stamp covers, whatever a run's outputs are written in, so two runs over different outputs stay comparable. */
const BUNDLED_LANGUAGES: readonly string[] = ["en", "ja"];

/** The rules each language runs and the word lists they read, with the genres' presets. Loads each language package. */
const ruleSetOf = async (config: Config, languages: readonly string[]): Promise<RuleSet> => {
  const read = await Promise.all(
    languages.map(async (language) => {
      const adapter = await loadAdapter(language);
      return { language, rules: rulesOf(language, config), lexicons: { ...adapter.lexicons, ...config.extensions?.lexicons[language] } };
    }),
  );
  return {
    rules: Object.fromEntries(read.map((entry) => [entry.language, entry.rules])),
    lexicons: Object.fromEntries(read.map((entry) => [entry.language, entry.lexicons])),
    genres: loadGenres(),
    profiles: loadProfiles(),
  };
};

/** A run's settings, rubric and stamp. `languages`: those the items name, beyond the bundled ones. Throws when a language package cannot be loaded. */
export const gradeSetup = async (
  config: Config,
  run: { readonly experimental: boolean; readonly genre: string | undefined },
  languages: readonly string[],
  rubric: Rubric | undefined,
): Promise<GradeSetup> => {
  const all = [...new Set([...BUNDLED_LANGUAGES, ...languages])].toSorted(compareText);
  const settings = { config, experimental: run.experimental, genre: run.genre };
  return { ...settings, rubric, stamp: stampOf(VERSION_LINES, await ruleSetOf(config, all), settings) };
};
