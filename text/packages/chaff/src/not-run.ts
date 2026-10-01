import type { Skipped } from "./run.ts";

/** A rule someone asked about that did not run in this check, with why, and whether --experimental would run it. */
export type NotRun = { readonly rule: string; readonly why: string; readonly needsExperimental: boolean };

/**
 * Pure: of the rules named in `ruleIds`, those this check skipped. A command that looks a rule's findings up (feedback,
 * suppressions) says this instead of "none": no findings from a rule that did not run is not "checked and fine".
 * --experimental is suggested only where it is the reason, not for a rule chaff.yaml or the genre turned off.
 */
export const notRunAmong = (ruleIds: readonly string[], skipped: readonly Skipped[]): NotRun[] => {
  const asked = new Set(ruleIds);
  return skipped
    .filter((entry) => asked.has(entry.rule))
    .map((entry) => ({ rule: entry.rule, why: entry.why, needsExperimental: entry.offUntilExperimental === true }));
};
