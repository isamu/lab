import type { LevelTable, Localized, Severity } from "../plugin.ts";
import { RULE_GROUPS, ruleGuideOf, type RuleGroup, type RuleGuide } from "../rule-guide.ts";
import { fieldProblems } from "../rule-fields.ts";
import { failed, ok, type Checked } from "./checked.ts";

// The fields a team's rule (custom_rules, or a plugin's rules) writes the way chaff's own rules/*.yaml do: levels,
// use_for, group, summary, the example by language and rewrite. Each is optional; without it the rule reads as a team
// rule always has. The shared fields are checked by rule-fields.ts, the one place chaff's own rules are checked too. Pure.

const SEVERITIES: readonly Severity[] = ["info", "warning", "error"];
const LEVEL_NAMES = ["strict", "normal", "relaxed"] as const;

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);

const printed = (value: unknown): string => (typeof value === "string" ? value : (JSON.stringify(value) ?? typeof value));

const rankOf = (severity: Severity): number => SEVERITIES.indexOf(severity) + 1;

/** level: one severity; normal is the rule's own, relaxed one lower, strict one higher, where there is one. */
const tableFor = (severity: Severity): LevelTable => {
  const rank = rankOf(severity);
  return { ...(rank < SEVERITIES.length ? { strict: rank + 1 } : {}), normal: rank, ...(rank > 1 ? { relaxed: rank - 1 } : {}) };
};

const severityAt = (value: unknown): Severity | undefined => SEVERITIES.find((entry) => entry === value);

/**
 * levels: a severity for each of strict, normal and relaxed, as chaff's rules with nothing to count write them. A
 * team's detector reports places, not counts, so a number has nothing to be compared with and is refused.
 */
const tableOf = (written: unknown): { table: LevelTable; severity: Severity } | undefined => {
  if (!isRecord(written) || Object.keys(written).some((key) => !LEVEL_NAMES.some((name) => name === key))) return undefined;
  const ranks = LEVEL_NAMES.flatMap((name) => {
    const severity = severityAt(written[name]);
    return severity === undefined ? [] : [[name, rankOf(severity)] as const];
  });
  const normal = severityAt(written["normal"]);
  if (normal === undefined || ranks.length !== Object.keys(written).length) return undefined;
  return { table: Object.fromEntries(ranks), severity: normal };
};

export type RuleLevels = { readonly table: LevelTable; readonly severity: Severity };

/** level (one severity, as before) or levels (a severity per level). Not both: they would disagree on normal. */
export const levelsOf = (raw: Readonly<Record<string, unknown>>, at: string): Checked<RuleLevels> => {
  const [level, levels] = [raw["level"], raw["levels"]];
  if (level !== undefined && levels !== undefined) return failed({ kind: "level-and-levels", at });
  if (levels !== undefined) {
    const read = tableOf(levels);
    return read === undefined ? failed({ kind: "bad-levels", at, written: printed(levels) }) : ok(read);
  }
  if (level === undefined) return ok({ table: tableFor("warning"), severity: "warning" });
  const severity = severityAt(level);
  return severity === undefined ? failed({ kind: "bad-level", at, written: printed(level) }) : ok({ table: tableFor(severity), severity });
};

/** An example written by language ({ ja: { before, after } }) rather than as { before, after }. */
const isExampleByLanguage = (example: unknown): example is Record<string, unknown> =>
  isRecord(example) && Object.keys(example).length > 0 && !("before" in example) && !("after" in example);

/** example's before and after, each by language, whichever form it is written in. */
export const exampleSides = (example: unknown): { readonly before: unknown; readonly after: unknown } => {
  if (!isRecord(example)) return { before: undefined, after: undefined };
  if (!isExampleByLanguage(example)) return { before: example["before"], after: example["after"] };
  const pairs = Object.entries(example).flatMap(([language, pair]) => (isRecord(pair) ? [[language, pair] as const] : []));
  return {
    before: Object.fromEntries(pairs.map(([language, pair]) => [language, pair["before"]])),
    after: Object.fromEntries(pairs.map(([language, pair]) => [language, pair["after"]])),
  };
};

export type Described = Pick<RuleGuide, "rewrite" | "rewriteDepth"> & {
  readonly group: RuleGroup;
  /** undefined: the rule's name stands for its summary. */
  readonly summary: Localized | undefined;
  /** undefined: every genre, as a team's rule always has. */
  readonly useFor: readonly string[] | undefined;
};

const textOf = (value: unknown): Localized | undefined => {
  if (typeof value === "string") return value.trim() === "" ? undefined : { ja: value.trim(), en: value.trim() };
  return isRecord(value) ? ruleGuideOf({ summary: value }).summary : undefined;
};

/**
 * The fields a team's rule shares with chaff's own, checked in rule-fields.ts. An example written as { before, after }
 * is left to the caller, which has always read and reported it.
 */
export const describedOf = (raw: Readonly<Record<string, unknown>>, at: string, genres: readonly string[]): Checked<Described> => {
  const shared = { ...raw, example: isExampleByLanguage(raw["example"]) ? raw["example"] : undefined };
  const problems = fieldProblems(shared, genres).map((problem) => ({ kind: problem.kind, at, written: problem.written }));
  if (problems.length > 0) return failed(...problems);
  const { rewrite, rewriteDepth } = ruleGuideOf({ rewrite: raw["rewrite"] });
  const useFor = raw["use_for"];
  return ok({
    group: RULE_GROUPS.find((group) => group === raw["group"]) ?? "team",
    summary: textOf(raw["summary"]),
    useFor: Array.isArray(useFor) ? useFor.map((entry) => String(entry)) : undefined,
    rewrite,
    rewriteDepth,
  });
};
