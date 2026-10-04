import { presetLevelsOf, type GenreData } from "../genre-parse.ts";
import type { Level, RuleDefinition } from "../plugin.ts";
import { standingIn } from "../rule-genres.ts";

/** A rule that runs in at most this share of the genres speaks for the few it runs in. */
const RARE_SHARE = 0.25;

type RuleFacts = Pick<RuleDefinition, "id" | "status" | "use_for" | "languages">;

const runsIn = (rule: RuleFacts, data: GenreData, genre: string): boolean => standingIn(rule, genre, presetLevelsOf(data, genre)).kind === "on";

const isRare = (rule: RuleFacts, data: GenreData): boolean =>
  data.genres.filter((entry) => runsIn(rule, data, entry.id)).length <= data.genres.length * RARE_SHARE;

const readsLanguage = (rule: RuleFacts, language: string): boolean => rule.languages === undefined || rule.languages.includes(language);

/**
 * The rules that matter most for a genre, by id: those its preset turns on, and those that run in it but in few other
 * genres. A rule the team's settings turn off is left out. Pure: the genres and the settings come in.
 */
export const keyRulesOf = (
  rules: readonly RuleFacts[],
  data: GenreData,
  genre: string,
  language: string,
  settings: Readonly<Record<string, Level>>,
): string[] => {
  const preset = presetLevelsOf(data, genre);
  const matters = (rule: RuleFacts): boolean => {
    const standing = standingIn(rule, genre, preset);
    return standing.kind === "on" && (standing.byPreset || isRare(rule, data));
  };
  return rules
    .filter((rule) => readsLanguage(rule, language) && settings[rule.id] !== "off" && matters(rule))
    .map((rule) => rule.id)
    .toSorted((left, right) => left.localeCompare(right, "en"));
};
