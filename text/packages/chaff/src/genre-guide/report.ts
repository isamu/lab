import { showsGuide } from "../cli-args.ts";
import type { GenreSource } from "../cli-text.ts";
import type { Config } from "../config/load.ts";
import { loadGenres } from "../genre-load.ts";
import type { RuleDefinition } from "../plugin.ts";
import { localized } from "../render/text.ts";
import { uiLanguageOf, type UiLanguage } from "../ui.ts";
import { keyRulesOf } from "./key-rules.ts";
import { genreGuideFor } from "./of-config.ts";

/** A genre's guide as chaff reports it: the genre and its name, the lines, the rules that matter most, and who wrote it. */
export type ReportedGuide = {
  readonly genre: string;
  readonly name: string;
  readonly lines: readonly string[];
  readonly rules: readonly string[];
  readonly from: readonly string[];
};

/**
 * Where a genre counts as set, so its guide is shown. A defaulted genre is not one, nor one guessed from the path or the
 * text: a guide for the wrong kind of document misleads more than none.
 */
const SET_BY: ReadonlySet<GenreSource> = new Set<GenreSource>(["--genre", "by_path", "config", "front-matter"]);

export const genreWasSet = (from: GenreSource): boolean => SET_BY.has(from);

type GuideSettings = Pick<Config, "guide" | "applied" | "extensions" | "rules">;

/** The guide for a genre in a document's language, with the rules that matter most; undefined when it is off or there is none. */
export const reportedGuide = (config: GuideSettings, genre: string, language: string, rules: readonly RuleDefinition[]): ReportedGuide | undefined => {
  const ui = uiLanguageOf(language);
  const guide = genreGuideFor(config, genre, ui);
  if (guide === undefined) return undefined;
  const data = loadGenres();
  const name = data.genres.find((entry) => entry.id === genre)?.name;
  return {
    genre,
    name: name === undefined ? genre : localized(name, ui),
    lines: guide.lines,
    rules: keyRulesOf(rules, data, genre, language, config.rules),
    from: guide.from,
  };
};

/** One checked document, as far as its guide goes. */
type GuidedDocument = { readonly genre: string; readonly genreFrom: GenreSource; readonly language: string; readonly rules: readonly RuleDefinition[] };

/** A guide with the language it is written in, for output that holds several documents. */
export type RunGuide = { readonly language: UiLanguage; readonly guide: ReportedGuide };

/** A run's guides: one per genre and language among the documents whose genre was set, first seen first. None with --no-guide. */
export const guidesOfRun = (documents: readonly GuidedDocument[], config: GuideSettings, args: readonly string[]): RunGuide[] => {
  if (!showsGuide(args)) return [];
  const keyed = documents
    .filter((document) => genreWasSet(document.genreFrom))
    .map((document) => ({ key: `${document.genre}\n${uiLanguageOf(document.language)}`, document }));
  const firsts = keyed.filter((entry, index) => keyed.findIndex((other) => other.key === entry.key) === index);
  return firsts.flatMap(({ document }) => {
    const guide = reportedGuide(config, document.genre, document.language, document.rules);
    return guide === undefined ? [] : [{ language: uiLanguageOf(document.language), guide }];
  });
};
