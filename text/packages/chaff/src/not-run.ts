import type { RuleDefinition } from "./plugin.ts";
import type { Skipped } from "./run.ts";

/** A rule someone asked about that did not run in this check, with why, and whether --experimental would run it. */
export type NotRun = Skipped & { readonly needsExperimental: boolean };

/**
 * Pure: of the rules named in `ruleIds`, those this check skipped. A command that looks a rule's findings up (feedback,
 * suppressions) says this instead of "none": no findings from a rule that did not run is not "checked and fine".
 */
export const notRunAmong = (ruleIds: readonly string[], skipped: readonly Skipped[], rules: readonly RuleDefinition[], experimentalRun: boolean): NotRun[] => {
  const asked = new Set(ruleIds);
  const experimentalIds = new Set(rules.filter((rule) => rule.status === "experimental").map((rule) => rule.id));
  return skipped
    .filter((entry) => asked.has(entry.rule))
    .map((entry) => ({ ...entry, needsExperimental: !experimentalRun && experimentalIds.has(entry.rule) }));
};
