import type { Level, LevelTable, RuleDefinition } from "../plugin.ts";
import type { FeatureId } from "../structure-shape/features.ts";

/** Shapes of generated text whose rules sit in another group of the reference (a markup density, a template blank). */
const ALSO_AI_SHAPES: readonly string[] = ["bold-density", "chat-citation-residue", "emoji-density", "unfilled-placeholder"];

const COMPOSITE = "ai-generated-composite";
/** Counted through the structure measures it reads, one by one, so it is not counted again as a whole. */
const STRUCTURE_RULE = "ai-structure";

/** The rules of group ai-tells, the signals ai-generated-composite reads, and ALSO_AI_SHAPES, in rule-file order. */
export const aiShapeRuleIds = (rules: readonly RuleDefinition[]): string[] => {
  const read = new Set([...ALSO_AI_SHAPES, ...rules.flatMap((rule) => (rule.id === COMPOSITE ? rule.from : []))]);
  return rules.filter((rule) => rule.guide?.group === "ai-tells" || read.has(rule.id)).map((rule) => rule.id);
};

/**
 * The AI-shape rules the quick score counts one by one: every one but the two that only add up others (the composite
 * over the signals, ai-structure over the structure measures), which would count the same sign twice.
 */
export const scoredSignalIds = (rules: readonly RuleDefinition[]): string[] => aiShapeRuleIds(rules).filter((id) => id !== COMPOSITE && id !== STRUCTURE_RULE);

/** A structure measure and the rule that reads the same shape: when both count, the shape counts once. */
export const SAME_SHAPE: Readonly<Partial<Record<FeatureId, string>>> = {
  "section-uniformity": "section-length-uniformity",
  "bold-labels": "bold-label-list",
  "emoji-headings": "emoji-heading",
  "three-item-lists": "rule-of-three",
};

/** The composite's levels: the score's level boundaries are held to them (test_ai_score.ts). */
export const compositeLevels = (rules: readonly RuleDefinition[]): LevelTable => rules.find((rule) => rule.id === COMPOSITE)?.levels ?? {};

/**
 * The level each rule runs at when measured on human documents (`yarn rules:measure`): the genre's level, and normal
 * where the genre turns the rule off, so a share exists for every genre group the rule can run in.
 */
export const measuredLevelsOf = (rules: readonly RuleDefinition[], preset: Readonly<Record<string, Level>>): Record<string, Level> =>
  Object.fromEntries(rules.map((rule) => [rule.id, preset[rule.id] === undefined || preset[rule.id] === "off" ? "normal" : (preset[rule.id] ?? "normal")]));
