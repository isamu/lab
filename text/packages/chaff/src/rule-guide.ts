import type { Localized } from "./plugin.ts";

/** How the rule reference groups rules for a reader who is not an engineer, in the order it lists them. */
export const RULE_GROUPS = ["readability", "wording", "slips", "consistency", "structure", "facts", "ai-tells", "team"] as const;

export type RuleGroup = (typeof RULE_GROUPS)[number];

/**
 * A short text the rule flags and the same text fixed, with the chaff.yaml it needs (jargon, prefer, a level).
 * pad: the rule measures a whole document of some length (per 1000 words), so the example is tried after an ordinary passage.
 */
export type RuleExample = {
  readonly before: string;
  readonly after: string;
  readonly config?: Readonly<Record<string, unknown>>;
  readonly pad?: boolean;
};

/** One finding of the rule itself on its example, as the command line reported it. */
export type ExampleFinding = { readonly line: number; readonly column: number; readonly message: string };

/** What the command line said about a rule on its example, before and after the fix (scripts/rule-examples.ts). */
export type ExampleOutcome = {
  readonly rule: string;
  readonly language: string;
  readonly before: readonly ExampleFinding[];
  readonly after: readonly ExampleFinding[];
};

/** The plain-language part of a rule file: what the reference tells a reader, apart from the texts chaff prints. */
export type RuleGuide = {
  readonly group: RuleGroup | undefined;
  /** What the rule finds, in one line. */
  readonly summary: Localized;
  /** By language. A rule that runs in one language has an example in that language only. */
  readonly examples: Readonly<Record<string, RuleExample>>;
  /** What the rule leaves alone on purpose, so a reader does not take silence for a miss. */
  readonly notFlagged: Localized;
  /** What a level's number means, with {limit} for the number ("一文 {limit} 字まで"). None when every level is the same. */
  readonly levelMeaning: Localized;
};

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const isText = (value: unknown): value is string => typeof value === "string" && value.trim() !== "";

const localizedOf = (value: unknown): Localized =>
  isRecord(value) ? Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => isText(entry[1]))) : {};

const exampleOf = (value: unknown): RuleExample | undefined => {
  if (!isRecord(value) || !isText(value["before"]) || !isText(value["after"])) return undefined;
  const config = value["config"];
  return {
    before: value["before"],
    after: value["after"],
    ...(isRecord(config) ? { config } : {}),
    ...(value["pad"] === true ? { pad: true } : {}),
  };
};

const examplesOf = (value: unknown): Readonly<Record<string, RuleExample>> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([language, entry]) => {
          const example = exampleOf(entry);
          return example === undefined ? [] : [[language, example] as const];
        }),
      )
    : {};

/** A field that is missing or malformed reads as empty; the test on rule files names what a rule lacks. */
export const ruleGuideOf = (raw: Readonly<Record<string, unknown>>): RuleGuide => ({
  group: RULE_GROUPS.find((group) => group === raw["group"]),
  summary: localizedOf(raw["summary"]),
  examples: examplesOf(raw["example"]),
  notFlagged: localizedOf(raw["not_flagged"]),
  levelMeaning: localizedOf(raw["level_meaning"]),
});

/** The rules in each group, in the order the reference lists them. A rule with no group is in none, which the test on rule files reports. */
export const rulesByGroup = <T>(rules: readonly T[], groupOf: (rule: T) => RuleGroup | undefined): { group: RuleGroup; rules: T[] }[] =>
  RULE_GROUPS.map((group) => ({ group, rules: rules.filter((rule) => groupOf(rule) === group) }));
