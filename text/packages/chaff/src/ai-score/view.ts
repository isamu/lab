import type { LengthUnit, RuleDefinition } from "../plugin.ts";
import { loadGenres } from "../genre-load.ts";
import { localized } from "../render/text.ts";
import { STRUCTURE_TEXT } from "../outline/structure-text.ts";
import { uiLanguageOf } from "../ui.ts";
import type { ScoreView } from "./render.ts";
import { AI_SCORE_TEXT } from "./text.ts";

/** The texts and names a score is shown with, in the document's language. */
export const scoreViewOf = (language: string, unit: LengthUnit, group: string, rules: readonly RuleDefinition[]): ScoreView => {
  const ui = uiLanguageOf(language);
  const name = loadGenres().groups.find((entry) => entry.id === group)?.name;
  return {
    text: AI_SCORE_TEXT[ui],
    structure: STRUCTURE_TEXT[ui],
    language: ui,
    unit,
    groupName: name === undefined ? group : localized(name, ui),
    ruleNames: Object.fromEntries(rules.map((rule) => [rule.id, rule.name])),
  };
};
