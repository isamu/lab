import type { Finding } from "../plugin.ts";

/** A rule with more findings in the rewrite than in the original: what the rewrite brought in. */
export type RisenRule = { readonly rule: string; readonly before: number; readonly after: number };

const countsOf = (findings: readonly Pick<Finding, "rule">[]): Map<string, number> =>
  findings.reduce((counts, finding) => counts.set(finding.rule, (counts.get(finding.rule) ?? 0) + 1), new Map<string, number>());

/** Every rule whose findings rose from the original to the rewrite, in the order the rewrite's findings name them. */
export const risenRules = (before: readonly Pick<Finding, "rule">[], after: readonly Pick<Finding, "rule">[]): RisenRule[] => {
  const was = countsOf(before);
  return [...countsOf(after)].map(([rule, count]) => ({ rule, before: was.get(rule) ?? 0, after: count })).filter((entry) => entry.after > entry.before);
};
