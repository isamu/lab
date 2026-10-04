import { showsGuide, withExperimental } from "../cli-args.ts";
import type { Config } from "../config/load.ts";
import { optionLayersOf } from "../config/option-problems.ts";
import { rulesOf } from "../custom/load.ts";
import { reportedGuide } from "../genre-guide/report.ts";
import { rulesJson } from "../render/rules-json.ts";
import { rulesTable } from "../render/rules-table.ts";
import { hostLanguage } from "../ui.ts";

/** The genre the rules are shown for when none is set. */
const SHOWN_GENRE = "blog/tech";

export type RulesContext = {
  readonly flag: (argv: readonly string[], name: string) => string | undefined;
  /** Says once, on stderr, what in the settings has no effect. */
  readonly warn: (config: Config, language: string) => void;
};

/** `rules --json` for an AI to read, with the guide of a genre that was set; `rules` alone, a table for a person. */
export const showRules = (argv: readonly string[], written: Config, context: RulesContext): number => {
  const config = withExperimental(written, argv);
  const language = config.language ?? hostLanguage(undefined, process.env);
  context.warn(config, language);
  const setGenre = context.flag(argv, "--genre") ?? config.genre;
  const genre = setGenre ?? SHOWN_GENRE;
  const rules = rulesOf(language, config);
  if (!argv.includes("--json")) {
    console.log(rulesTable(rules, config, language, genre));
    return 0;
  }
  const guide = setGenre !== undefined && showsGuide(argv) ? reportedGuide(config, genre, language, rules) : undefined;
  console.log(rulesJson(rules, config, language, genre, optionLayersOf(config), guide));
  return 0;
};
