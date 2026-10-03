import { CONFIG_FILE, type Config } from "../config/load.ts";
import { loadGenres } from "../genre-load.ts";
import { knownGenres } from "../known-genres.ts";
import type { UiLanguage } from "../ui.ts";
import { guideLayerOf, type GuideLayer } from "./layer.ts";
import { guideProblemText } from "./problem-text.ts";
import { resolveGuide, type ResolvedGuide } from "./resolve.ts";

type GuideSettings = Pick<Config, "guide" | "applied" | "extensions">;

const configLayer = (config: Pick<Config, "guide">): ReturnType<typeof guideLayerOf> => guideLayerOf(config.guide, CONFIG_FILE, knownGenres());

/** Every place that changes the bundled guides, weakest first: the rule packs, then the chosen style, then chaff.yaml. */
export const guideLayersOf = (config: GuideSettings): GuideLayer[] => [
  ...(config.extensions?.guides ?? []),
  ...(config.applied?.guide === undefined ? [] : [config.applied.guide]),
  configLayer(config).layer,
];

/** The guide a document of this genre is checked against, in its language; undefined when it is turned off or the genre has none. */
export const genreGuideFor = (config: GuideSettings, genre: string, language: UiLanguage): ResolvedGuide | undefined =>
  resolveGuide(loadGenres(), genre, language, guideLayersOf(config));

/** What chaff.yaml's guide: says that cannot be read. The rest of it still applies, so these are warnings, not a stop. */
export const configGuideProblems = (config: Pick<Config, "guide" | "path">, ui: UiLanguage): string[] =>
  configLayer(config).problems.map((problem) => `${config.path ?? CONFIG_FILE}: ${guideProblemText(problem, ui)}`);
